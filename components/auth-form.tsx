"use client";

import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useActionState } from "react";

import type { AuthAction, AuthState } from "@/lib/auth-state";
import { initialAuthState } from "@/lib/auth-state";

type AuthFormProps = {
  mode: "login" | "register";
  action: AuthAction;
  onSwitchMode?: () => void;
};

const COPY = {
  login: {
    submit: "进入日记",
    pending: "正在登录…",
    usernameHint: "3–32 位小写字母、数字或下划线。",
    passwordHint: "8–128 个字符，区分大小写，不会自动去掉空格。",
    autoComplete: "current-password",
    switchText: "还没有账号？",
    switchLabel: "创建一个",
    switchHref: "/register",
  },
  register: {
    submit: "创建并进入",
    pending: "正在创建…",
    usernameHint: "3–32 位小写字母、数字或下划线，注册后不可更改。",
    passwordHint: "8–128 个字符，不会自动去掉空格，请自行记好。",
    autoComplete: "new-password",
    switchText: "已经有账号？",
    switchLabel: "返回登录",
    switchHref: "/login",
  },
} as const;

export function AuthForm({ mode, action, onSwitchMode }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    initialAuthState,
  );
  const copy = COPY[mode];
  const isRegister = mode === "register";
  const usernameError = state.fieldErrors?.username;
  const passwordError = state.fieldErrors?.password;
  const confirmPasswordError = isRegister
    ? state.fieldErrors?.confirmPassword
    : undefined;
  const fieldErrorMessage = [usernameError, passwordError, confirmPasswordError]
    .filter(Boolean)
    .join(" ");
  const message =
    state.status === "error" && !fieldErrorMessage ? state.message : undefined;
  const usernameDescribedBy = [
    "auth-username-hint",
    usernameError ? "auth-username-error" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const passwordDescribedBy = [
    "auth-password-hint",
    passwordError ? "auth-password-error" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const confirmPasswordDescribedBy = confirmPasswordError
    ? "auth-confirm-password-error"
    : undefined;

  return (
    <>
      <form
        action={formAction}
        className="auth-form"
        data-mode={mode}
        aria-busy={pending}
        noValidate
      >
        {fieldErrorMessage ? (
          <p className="sr-only" role="alert">
            {fieldErrorMessage}
          </p>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="auth-username">
            用户名
          </label>
          <Input
            id="auth-username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={pending}
            aria-invalid={Boolean(usernameError)}
            aria-describedby={usernameDescribedBy}
          />
          <p className="field-hint" id="auth-username-hint">
            {copy.usernameHint}
          </p>
          {usernameError ? (
            <p className="field-error" id="auth-username-error">
              {usernameError}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="auth-password">
            密码
          </label>
          <Input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={copy.autoComplete}
            required
            disabled={pending}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordDescribedBy}
          />
          <p className="field-hint" id="auth-password-hint">
            {copy.passwordHint}
          </p>
          {passwordError ? (
            <p className="field-error" id="auth-password-error">
              {passwordError}
            </p>
          ) : null}
        </div>

        {isRegister ? (
          <div className="field">
            <label className="field-label" htmlFor="auth-confirm-password">
              确认密码
            </label>
            <Input
              id="auth-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              disabled={pending}
              aria-invalid={Boolean(confirmPasswordError)}
              aria-describedby={confirmPasswordDescribedBy}
            />
            {confirmPasswordError ? (
              <p className="field-error" id="auth-confirm-password-error">
                {confirmPasswordError}
              </p>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p
            className="form-alert auth-inline-alert"
            id="auth-error"
            role="alert"
          >
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          className="button-primary auth-submit"
          disabled={pending}
        >
          {pending ? copy.pending : copy.submit}
        </button>
      </form>

      <p className="auth-switch">
        {copy.switchText}
        {onSwitchMode ? (
          <button type="button" onClick={onSwitchMode} disabled={pending}>
            {copy.switchLabel}
          </button>
        ) : (
          <Link href={copy.switchHref}>{copy.switchLabel}</Link>
        )}
      </p>
    </>
  );
}
