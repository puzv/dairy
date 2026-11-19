"use server";

import { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
  createAccountWithSession,
  hashPassword,
  issueSession,
  normalizeUsername,
  passwordValidationMessage,
  revokeSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  verifyDummyPassword,
  verifyPassword,
} from "@/lib/auth";
import type { AuthFieldErrors, AuthState } from "@/lib/auth-state";
import { isLocalDeveloperRequest } from "@/lib/local-host";
import { getPrisma } from "@/lib/prisma";

const INVALID_LOGIN_MESSAGE = "用户名或密码不正确。";
const LOGIN_UNAVAILABLE_MESSAGE = "登录暂时没有完成，请稍后再试。";
const REGISTER_UNAVAILABLE_MESSAGE = "注册暂时没有完成，请稍后再试。";
const LOGOUT_UNAVAILABLE_MESSAGE = "退出登录暂时没有完成，请稍后再试。";
const USERNAME_TAKEN_MESSAGE = "这个用户名已被使用，请换一个。";
const USERNAME_FORMAT_MESSAGE = "用户名需为 3–32 位小写字母、数字或下划线。";
const DUPLICATE_KEY_CODE = "P2002";

async function requireLocalRequest(): Promise<void> {
  const requestHeaders = await headers();

  // Every auth action checks loopback independently; the proxy is only an
  // earlier layer and is never treated as authorization.
  if (!isLocalDeveloperRequest(requestHeaders.get("host"))) {
    notFound();
  }
}

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

async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...SESSION_COOKIE_OPTIONS,
  });
}

export async function loginAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  await requireLocalRequest();

  const username = normalizeUsername(readTextField(formData, "username"));
  const password = readTextField(formData, "password");
  const passwordError = passwordValidationMessage(password);

  if (!username || passwordError) {
    return { status: "error", message: INVALID_LOGIN_MESSAGE };
  }

  let token: string;

  try {
    const account = await getPrisma().user.findUnique({
      where: { username },
      select: { id: true, passwordHash: true },
    });

    if (!account?.passwordHash) {
      // Legacy accounts have no login credentials. Spend the same scrypt work
      // as a real verification so the generic response does not reveal this.
      await verifyDummyPassword(password);
      return { status: "error", message: INVALID_LOGIN_MESSAGE };
    }

    if (!(await verifyPassword(password, account.passwordHash))) {
      return { status: "error", message: INVALID_LOGIN_MESSAGE };
    }

    token = await issueSession(account.id);
  } catch {
    return { status: "error", message: LOGIN_UNAVAILABLE_MESSAGE };
  }

  await setSessionCookie(token);

  // Fixed destination: no caller-controlled return URL can be supplied.
  redirect("/timeline");
}

export async function registerAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  await requireLocalRequest();

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

  if (!confirmPassword) {
    fieldErrors.confirmPassword = "请再次输入密码。";
  } else if (confirmPassword !== password) {
    fieldErrors.confirmPassword = "两次输入的密码不一致。";
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
  redirect("/timeline");
}

export async function logoutAction(): Promise<void> {
  await requireLocalRequest();

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
