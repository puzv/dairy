"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

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

type MinimalAuthProps = Omit<EditionAuthProps, "children" | "initialMode"> & {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function MinimalAuth({ mode, loginAction, registerAction, next, onModeChange }: MinimalAuthProps) {
  const [leavingMode, setLeavingMode] = useState<AuthMode | null>(null);
  const [revision, setRevision] = useState(0);
  const stageRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Undefined means no switch was requested; null means switch without motion.
  const previousHeight = useRef<number | null | undefined>(undefined);

  function switchMode() {
    const stage = stageRef.current;
    const animate = stage && typeof stage.animate === "function" && !window.matchMedia(REDUCED_MOTION).matches;
    previousHeight.current = animate ? stage.getBoundingClientRect().height : null;
    setLeavingMode(animate ? mode : null);
    setRevision((value) => value + 1);
    onModeChange(mode === "login" ? "register" : "login");
  }

  useLayoutEffect(() => {
    const height = previousHeight.current;
    if (height === undefined) return;
    previousHeight.current = undefined;
    headingRef.current?.focus();

    const stage = stageRef.current;
    const active = activeRef.current;
    const leaving = leavingRef.current;
    if (height === null || !stage || !active || !leaving) return;

    const motion = window.matchMedia(REDUCED_MOTION);
    if (motion.matches) {
      queueMicrotask(() => setLeavingMode(null));
      return;
    }

    const tokens = getComputedStyle(stage);
    const easing = tokens.getPropertyValue("--m-ease").trim();
    const duration = Number.parseFloat(tokens.getPropertyValue("--m-base"));
    const exitDuration = Number.parseFloat(tokens.getPropertyValue("--m-exit"));
    const resize = stage.animate(
      [{ height: `${height}px` }, { height: `${active.getBoundingClientRect().height}px` }],
      { duration, easing },
    );
    const enter = active.animate(
      [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
      { duration, easing },
    );
    const exit = leaving.animate([{ opacity: 1 }, { opacity: 0 }], { duration: exitDuration, easing, fill: "forwards" });

    function cancelAnimations() {
      resize.cancel();
      enter.cancel();
      exit.cancel();
    }

    function handleMotionChange() {
      if (!motion.matches) return;
      cancelAnimations();
      setLeavingMode(null);
    }

    void exit.finished.then(() => setLeavingMode(null), () => { /* A newer switch cancelled the exit. */ });
    motion.addEventListener("change", handleMotionChange);
    return () => {
      motion.removeEventListener("change", handleMotionChange);
      cancelAnimations();
    };
  }, [mode]);

  const panels = [{ mode, revision, active: true }];
  if (leavingMode) panels.unshift({ mode: leavingMode, revision: revision - 1, active: false });

  return (
    <main data-minimal-auth-column>
      <div data-minimal-auth-brand>
        <p>山笺</p>
        <p>把日子写下来</p>
      </div>
      <section ref={stageRef} data-minimal-auth-stage aria-labelledby={`minimal-auth-title-${mode}`}>
        {panels.map(({ mode: panelMode, revision: key, active }) => (
          <div
            key={key}
            ref={active ? activeRef : leavingRef}
            data-minimal-auth-leaving={!active || undefined}
            inert={!active}
            aria-hidden={!active || undefined}
          >
            <h1 id={`minimal-auth-title-${panelMode}`} ref={active ? headingRef : undefined} tabIndex={-1}>
              {panelMode === "register" ? "创建账号" : "登录"}
            </h1>
            <AuthForm
              mode={panelMode}
              action={panelMode === "register" ? registerAction : loginAction}
              next={next}
              onSwitchMode={switchMode}
              enhanced
              minimal
            />
          </div>
        ))}
      </section>
    </main>
  );
}

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
  const isMinimal = edition === "minimal";
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
      className={isMountain ? styles.mountain : isTech ? styles.edition : undefined}
      data-auth-edition={edition}
      data-route={initialMode}
      data-terminal-open={isTech && terminalOpen}
    >
      <header className={isMountain ? styles.mountainPicker : isTech ? styles.header : undefined} data-minimal-auth-picker={isMinimal || undefined}>
        {isTech && <span className={styles.wordmark}>山笺</span>}
        <EditionPicker />
      </header>
      {isMountain ? children : isMinimal ? (
        <MinimalAuth mode={mode} onModeChange={setMode} loginAction={loginAction} registerAction={registerAction} next={next} />
      ) : (
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
