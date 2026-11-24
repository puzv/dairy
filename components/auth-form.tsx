"use client";

import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  type ComponentProps,
  useActionState,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { authPageHref } from "@/lib/auth-next";
import {
  confirmPasswordValidationMessage,
  passwordValidationMessage,
  usernameValidationMessage,
} from "@/lib/auth-rules";
import type { AuthAction, AuthFieldErrors, AuthMode, AuthState } from "@/lib/auth-state";
import { initialAuthState } from "@/lib/auth-state";

type AuthFormProps = {
  mode: AuthMode;
  action: AuthAction;
  next: string | null;
  enhanced?: boolean;
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

type PasswordFieldProps = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  capsLock: boolean;
  enhanced: boolean;
};

function PasswordField({ id, label, capsLock, enhanced, onBlur, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selection = useRef<{
    start: number;
    end: number;
    direction: "forward" | "backward" | "none";
  } | null>(null);
  const showCapsLock = focused && capsLock;

  useLayoutEffect(() => {
    if (selection.current) {
      const { start, end, direction } = selection.current;
      input.current?.setSelectionRange(start, end, direction);
      selection.current = null;
    }
  }, [visible]);

  function toggleVisibility() {
    const field = input.current;
    if (field && field.selectionStart !== null && field.selectionEnd !== null) {
      selection.current = {
        start: field.selectionStart,
        end: field.selectionEnd,
        direction: field.selectionDirection ?? "none",
      };
    }
    setVisible((value) => !value);
  }

  if (!enhanced) return <Input {...props} id={id} type="password" />;

  return (
    <>
      <div className="auth-password-field">
        <Input
          {...props}
          ref={input}
          id={id}
          className="auth-password-control"
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={`${visible ? "隐藏" : "显示"}${label}`}
          aria-controls={id}
          disabled={props.disabled}
          onMouseDown={(event) => {
            if (document.activeElement === input.current) event.preventDefault();
          }}
          onClick={toggleVisibility}
        >
          {visible ? "隐藏" : "显示"}
        </button>
      </div>
      <span className="sr-only" role="status">
        {showCapsLock ? "大写锁定已开启" : ""}
      </span>
      {showCapsLock ? <p className="auth-caps-lock" aria-hidden="true">大写锁定已开启</p> : null}
    </>
  );
}

function readInput(form: HTMLFormElement | null, name: string): string {
  const input = form?.elements.namedItem(name);
  return input instanceof HTMLInputElement ? input.value : "";
}

export function AuthForm({ mode, action, next, enhanced = false, onSwitchMode }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    initialAuthState,
  );
  const [capsLock, setCapsLock] = useState(false);
  const [feedback, setFeedback] = useState<{
    actionState: AuthState;
    fields: AuthFieldErrors;
  }>();
  const copy = COPY[mode];
  const isRegister = mode === "register";
  const fieldErrors = enhanced && feedback?.actionState === state
    ? { ...state.fieldErrors, ...feedback.fields }
    : state.fieldErrors;
  const usernameError = fieldErrors?.username;
  const passwordError = fieldErrors?.password;
  const confirmPasswordError = isRegister
    ? fieldErrors?.confirmPassword
    : undefined;
  const fieldErrorMessage = [usernameError, passwordError, confirmPasswordError]
    .filter(Boolean)
    .join(" ");
  const message =
    state.status === "error" ? state.message : undefined;
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

  function updateFeedback(fields: AuthFieldErrors) {
    setFeedback((current) => ({
      actionState: state,
      fields: { ...(current?.actionState === state ? current.fields : {}), ...fields },
    }));
  }

  function trackCapsLock(event: { getModifierState(key: string): boolean }) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  return (
    <>
      <form
        action={formAction}
        className="auth-form"
        data-mode={mode}
        aria-busy={pending}
        onKeyDownCapture={enhanced ? trackCapsLock : undefined}
        onKeyUpCapture={enhanced ? trackCapsLock : undefined}
        onPointerDownCapture={enhanced ? trackCapsLock : undefined}
        noValidate
      >
        <input type="hidden" name="next" value={next ?? ""} />
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
            onChange={enhanced ? () => updateFeedback({ username: undefined }) : undefined}
            onBlur={enhanced ? (event) => updateFeedback({
              username: usernameValidationMessage(event.currentTarget.value) ?? undefined,
            }) : undefined}
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
          <PasswordField
            id="auth-password"
            name="password"
            label="密码"
            capsLock={capsLock}
            enhanced={enhanced}
            autoComplete={copy.autoComplete}
            required
            disabled={pending}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordDescribedBy}
            onChange={enhanced ? () => updateFeedback(isRegister
              ? { password: undefined, confirmPassword: undefined }
              : { password: undefined }) : undefined}
            onBlur={(event) => {
              const { form, value } = event.currentTarget;
              const confirmation = readInput(form, "confirmPassword");
              updateFeedback({
                password: passwordValidationMessage(value) ?? undefined,
                ...(isRegister && confirmation ? {
                  confirmPassword: confirmPasswordValidationMessage(value, confirmation) ?? undefined,
                } : {}),
              });
            }}
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
            <PasswordField
              id="auth-confirm-password"
              name="confirmPassword"
              label="确认密码"
              capsLock={capsLock}
              enhanced={enhanced}
              autoComplete="new-password"
              required
              disabled={pending}
              aria-invalid={Boolean(confirmPasswordError)}
              aria-describedby={confirmPasswordDescribedBy}
              onChange={enhanced ? () => updateFeedback({ confirmPassword: undefined }) : undefined}
              onBlur={(event) => updateFeedback({
                confirmPassword: confirmPasswordValidationMessage(
                  readInput(event.currentTarget.form, "password"),
                  event.currentTarget.value,
                ) ?? undefined,
              })}
            />
            {confirmPasswordError ? (
              <p className="field-error" id="auth-confirm-password-error">
                {confirmPasswordError}
              </p>
            ) : null}
          </div>
        ) : enhanced ? (
          <label className="auth-remember">
            <input type="checkbox" name="remember" disabled={pending} />
            保持登录 30 天
          </label>
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
          <Link href={authPageHref(copy.switchHref, next)}>{copy.switchLabel}</Link>
        )}
      </p>
    </>
  );
}
