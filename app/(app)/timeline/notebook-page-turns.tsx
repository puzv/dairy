"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

import { useEdition } from "@/components/edition/edition";
import styles from "./timeline.module.css";

type Neighbor = { title: string; href: string } | null;

export function NotebookPageTurns({ selectedId, previous, next }: { selectedId: string; previous: Neighbor; next: Neighbor }) {
  const { edition } = useEdition();
  const minimal = edition === "minimal";
  const pager = useRef<HTMLElement>(null);
  const pageTurn = useRef<{ from: string; focus: Element | null } | null>(null);

  useLayoutEffect(() => {
    const turn = pageTurn.current;
    if (!turn || turn.from === selectedId) return;
    pageTurn.current = null;
    const focused = document.activeElement;
    if (focused === turn.focus || focused === document.body) {
      pager.current?.closest("[data-journal-reader]")
        ?.querySelector<HTMLElement>("[data-notebook-reading-title]")?.focus({ preventScroll: true });
    }
  }, [selectedId]);

  function markPageTurn() {
    pageTurn.current = { from: selectedId, focus: document.activeElement };
  }

  if (!previous && !next) return null;
  return (
    <nav ref={pager} className={`hidden ${styles.pageTurns}`} aria-label="相邻日记" data-minimal-page-turns={minimal ? "" : undefined}>
      {previous && <Link rel="prev" href={previous.href} prefetch={false} scroll={false}
        transitionTypes={minimal ? ["minimal-read"] : undefined} onNavigate={markPageTurn}>
        <span>← 上一篇</span><strong>{previous.title}</strong>
      </Link>}
      {next && <Link rel="next" href={next.href} prefetch={false} scroll={false}
        transitionTypes={minimal ? ["minimal-read"] : undefined} onNavigate={markPageTurn}>
        <span>下一篇 →</span><strong>{next.title}</strong>
      </Link>}
    </nav>
  );
}
