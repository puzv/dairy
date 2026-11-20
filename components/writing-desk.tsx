import type { ReactNode } from "react";
import Link from "next/link";
import { ViewTransition } from "react";

import { AppearanceTrigger } from "@/components/appearance/appearance";
import "@/app/(app)/timeline/journal-fold.css";
import styles from "@/app/(app)/entries/new/writing-desk.module.css";

export function WritingDesk({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.desk} data-writing-desk>
      <section className={styles.sheet} data-writing-sheet aria-labelledby="writing-heading">
        <div className={styles.leaf} data-writing-leaf>
          <div className={`page-heading ${styles.heading}`}>
            <span className={styles.seal} aria-hidden="true">山</span>
            <h1 id="writing-heading">{title}</h1>
            <div className={styles.appearanceControl}><AppearanceTrigger /></div>
          </div>
          <div className="appearance-spread">
            <div className={`journal-paper editor-card ${styles.card}`}>
              {children}
            </div>
            <div data-appearance-outlet="" />
          </div>
        </div>
      </section>
      <ViewTransition
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
      </ViewTransition>
    </main>
  );
}
