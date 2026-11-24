import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import type { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_NEXT_HEADER, authPageHref, safeAuthNext } from "@/lib/auth-next";
import { getPrisma } from "@/lib/prisma";

export { normalizeUsername, passwordValidationMessage } from "@/lib/auth-rules";

const SESSION_TOKEN_BYTES = 32;
const EXPIRED_SESSION_CLEANUP_LIMIT = 100;

// Node's scrypt needs roughly 128 * N * r bytes (32 MiB here) plus overhead.
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 64;
const SCRYPT_ENCODING_PREFIX = `scrypt$v1$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$`;

const DUMMY_SALT = Buffer.alloc(PASSWORD_SALT_BYTES, 0);
const DUMMY_KEY = Buffer.alloc(PASSWORD_KEY_BYTES, 0);

export const SESSION_COOKIE_NAME = "shan_jian_session";
export const SESSION_COOKIE_MAX_AGE = 24 * 60 * 60;
export const REMEMBERED_SESSION_MAX_AGE = 30 * SESSION_COOKIE_MAX_AGE;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
} as const;

export type AuthUser = {
  id: string;
  displayName: string;
  username: string | null;
};

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      PASSWORD_KEY_BYTES,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAXMEM,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function decodeBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== value) {
    return null;
  }

  return decoded;
}

function parsePasswordHash(
  encoded: string,
): { salt: Buffer; digest: Buffer } | null {
  if (!encoded.startsWith(SCRYPT_ENCODING_PREFIX)) {
    return null;
  }

  const remainder = encoded.slice(SCRYPT_ENCODING_PREFIX.length);
  const separator = remainder.indexOf("$");

  if (separator <= 0 || separator === remainder.length - 1) {
    return null;
  }

  const saltPart = remainder.slice(0, separator);
  const digestPart = remainder.slice(separator + 1);

  // Exactly one separator must remain; extra fields are not a valid digest.
  if (digestPart.includes("$")) {
    return null;
  }

  const salt = decodeBase64Url(saltPart);
  const digest = decodeBase64Url(digestPart);

  if (
    !salt ||
    !digest ||
    salt.length !== PASSWORD_SALT_BYTES ||
    digest.length !== PASSWORD_KEY_BYTES
  ) {
    return null;
  }

  return { salt, digest };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const derivedKey = await derivePasswordKey(password, salt);

  return `${SCRYPT_ENCODING_PREFIX}${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

/**
 * Strictly parses the versioned encoding and compares fixed-length keys with
 * timingSafeEqual. Any malformed or unexpected digest fails closed.
 */
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encoded);
  if (!parsed) {
    return false;
  }

  try {
    const derivedKey = await derivePasswordKey(password, parsed.salt);

    return (
      derivedKey.length === parsed.digest.length &&
      timingSafeEqual(derivedKey, parsed.digest)
    );
  } catch {
    return false;
  }
}

/**
 * A nonexistent account, or a legacy account without a password hash, performs
 * the same expensive scrypt work as a real account and then fails. This keeps
 * the generic invalid-login response from becoming an account oracle.
 */
export async function verifyDummyPassword(password: string): Promise<false> {
  try {
    const derivedKey = await derivePasswordKey(password, DUMMY_SALT);
    timingSafeEqual(derivedKey, DUMMY_KEY);
  } catch {
    // The caller still returns the same generic failure.
  }

  return false;
}

function digestSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function cleanupExpiredSessions(
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<void> {
  // Bounded so session issuance never performs an unbounded table sweep. The
  // expires_at index keeps this cheap even as expired rows accumulate.
  await tx.$executeRaw`
    DELETE FROM "sessions"
    WHERE "id" IN (
      SELECT "id"
      FROM "sessions"
      WHERE "expires_at" <= ${now}
      ORDER BY "expires_at" ASC
      LIMIT ${EXPIRED_SESSION_CLEANUP_LIMIT}
    )
  `;
}

async function createSessionInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
  maxAge = SESSION_COOKIE_MAX_AGE,
): Promise<string> {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + maxAge * 1000);

  await tx.session.create({
    data: {
      userId,
      tokenDigest: digestSessionToken(token),
      expiresAt,
    },
  });

  return token;
}

/**
 * Creates a login session after clearing at most a small batch of expired rows.
 * The raw token exists only in this process and in the browser cookie; the
 * database receives its SHA-256 digest.
 */
export async function issueSession(userId: string, maxAge: number): Promise<string> {
  return getPrisma().$transaction(async (tx) => {
    const now = new Date();
    await cleanupExpiredSessions(tx, now);

    return createSessionInTransaction(tx, userId, now, maxAge);
  });
}

/**
 * Registration creates the user and its first session in one transaction, so a
 * session or constraint failure cannot leave a half-registered account behind.
 */
export async function createAccountWithSession(
  username: string,
  passwordHash: string,
): Promise<string> {
  return getPrisma().$transaction(async (tx) => {
    const now = new Date();
    await cleanupExpiredSessions(tx, now);

    const user = await tx.user.create({
      data: {
        username,
        passwordHash,
        displayName: username,
      },
      select: { id: true },
    });

    return createSessionInTransaction(tx, user.id, now);
  });
}

async function findSessionUser(token: string): Promise<AuthUser | null> {
  try {
    const session = await getPrisma().session.findUnique({
      where: { tokenDigest: digestSessionToken(token) },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return session.user;
  } catch {
    // Authentication fails closed on database errors. Nothing secret is logged.
    return null;
  }
}

export async function getSessionUser(
  token: string | undefined,
): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  return findSessionUser(token);
}

export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();

  return getSessionUser(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * Revokes only the presented token. Other browsers signed in as the same user
 * keep their own independent sessions.
 */
export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) {
    return;
  }

  await getPrisma().session.deleteMany({
    where: { tokenDigest: digestSessionToken(token) },
  });
}

/**
 * Guards protected routes and Server Actions. The database session's expiry is
 * enforced server-side before any diary query runs.
 */
export async function requireDiarySession(): Promise<AuthUser> {
  const user = await getCurrentSessionUser();

  if (!user) {
    const next = safeAuthNext((await headers()).get(AUTH_NEXT_HEADER));
    redirect(authPageHref("/login", next));
  }

  return user;
}

/**
 * The single server-side gate for diary pages and actions. Owner identity comes
 * exclusively from the authenticated session, never from client input.
 */
export async function requireUser() {
  const user = await requireDiarySession();

  return { prisma: getPrisma(), user };
}
