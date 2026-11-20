"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AppearancePanel } from "./panel";
import { usePreferences } from "./use-preferences";

type OpenPanel = { outlet: HTMLElement; trigger: HTMLButtonElement; route: string };
const Controls = createContext<{ opened: boolean; toggle: (button: HTMLButtonElement) => void } | null>(null);

function findOutlet(): HTMLElement | null {
  const visible = [...document.querySelectorAll<HTMLElement>(".appearance-spread > [data-appearance-outlet]")]
    .find(node => node.parentElement?.firstElementChild?.getClientRects().length);
  return visible ?? document.querySelector("[data-appearance-fallback]");
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const route = usePathname();
  const shell = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<OpenPanel | null>(null);
  const open = panel?.route === route && panel.outlet.isConnected;
  const settings = usePreferences(shell);

  const close = useCallback((restoreFocus = true) => {
    if (restoreFocus) panel?.trigger.focus({ preventScroll: true });
    setPanel(null);
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    function reconcile() {
      if (!panel) return;
      if (panel.route !== route || !panel.trigger.getClientRects().length || !panel.outlet.isConnected) setPanel(null);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) close();
    }
    function navigate(event: MouseEvent) {
      if (event.target instanceof Element && event.target.closest("a[href]") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) close(false);
    }
    reconcile();
    window.addEventListener("resize", reconcile);
    window.addEventListener("keydown", key);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("resize", reconcile);
      window.removeEventListener("keydown", key);
      document.removeEventListener("click", navigate, true);
    };
  }, [close, panel, route]);

  function toggle(trigger: HTMLButtonElement) {
    if (open) { close(); return; }
    const outlet = findOutlet();
    if (outlet) setPanel({ outlet, trigger, route });
  }

  return (
    <Controls.Provider value={{ opened: Boolean(open), toggle }}>
      <div className="app-shell" ref={shell}>{children}</div>
      {open && createPortal(<AppearancePanel settings={settings} close={close} />, panel.outlet)}
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
