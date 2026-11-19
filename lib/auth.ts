import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import type { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { isLocalDeveloperRequest } from "@/lib/local-host";
import { getPrisma } from "@/lib/prisma";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TOKEN_BYTES = 32;
const EXPIRED_SESSION_CLEANUP_LIMIT = 100;

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_MAX_BYTES = 512;

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
export const SESSION_COOKIE_MAX_AGE = SESSION_TTL_MS / 1000;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict",
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE,
  secure: false,
} as const;

export type AuthUser = {
  id: string;
  displayName: string;
  username: string | null;
};

/**
 * Trim first, then lowercase. The ASCII-only pattern rejects anything that is
 * not already a canonical local username after that normalization.
 */
export function normalizeUsername(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH ||
    !USERNAME_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

/**
 * Password policy is intentionally identical for login and registration. The
 * password itself is never trimmed, and the byte cap rejects oversized UTF-8
 * input before any hashing work starts.
 */
export function passwordValidationMessage(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return "密码至少需要 8 个字符。";
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return "密码最多 128 个字符。";
  }

  if (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES) {
    return "密码内容过长，请缩短后再试。";
  }

  return null;
}

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
): Promise<string> {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

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
export async function issueSession(userId: string): Promise<string> {
  return getPrisma().$transaction(async (tx) => {
    const now = new Date();
    await cleanupExpiredSessions(tx, now);

    return createSessionInTransaction(tx, userId, now);
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
 * Guards protected routes and Server Actions. The loopback check is repeated
 * here independently of the proxy, then the database session's expiry is
 * enforced server-side before any diary query runs.
 */
export async function requireDiarySession(): Promise<AuthUser> {
  const requestHeaders = await headers();

  if (!isLocalDeveloperRequest(requestHeaders.get("host"))) {
    notFound();
  }

  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/login");
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
