"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, ViewTransition, type ReactNode } from "react";

import { AppearanceTrigger } from "@/components/appearance/appearance";
import { NonMinimalControls, useEdition } from "@/components/edition/edition";
import "@/app/(app)/timeline/journal-fold.css";
import styles from "@/app/(app)/entries/new/writing-desk.module.css";

function MinimalWritingTools() {
  const focused = useSearchParams().get("focus") === "1";
  const tools = useRef<HTMLDivElement>(null);

  function changeFocus(value: boolean) {
    const url = new URL(location.href);
    if (value) url.searchParams.set("focus", "1");
    else url.searchParams.delete("focus");
    window.history.replaceState(null, "", url);
  }

  useLayoutEffect(() => {
    const root = document.documentElement;
    const row = tools.current;
    root.toggleAttribute("data-writing-focus", focused);
    if (!focused || !row) return;

    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing &&
        !document.querySelector("dialog[open], [aria-expanded='true']")) changeFocus(false);
    }
    const reveal = (event: PointerEvent) => {
      // Keep the tools revealed while crossing from the top edge to either control.
      const overTools = row.hasAttribute("data-focus-reveal") &&
        event.target instanceof Node && row.contains(event.target);
      row.toggleAttribute("data-focus-reveal", event.clientY < 64 || overTools);
    };
    function move(event: PointerEvent) {
      if (event.pointerType !== "touch") reveal(event);
    }
    function tap(event: PointerEvent) {
      if (event.pointerType === "touch") reveal(event);
    }
    const hide = () => row.removeAttribute("data-focus-reveal");

    window.addEventListener("keydown", escape);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerdown", tap);
    root.addEventListener("pointerleave", hide);
    return () => {
      root.removeAttribute("data-writing-focus");
      hide();
      window.removeEventListener("keydown", escape);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", tap);
      root.removeEventListener("pointerleave", hide);
    };
  }, [focused]);

  return (
    <div data-minimal-writing-tools ref={tools}>
      <Link href="/timeline" prefetch={true} transitionTypes={["return-journal"]}>← 目录</Link>
      <button data-writing-focus-control type="button" aria-pressed={focused} onClick={() => changeFocus(!focused)}>
        {focused ? "退出专注" : "专注"}
      </button>
    </div>
  );
}

export function WritingDesk({ title, children }: { title: string; children: ReactNode }) {
  const { edition } = useEdition();
  const minimal = edition === "minimal";

  return (
    <main className={minimal ? undefined : styles.desk} data-writing-desk data-minimal-writing={minimal ? "" : undefined}>
      {minimal && <MinimalWritingTools />}
      <section className={minimal ? undefined : styles.sheet} data-writing-sheet aria-labelledby="writing-heading">
        <div className={minimal ? undefined : styles.leaf} data-writing-leaf>
          {minimal ? (
            <h1 id="writing-heading" className="sr-only">{title}</h1>
          ) : (
            <div className={`page-heading ${styles.heading}`}>
              <span className={styles.seal} aria-hidden="true">山</span>
              <h1 id="writing-heading">{title}</h1>
              <NonMinimalControls><div className={styles.appearanceControl}><AppearanceTrigger /></div></NonMinimalControls>
            </div>
          )}
          <div className="appearance-spread">
            <div className={minimal ? undefined : `journal-paper editor-card ${styles.card}`}
              data-minimal-paper={minimal ? "" : undefined}>
              {children}
            </div>
            {!minimal && <div data-appearance-outlet="" />}
          </div>
        </div>
      </section>
      {!minimal && <ViewTransition
        name="journal-cover"
        share={{ "write-journal": "auto", "return-journal": "auto", default: "none" }}
        default="none"
      >
        <Link
          href="/timeline"
          prefetch={true}
          transitionTypes={["return-journal"]}
          aria-label="返回日记目录"
          className={styles.cover}
          data-journal-cover
          data-writing-cover
        >
          <span className="journal-cover-window" aria-hidden="true">
            <span className="journal-cover-scenery" />
          </span>
          <span className={`journal-cover-imprint ${styles.imprint}`}>山笺</span>
          <span className="journal-cover-title">我的日记</span>
          <span className="journal-cover-link"><span aria-hidden="true">←</span> 返回目录</span>
        </Link>
      </ViewTransition>}
    </main>
  );
}
