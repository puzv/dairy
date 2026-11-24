"use server";

import { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createAccountWithSession,
  hashPassword,
  issueSession,
  normalizeUsername,
  passwordValidationMessage,
  REMEMBERED_SESSION_MAX_AGE,
  revokeSession,
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  verifyDummyPassword,
  verifyPassword,
} from "@/lib/auth";
import { DEFAULT_AUTH_DESTINATION, safeAuthNext } from "@/lib/auth-next";
import { confirmPasswordValidationMessage, USERNAME_FORMAT_MESSAGE } from "@/lib/auth-rules";
import type { AuthFieldErrors, AuthState } from "@/lib/auth-state";
import { beginLoginAttempt, readClientIp } from "@/lib/login-rate-limit";
import { getPrisma } from "@/lib/prisma";

const INVALID_LOGIN_MESSAGE = "用户名或密码不正确。";
const LOGIN_UNAVAILABLE_MESSAGE = "登录暂时没有完成，请稍后再试。";
const REGISTER_UNAVAILABLE_MESSAGE = "注册暂时没有完成，请稍后再试。";
const LOGOUT_UNAVAILABLE_MESSAGE = "退出登录暂时没有完成，请稍后再试。";
const USERNAME_TAKEN_MESSAGE = "这个用户名已被使用，请换一个。";
const DUPLICATE_KEY_CODE = "P2002";

function readTextField(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function isUsernameDuplicate(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("username");
  }

  return typeof target === "string" && target.includes("username");
}

async function setSessionCookie(token: string, maxAge = SESSION_COOKIE_MAX_AGE): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...SESSION_COOKIE_OPTIONS,
    maxAge,
  });
}

export async function loginAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = normalizeUsername(readTextField(formData, "username"));
  const password = readTextField(formData, "password");
  const attempt = beginLoginAttempt(username, readClientIp(await headers()));

  if ("retryAfterMinutes" in attempt) {
    return { status: "error", message: `尝试次数过多，请 ${attempt.retryAfterMinutes} 分钟后再试。` };
  }

  const maxAge = formData.get("remember") === "on"
    ? REMEMBERED_SESSION_MAX_AGE
    : SESSION_COOKIE_MAX_AGE;
  let outcome: "failure" | "success" | "ignored" = "ignored";

  try {
    if (!username || passwordValidationMessage(password)) {
      outcome = "failure";
      return { status: "error", message: INVALID_LOGIN_MESSAGE };
    }

    const account = await getPrisma().user.findUnique({
      where: { username },
      select: { id: true, passwordHash: true },
    });

    if (!account?.passwordHash) {
      // Legacy accounts have no login credentials. Spend the same scrypt work
      // as a real verification so the generic response does not reveal this.
      await verifyDummyPassword(password);
      outcome = "failure";
      return { status: "error", message: INVALID_LOGIN_MESSAGE };
    }

    if (!(await verifyPassword(password, account.passwordHash))) {
      outcome = "failure";
      return { status: "error", message: INVALID_LOGIN_MESSAGE };
    }

    const token = await issueSession(account.id, maxAge);
    await setSessionCookie(token, maxAge);
    outcome = "success";
  } catch {
    return { status: "error", message: LOGIN_UNAVAILABLE_MESSAGE };
  } finally {
    attempt.finish(outcome);
  }

  redirect(safeAuthNext(formData.get("next")) ?? DEFAULT_AUTH_DESTINATION);
}

export async function registerAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rawUsername = readTextField(formData, "username");
  const password = readTextField(formData, "password");
  const confirmPassword = readTextField(formData, "confirmPassword");
  const username = normalizeUsername(rawUsername);
  const fieldErrors: AuthFieldErrors = {};

  if (!username) {
    fieldErrors.username = USERNAME_FORMAT_MESSAGE;
  }

  const passwordError = passwordValidationMessage(password);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  const confirmPasswordError = confirmPasswordValidationMessage(password, confirmPassword);
  if (confirmPasswordError) {
    fieldErrors.confirmPassword = confirmPasswordError;
  }

  if (!username || Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      fieldErrors,
    };
  }

  let token: string;

  try {
    const passwordHash = await hashPassword(password);
    token = await createAccountWithSession(username, passwordHash);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === DUPLICATE_KEY_CODE &&
      isUsernameDuplicate(error)
    ) {
      return {
        status: "error",
        fieldErrors: { username: USERNAME_TAKEN_MESSAGE },
      };
    }

    return { status: "error", message: REGISTER_UNAVAILABLE_MESSAGE };
  }

  await setSessionCookie(token);

  // Registration auto-logs in through the user/session transaction above.
  redirect(safeAuthNext(formData.get("next")) ?? DEFAULT_AUTH_DESTINATION);
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    await revokeSession(token);
  } catch {
    // Preserve the cookie so the browser remains signed in to the still-valid
    // database session, and let the existing app error boundary report failure.
    throw new Error(LOGOUT_UNAVAILABLE_MESSAGE);
  }

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });

  redirect("/login");
}
