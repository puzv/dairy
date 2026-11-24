"use client";

import { useEdition } from "@/components/edition/edition";
import type { NotebookItem, NotebookTab } from "@/lib/notebook-types";
import { NotebookBookmark, NotebookEntryActions } from "./notebook-entry-actions";
import { NotebookPageTurns } from "./notebook-page-turns";
import { NotebookReaderMotion } from "./notebook-reader-motion";
import styles from "./timeline.module.css";

type LabeledTime = { value: string; label: string };
type Neighbor = { title: string; href: string } | null;
type ReadingItem = Pick<NotebookItem, "id" | "kind" | "entryId" | "favorite" | "hasDraft" | "title" | "revised">;

export function NotebookReader({ item, tab, day, body, characters, date, timestamp, mood, solarTerm, previous, next }: {
  item: ReadingItem;
  tab: NotebookTab;
  day: string;
  body: string;
  characters: number;
  date: LabeledTime | null;
  timestamp: LabeledTime | null;
  mood: string | null;
  solarTerm: string | null;
  previous: Neighbor;
  next: Neighbor;
}) {
  const { edition } = useEdition();
  const minimal = edition === "minimal";
  const text = body || "这份草稿还没有正文。";
  const dateText = date ? <time dateTime={date.value}>{date.label}</time> : <span>日期待填</span>;
  const legacyTerm = item.kind === "entry" ? solarTerm : null;
  const timeLabel = item.kind === "draft" ? "保存于" : item.revised ? "修改于" : "写于";

  return (
    <NotebookReaderMotion>
      <article className={`journal-paper ${styles.spread}`} data-minimal-reading={minimal ? "" : undefined}>
        <div className={styles.meta} data-minimal-meta={minimal ? "" : undefined}>
          {minimal ? (
            <div>
              {dateText}
              {mood && <span>{" · "}{mood}</span>}
              {solarTerm && <span>{" · "}{solarTerm}</span>}
            </div>
          ) : (
            <>
              {date ? (
                <time dateTime={date.value}>
                  {date.label}
                  {legacyTerm && <span className={styles.solarTerm}>{" · "}{legacyTerm}</span>}
                </time>
              ) : dateText}
              {mood && <span className={styles.mood}>{mood}</span>}
            </>
          )}
          <NotebookBookmark item={item} tab={tab} minimal={minimal} />
        </div>
        <h2 className={styles.entryTitle} data-notebook-reading-title="" tabIndex={-1}>{item.title}</h2>
        <div className={`journal-prose ${styles.prose}`}>
          {minimal
            ? text.split(/(\r?\n(?:[^\S\r\n]*\r?\n)+)/).map((part, index) => index % 2
              ? <span key={index} data-minimal-paragraph-break="">{part}</span>
              : <p key={index}>{part}</p>)
            : text}
        </div>
        <p className={`hidden ${styles.readingNote}`} data-minimal-reading-note={minimal ? "" : undefined}>
          约 {characters} 字
          {timestamp && <> · {timeLabel} <time dateTime={timestamp.value}>{timestamp.label}</time></>}
        </p>
        <NotebookEntryActions item={item} tab={tab} day={day} minimal={minimal} />
        <NotebookPageTurns selectedId={item.id} previous={previous} next={next} />
      </article>
    </NotebookReaderMotion>
  );
}
