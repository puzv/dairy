"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { AuthForm } from "@/components/auth-form";
import { EditionPicker, useEdition } from "@/components/edition/edition";
import type { AuthAction, AuthMode } from "@/lib/auth-state";

import styles from "./edition-auth.module.css";

type EditionAuthProps = {
  initialMode: AuthMode;
  loginAction: AuthAction;
  registerAction: AuthAction;
  next: string | null;
  children: ReactNode;
};

export function EditionAuth({ initialMode, loginAction, registerAction, next, children }: EditionAuthProps) {
  const { edition } = useEdition();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [terminalOpen, setTerminalOpen] = useState(initialMode === "register");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextFocus = useRef<"heading" | "trigger" | null>(null);

  useEffect(() => {
    if (nextFocus.current === "trigger") triggerRef.current?.focus();
    if (nextFocus.current === "heading") headingRef.current?.focus();
    nextFocus.current = null;
  }, [mode, terminalOpen]);

  const isMountain = edition === "shanjian";
  const isTech = edition === "tech";
  const showForm = !isTech || terminalOpen;
  const isRegister = mode === "register";

  function toggleTerminal(open: boolean) {
    nextFocus.current = open ? "heading" : "trigger";
    setTerminalOpen(open);
  }

  function switchMode() {
    nextFocus.current = "heading";
    setMode(isRegister ? "login" : "register");
  }

  return (
    <div
      className={isMountain ? styles.mountain : styles.edition}
      data-auth-edition={edition}
      data-route={initialMode}
      data-terminal-open={isTech && terminalOpen}
    >
      <header className={isMountain ? styles.mountainPicker : styles.header}>
        {!isMountain && <span className={styles.wordmark}>山笺</span>}
        <EditionPicker />
      </header>
      {isMountain ? children : (
        <main className={styles.spread}>
          <div className={styles.photograph} aria-hidden="true" />
          <div className={styles.content}>
            {!showForm && (
              <div className={styles.launcher}>
                <h1>私人日记</h1>
                <button
                  ref={triggerRef}
                  type="button"
                  className={styles.connect}
                  aria-controls="edition-auth-panel"
                  aria-expanded={false}
                  onClick={() => toggleTerminal(true)}
                >
                  打开认证终端 <span aria-hidden="true">↗</span>
                </button>
              </div>
            )}
            <section
              id="edition-auth-panel"
              className={styles.formPanel}
              aria-labelledby="edition-auth-title"
              hidden={!showForm}
              onKeyDown={(event) => {
                if (isTech && event.key === "Escape" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  toggleTerminal(false);
                }
              }}
            >
              {showForm && (
                <>
                  {isTech && (
                    <div className={styles.terminalBar}>
                      <span>认证终端</span>
                      <button type="button" aria-label="收起认证终端" onClick={() => toggleTerminal(false)}>×</button>
                    </div>
                  )}
                  <h1 id="edition-auth-title" ref={headingRef} tabIndex={-1}>
                    {isRegister ? "创建账号" : "登录山笺"}
                  </h1>
                  <AuthForm
                    key={mode}
                    mode={mode}
                    action={isRegister ? registerAction : loginAction}
                    next={next}
                    onSwitchMode={switchMode}
                  />
                </>
              )}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
