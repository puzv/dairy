"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { dateParts, formatDiaryDate, moodLabel } from "@/lib/entries";
import type { NotebookData, NotebookItem, NotebookTab } from "@/lib/notebook-types";
import { NotebookAction } from "./notebook-actions";
import { NotebookCalendar, monthLabel } from "./notebook-calendar";
import { draftHref, timelineHref } from "./notebook-links";
import styles from "./notebook.module.css";

const labels = { all: "全部", drafts: "草稿", favorites: "收藏", trash: "回收站" };
const tabs = ["all", "drafts", "favorites"] as const;
const emptyLists = {
  all: "这里还没有日记。", drafts: "草稿都已收好。", favorites: "读到想留住的一篇，可点「收藏」。", trash: "回收站是空的。",
};

type IndexRow = Pick<NotebookItem, "id" | "kind" | "entryId" | "date" | "title" | "mood" | "favorite">;
type DirectoryProps = Pick<NotebookData, "counts" | "resume" | "days"> & {
  tab: NotebookTab; day: string; selectedId: string; mobileReading: boolean; rows: IndexRow[];
};

function rowCaption(tab: NotebookTab, item: IndexRow) {
  if (tab === "trash") return item.kind === "draft" ? "草稿" : "日记";
  if (tab === "drafts") return item.entryId ? "修改草稿" : "未收进日记";
  return moodLabel(item.mood);
}

export function NotebookDirectory({ tab, day, rows, counts, resume, days, selectedId, mobileReading }: DirectoryProps) {
  const [month, setMonth] = useState("");
  const panel = useRef<HTMLElement>(null);
  const openMonthButton = useRef<HTMLElement | null>(null);
  const readingRef = useRef(mobileReading);
  const previousEntry = useRef(selectedId);

  useEffect(() => {
    if (mobileReading) previousEntry.current = selectedId;
    if (readingRef.current === mobileReading) return;
    readingRef.current = mobileReading;
    if (!matchMedia("(max-width: 759.98px)").matches) return;
    const next = mobileReading ? document.querySelector<HTMLElement>("[data-notebook-back]")
      : panel.current?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(previousEntry.current)}"]`)
        ?? panel.current?.querySelector<HTMLElement>("[data-notebook-tab][aria-current=page]");
    next?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [mobileReading, selectedId]);

  function openMonth(button: HTMLElement, value?: string) {
    openMonthButton.current = button;
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(value || day.slice(0, 7) || rows.find(row => row.id === selectedId)?.date.slice(0, 7) || current);
  }

  function closeMonth() {
    setMonth("");
    const previous = openMonthButton.current;
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }

  return (
    <aside ref={panel} className={styles.index} data-journal-directory aria-label="日记目录">
      <header className={styles.indexHead}><h2>日记目录</h2><span>{counts.all} 篇</span></header>
      <nav className={styles.tabs} aria-label="浏览范围">
        {tabs.map(key => (
          <Link key={key} href={timelineHref(key)} scroll={false} prefetch={false} data-notebook-tab={key}
            aria-current={key === tab ? "page" : undefined}>{labels[key]}<small>{counts[key]}</small></Link>
        ))}
      </nav>
      {tab === "all" && !day && resume && (
        <Link className={styles.resume} href={draftHref(resume)} prefetch={false}>
          <small>继续上次 <span aria-hidden="true">↗</span></small>
          <strong>{resume.title}</strong><span>{resume.excerpt || "继续写这份草稿"}</span>
        </Link>
      )}
      <div className={styles.indexContent}>
        <div className={styles.listTools}>
          <span>{tab === "all" ? day ? formatDiaryDate(day) : "最近在前" : labels[tab]}</span>
          {tab === "all" && (day ? <Link href="/timeline" scroll={false}>看全部</Link> :
            <button type="button" onClick={event => openMonth(event.currentTarget)}>按月翻阅</button>)}
          {tab === "trash" && counts.trash > 0 && (
            <NotebookAction target={{ mutation: { operation: "empty", kind: "entry", id: "" },
              destination: timelineHref("trash"), focus: "tab", confirmation: `将永久删除回收站中的 ${counts.trash} 项，删除后无法恢复。` }}>
              清空回收站
            </NotebookAction>
          )}
        </div>
        {rows.length ? (
          <ol>
            {rows.map((item, index) => {
              const entryMonth = item.date.slice(0, 7);
              const startsMonth = entryMonth && (tab === "all" || tab === "favorites") && entryMonth !== rows[index - 1]?.date.slice(0, 7);
              const caption = rowCaption(tab, item);
              return (
                <li key={item.kind + item.id}>
                  {startsMonth && <h3 className={styles.month}>{tab === "all"
                    ? <button type="button" aria-label={"翻阅" + monthLabel(entryMonth)} onClick={event => openMonth(event.currentTarget, entryMonth)}>{monthLabel(entryMonth)}</button>
                    : monthLabel(entryMonth)}</h3>}
                  <Link className={styles.row} href={timelineHref(tab, item.id, day)} prefetch={false} scroll={false}
                    aria-current={item.id === selectedId ? "page" : undefined} data-entry={item.id}>
                    {item.date ? <time dateTime={item.date} aria-label={formatDiaryDate(item.date)}>{dateParts(item.date).day}</time> : <span aria-label="日期待填">—</span>}
                    <span className={styles.rowCopy}><span>{item.title}</span>{caption && <small>{caption}</small>}</span>
                    {item.favorite && <i className={styles.ribbon} role="img" aria-label="已收藏" />}
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : <p className={styles.listEmpty}>{day ? "这一天还没有日记。" : emptyLists[tab]}</p>}
      </div>
      <footer className={styles.indexFoot}>
        <Link href={timelineHref("trash")} scroll={false} prefetch={false} data-notebook-tab="trash"
          aria-current={tab === "trash" ? "page" : undefined}>回收站 · {counts.trash}</Link>
      </footer>
      {month && <NotebookCalendar initialMonth={month} days={days} onClose={closeMonth} />}
    </aside>
  );
}
