import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

import { EntryForm } from "@/components/entry-form";
import { createEntryAction } from "@/lib/actions/entries";
import { requireUser } from "@/lib/auth";
import "../../timeline/journal-fold.css";
import styles from "./writing-desk.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "写今天",
};

export default async function NewEntryPage() {
  await requireUser();

  return (
    <main className={styles.desk} data-writing-desk>
      <section className={styles.sheet} data-writing-sheet aria-labelledby="writing-heading">
        <div className={styles.leaf}>
          <div className={`page-heading ${styles.heading}`}>
            <span className={styles.seal} aria-hidden="true">山</span>
            <h1 id="writing-heading">写日记</h1>
          </div>
          <div className={`editor-card ${styles.card}`}>
            <EntryForm mode="create" action={createEntryAction} />
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
          data-writing-cover
        >
          <span className="journal-cover-window" aria-hidden="true">
            <span className="journal-cover-scenery" />
          </span>
          <span className={styles.imprint}>山笺</span>
          <span className="journal-cover-title">我的日记</span>
          <span className="journal-cover-link"><span aria-hidden="true">←</span> 返回目录</span>
        </Link>
      </ViewTransition>
    </main>
  );
}
