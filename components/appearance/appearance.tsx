"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AppearancePanel } from "./panel";
import { usePreferences } from "./use-preferences";

type OpenPanel = { outlet: HTMLElement; trigger: HTMLButtonElement; route: string; closing: boolean };
const Controls = createContext<{ opened: boolean; toggle: (button: HTMLButtonElement) => void } | null>(null);

function findOutlet(): HTMLElement | null {
  const visible = [...document.querySelectorAll<HTMLElement>(".appearance-spread > [data-appearance-outlet]")]
    .find(node => node.previousElementSibling?.getClientRects().length);
  if (visible && getComputedStyle(visible).getPropertyValue("--appearance-dock").trim() === "side") return visible;
  return document.querySelector("[data-appearance-fallback]");
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const route = usePathname();
  const shell = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<OpenPanel | null>(null);
  const shown = panel?.route === route && panel.outlet.isConnected;
  const settings = usePreferences(shell);
  const previousPaper = useRef<{ node: HTMLElement; rect: DOMRect } | null>(null);
  const paperMotion = useRef<Animation | null>(null);

  // Measure the old and new layouts once. Only the painted paper moves between them.
  function measurePaper(outlet: HTMLElement) {
    const node = outlet.previousElementSibling;
    previousPaper.current = outlet.hasAttribute("data-appearance-outlet") && node instanceof HTMLElement && typeof node.animate === "function" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches ? { node, rect: node.getBoundingClientRect() } : null;
    paperMotion.current?.cancel();
  }

  useLayoutEffect(() => {
    const before = previousPaper.current;
    previousPaper.current = null;
    if (!before?.node.isConnected) return;
    const after = before.node.getBoundingClientRect();
    if (!after.width) return;
    const dx = before.rect.left - after.left;
    const dy = before.rect.top - after.top;
    const scale = before.rect.width / after.width;
    if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(before.rect.width - after.width) < .5) return;
    try {
      paperMotion.current = before.node.animate([
        { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scaleX(${scale})` },
        { transformOrigin: "0 0", transform: "none" },
      ], { duration: 220, easing: "cubic-bezier(.22,.68,.25,1)" });
    } catch {
      // The browser can decline the animation. The final layout is already in place.
    }
  }, [panel?.outlet]);

  const close = useCallback(() => {
    if (!panel || panel.closing) return;
    panel.trigger.focus({ preventScroll: true });
    setPanel({ ...panel, closing: true });
  }, [panel]);

  const finishClose = useCallback(() => {
    if (!panel?.closing) return;
    measurePaper(panel.outlet);
    setPanel(null);
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    function reconcile() {
      if (panel && (panel.route !== route || !panel.trigger.getClientRects().length || panel.outlet !== findOutlet())) setPanel(null);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("dialog[open]")) close();
    }
    function navigate(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("a[href]") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) setPanel(null);
    }
    function dismiss() { setPanel(null); }
    reconcile();
    window.addEventListener("resize", reconcile);
    window.addEventListener("popstate", dismiss);
    window.addEventListener("keydown", key);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("resize", reconcile);
      window.removeEventListener("popstate", dismiss);
      window.removeEventListener("keydown", key);
      document.removeEventListener("click", navigate, true);
    };
  }, [close, panel, route]);

  function toggle(trigger: HTMLButtonElement) {
    if (shown && !panel.closing) { close(); return; }
    const outlet = findOutlet();
    if (!outlet) return;
    if (!shown || panel.outlet !== outlet) measurePaper(outlet);
    setPanel({ outlet, trigger, route, closing: false });
  }

  const opened = Boolean(shown && !panel.closing);
  return (
    <Controls.Provider value={{ opened, toggle }}>
      <div className="app-shell" ref={shell}>{children}</div>
      {shown && createPortal(<AppearancePanel settings={settings} close={close} closing={panel.closing} onClosed={finishClose} />, panel.outlet)}
    </Controls.Provider>
  );
}

export function AppearanceTrigger() {
  const controls = useContext(Controls);
  if (!controls) throw new Error("AppearanceTrigger requires the journal layout.");
  const { opened, toggle } = controls;
  return (
    <button type="button" className="appearance-trigger" aria-expanded={opened}
      aria-controls={opened ? "journal-appearance-panel" : undefined} onClick={event => toggle(event.currentTarget)}>
      <span aria-hidden="true" className="appearance-trigger-mark" />外观
    </button>
  );
}
