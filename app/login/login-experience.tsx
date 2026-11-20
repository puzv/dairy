"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { AuthForm } from "@/components/auth-form";
import type { AuthAction } from "@/lib/auth-state";

import styles from "./login.module.css";

type Phase = "day" | "burning" | "dusk";
type SceneCommand = "ignite" | "reset" | "pause" | "play";
type SceneNotice = "ready" | "open" | "dusk";

const DESKTOP_QUERY = "(min-width: 760px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SCENE_URL = "/login-scene/scene.html";
const READY_TIMEOUT_MS = 2000;
const STUCK_TIMEOUT_MS = 3500;

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);

      return () => media.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function isSceneNotice(value: unknown): value is SceneNotice {
  return value === "ready" || value === "open" || value === "dusk";
}

export function LoginExperience({ action }: { action: AuthAction }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [phase, setPhase] = useState<Phase>("day");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [usingStaticDusk, setUsingStaticDusk] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sunRef = useRef<HTMLButtonElement>(null);
  const phaseRef = useRef<Phase>("day");
  const pausedRef = useRef(false);
  const awaitingIgniteRef = useRef(false);
  const sceneReadyRef = useRef(false);
  const modalOpenRef = useRef(false);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusSunAfterCloseRef = useRef(false);

  const postToScene = useCallback((event: SceneCommand) => {
    const frame = iframeRef.current;

    if (!frame?.contentWindow) {
      return;
    }

    try {
      frame.contentWindow.postMessage(
        { type: "journal-scene", event },
        window.location.origin,
      );
    } catch {
      // A torn-down iframe can disappear between the ref check and postMessage.
    }
  }, []);

  const clearSceneTimers = useCallback(() => {
    if (readyTimerRef.current !== null) {
      clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }

    if (stuckTimerRef.current !== null) {
      clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
  }, []);

  const showStaticDusk = useCallback(() => {
    if (phaseRef.current !== "burning") {
      return;
    }

    clearSceneTimers();
    awaitingIgniteRef.current = false;
    phaseRef.current = "dusk";
    setPhase("dusk");
    setUsingStaticDusk(true);
    setDialogOpen(true);
  }, [clearSceneTimers]);

  const finishClose = useCallback(() => {
    clearSceneTimers();
    awaitingIgniteRef.current = false;
    phaseRef.current = "day";
    setPhase("day");
    setUsingStaticDusk(false);
    setDialogOpen(false);
    postToScene("reset");
    focusSunAfterCloseRef.current =
      modalOpenRef.current && window.matchMedia(DESKTOP_QUERY).matches;
    modalOpenRef.current = false;
  }, [clearSceneTimers, postToScene]);

  const ignite = useCallback(() => {
    if (phaseRef.current !== "day") {
      return;
    }

    if (pausedRef.current || prefersReducedMotion) {
      clearSceneTimers();
      awaitingIgniteRef.current = false;
      phaseRef.current = "dusk";
      setPhase("dusk");
      setUsingStaticDusk(true);
      setDialogOpen(true);
      return;
    }

    phaseRef.current = "burning";
    setPhase("burning");
    setUsingStaticDusk(false);
    awaitingIgniteRef.current = !sceneReadyRef.current;
    postToScene("ignite");

    clearSceneTimers();
    readyTimerRef.current = setTimeout(() => {
      readyTimerRef.current = null;

      if (!sceneReadyRef.current && phaseRef.current === "burning") {
        showStaticDusk();
      }
    }, READY_TIMEOUT_MS);
    stuckTimerRef.current = setTimeout(() => {
      stuckTimerRef.current = null;

      if (phaseRef.current === "burning") {
        showStaticDusk();
      }
    }, STUCK_TIMEOUT_MS);
  }, [clearSceneTimers, postToScene, prefersReducedMotion, showStaticDusk]);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;

    pausedRef.current = next;
    setPaused(next);
    postToScene(next ? "pause" : "play");
  }, [postToScene]);

  const handleFrameLoad = useCallback(() => {
    if (awaitingIgniteRef.current && phaseRef.current === "burning") {
      postToScene("ignite");
    }

    if (pausedRef.current && phaseRef.current === "day") {
      postToScene("pause");
    }
  }, [postToScene]);

  const handleDialogClose = useCallback(() => {
    finishClose();
  }, [finishClose]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;

      if (event.origin !== window.location.origin) {
        return;
      }

      if (!frame || event.source !== frame.contentWindow) {
        return;
      }

      const data = event.data as {
        type?: unknown;
        event?: unknown;
      } | null;

      if (!data || data.type !== "journal-scene" || !isSceneNotice(data.event)) {
        return;
      }

      if (data.event === "ready") {
        sceneReadyRef.current = true;

        if (readyTimerRef.current !== null) {
          clearTimeout(readyTimerRef.current);
          readyTimerRef.current = null;
        }

        if (awaitingIgniteRef.current && phaseRef.current === "burning") {
          awaitingIgniteRef.current = false;
          postToScene("ignite");
        } else if (pausedRef.current && phaseRef.current === "day") {
          postToScene("pause");
        }

        return;
      }

      if (phaseRef.current === "day") {
        return;
      }

      if (data.event === "open") {
        if (phaseRef.current === "burning") {
          sceneReadyRef.current = true;

          if (readyTimerRef.current !== null) {
            clearTimeout(readyTimerRef.current);
            readyTimerRef.current = null;
          }

          setDialogOpen(true);
        }

        return;
      }

      if (phaseRef.current === "burning" || phaseRef.current === "dusk") {
        clearSceneTimers();
        awaitingIgniteRef.current = false;
        phaseRef.current = "dusk";
        setPhase("dusk");
        setDialogOpen(true);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, [clearSceneTimers, isDesktop, postToScene]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);

    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        return;
      }

      const dialog = dialogRef.current;

      if (dialog?.open) {
        dialog.close();
      }

      modalOpenRef.current = false;
      clearSceneTimers();
      sceneReadyRef.current = false;
      awaitingIgniteRef.current = false;
      focusSunAfterCloseRef.current = false;
      phaseRef.current = "day";
      setPhase("day");
      setUsingStaticDusk(false);
      setDialogOpen(false);
    };

    media.addEventListener("change", handleBreakpointChange);

    return () => media.removeEventListener("change", handleBreakpointChange);
  }, [clearSceneTimers]);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (dialogOpen) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          return;
        }
      }

      modalOpenRef.current = true;
      dialog
        .querySelector<HTMLInputElement>("#auth-username")
        ?.focus({ preventScroll: true });

      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [dialogOpen, isDesktop]);

  useEffect(() => {
    if (
      !isDesktop ||
      dialogOpen ||
      phase !== "day" ||
      !focusSunAfterCloseRef.current
    ) {
      return;
    }

    focusSunAfterCloseRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      sunRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [dialogOpen, isDesktop, phase]);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);

    const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        postToScene("pause");
        return;
      }

      if (!pausedRef.current) {
        postToScene("play");
      }
    };

    media.addEventListener("change", handleMotionPreferenceChange);

    return () =>
      media.removeEventListener("change", handleMotionPreferenceChange);
  }, [postToScene]);

  useEffect(
    () => () => {
      clearSceneTimers();
    },
    [clearSceneTimers],
  );

  return (
    <main
      className={`${styles.shell} auth-shell login-shell`}
      data-phase={phase}
    >
      <div className={styles.mobileLayout}>
        <section
          className={`${styles.panel} auth-panel`}
          aria-labelledby="login-heading"
        >
          <div className={styles.cover}>
            <div className={styles.brand}>
              <span className={styles.seal} aria-hidden="true">
                山
              </span>
              <span className={styles.brandCopy}>
                <span className={styles.brandName}>山笺</span>
                <span className={styles.brandSub}>PRIVATE JOURNAL</span>
              </span>
            </div>
          </div>

          <div className={styles.page}>
            <div className={styles.card}>
              <header className={styles.heading}>
                <h1 id="login-heading">登录</h1>
              </header>

              {/* One persistent form so typed credentials survive breakpoints. */}
              <dialog
                ref={dialogRef}
                className={styles.loginDialog}
                data-modal={isDesktop && dialogOpen ? "true" : undefined}
                aria-labelledby={
                  isDesktop ? "login-dialog-title" : "login-heading"
                }
                open={!isDesktop}
                onClose={handleDialogClose}
              >
                <div className={styles.dialogContent}>
                  <span className={styles.sunHorizon} aria-hidden="true" />
                  <button
                    type="button"
                    className={styles.dialogClose}
                    aria-label="关闭登录"
                    onClick={() => dialogRef.current?.close()}
                  >
                    ×
                  </button>
                  <header className={styles.dialogHeading}>
                    <h1 id="login-dialog-title">登录山笺</h1>
                  </header>
                  <AuthForm mode="login" action={action} />
                </div>
              </dialog>
            </div>
          </div>
        </section>
      </div>

      <div
        className={styles.scene}
        data-phase={phase}
        data-fallback={usingStaticDusk ? "true" : "false"}
      >
        <div className={styles.poster} aria-hidden="true" />

        {isDesktop ? (
          <iframe
            ref={iframeRef}
            className={styles.frame}
            src={SCENE_URL}
            title="白日山水动效"
            aria-hidden="true"
            tabIndex={-1}
            onLoad={handleFrameLoad}
          />
        ) : null}

        <p className={styles.sceneBrand} aria-label="山笺">
          山笺
        </p>

        <button
          ref={sunRef}
          type="button"
          className={styles.sunTrigger}
          data-testid="login-sun"
          data-phase={phase}
          aria-label="登录，点燃日轮展开暮色画卷"
          onClick={ignite}
        >
          <span className={styles.sunLabel} aria-hidden="true">
            登录
          </span>
        </button>

        {!prefersReducedMotion ? (
          <button
            type="button"
            className={styles.motionToggle}
            data-state={paused ? "paused" : "playing"}
            aria-label={paused ? "继续动效" : "暂停动效"}
            aria-pressed={paused}
            onClick={togglePause}
          >
            <span className={styles.motionIcon} aria-hidden="true">
              <svg
                className={styles.motionIconPause}
                viewBox="0 0 12 12"
                focusable="false"
              >
                <rect x="2.2" y="1.4" width="2.5" height="9.2" rx="0.7" />
                <rect x="7.3" y="1.4" width="2.5" height="9.2" rx="0.7" />
              </svg>
              <svg
                className={styles.motionIconPlay}
                viewBox="0 0 12 12"
                focusable="false"
              >
                <path d="M3 1.5a.8.8 0 0 1 1.2-.7l6 4.5a.8.8 0 0 1 0 1.4l-6 4.5A.8.8 0 0 1 3 10.5z" />
              </svg>
            </span>
            <span>{paused ? "继续" : "暂停"}</span>
          </button>
        ) : null}
      </div>
    </main>
  );
}
