"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useEdition } from "@/components/edition/edition";
import { dateParts, formatDiaryDate, moodLabel } from "@/lib/entries";
import type { NotebookData, NotebookItem, NotebookTab } from "@/lib/notebook-types";
import { MobileJournalMonth } from "./mobile-journal-month";
import { NotebookAction } from "./notebook-actions";
import { NotebookCalendar, monthLabel } from "./notebook-calendar";
import { NotebookEmpty } from "./notebook-empty";
import { draftHref, timelineHref } from "./notebook-links";
import styles from "./notebook.module.css";

const labels = { all: "全部", drafts: "草稿", favorites: "收藏", trash: "回收站" };
const tabs = ["all", "drafts", "favorites"] as const;
const desktopQuery = "(min-width: 760px)";

type IndexRow = Pick<NotebookItem, "id" | "kind" | "entryId" | "date" | "title" | "mood" | "favorite">;
type DirectoryProps = Pick<NotebookData, "counts" | "resume" | "days"> & {
  tab: NotebookTab; day: string; initialDay: string; selectedId: string; mobileReading: boolean; rows: IndexRow[];
};

function rowCaption(tab: NotebookTab, item: IndexRow) {
  if (tab === "trash") return item.kind === "draft" ? "草稿" : "日记";
  if (tab === "drafts") return item.entryId ? "修改草稿" : "未收进日记";
  return moodLabel(item.mood);
}

function groupMonths(rows: IndexRow[]) {
  const groups: { month: string; items: IndexRow[] }[] = [];
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.month === month) last.items.push(row);
    else groups.push({ month, items: [row] });
  }
  return groups;
}

function rowLink(panel: HTMLElement | null, id: string) {
  return panel?.querySelector<HTMLAnchorElement>(`[data-entry="${CSS.escape(id)}"]`);
}

export function NotebookDirectory({ tab, day, initialDay, rows, counts, resume, days, selectedId, mobileReading }: DirectoryProps) {
  const { edition } = useEdition();
  const minimal = edition === "minimal";
  const visibleCount = minimal ? (day ? rows.length : counts[tab]) : counts.all;
  const [month, setMonth] = useState("");
  const panel = useRef<HTMLElement>(null);
  const openMonthButton = useRef<HTMLElement | null>(null);
  const readingRef = useRef(mobileReading);
  const openedFromLatest = useRef(false);
  const previousEntry = useRef(selectedId);
  const previousDay = useRef(day);

  useLayoutEffect(() => {
    if ((edition !== "shanjian" && edition !== "minimal") || !matchMedia(desktopQuery).matches) return;
    const journal = panel.current?.closest("[data-desktop-journal]");
    journal?.querySelector("[data-journal-reader]")?.scrollTo({ top: 0, behavior: "instant" });
    rowLink(panel.current, selectedId)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [edition, day, selectedId, tab]);

  useEffect(() => {
    if (previousDay.current === day) return;
    previousDay.current = day;
    // Filtering replaces the calendar button with a link to clear the filter.
    if (document.activeElement === document.body || panel.current?.contains(document.activeElement)) {
      const controls = panel.current?.querySelectorAll<HTMLElement>("[data-day-control]");
      const control = minimal ? Array.from(controls ?? []).find(node => node.getClientRects().length) : controls?.[0];
      control?.focus({ preventScroll: true });
    }
  }, [day, minimal]);

  useEffect(() => {
    if (mobileReading) previousEntry.current = selectedId;
    if (readingRef.current === mobileReading) return;
    readingRef.current = mobileReading;
    if (!matchMedia("(max-width: 759.98px)").matches) return;
    const latest = openedFromLatest.current && !mobileReading
      ? panel.current?.querySelector<HTMLElement>(`[data-mobile-latest="${CSS.escape(previousEntry.current)}"]`)
      : null;
    const next = mobileReading ? document.querySelector<HTMLElement>("[data-notebook-back]")
      : latest
        ?? panel.current?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(previousEntry.current)}"]`)
        ?? panel.current?.querySelector<HTMLElement>("[data-notebook-tab][aria-current=page]");
    next?.focus({ preventScroll: true });
    if (mobileReading) window.scrollTo({ top: 0, behavior: "instant" });
    else next?.scrollIntoView({ block: "nearest", behavior: "instant" });
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

  function renderRow(item: IndexRow) {
    const caption = rowCaption(tab, item);
    const mood = minimal && moodLabel(item.mood);
    const separateMood = mood && mood !== caption;
    return (
      <li key={item.kind + item.id}>
        <Link className={styles.row} href={timelineHref(tab, item.id, day)} prefetch={false} scroll={false}
          transitionTypes={minimal && item.id !== selectedId ? ["minimal-read"] : undefined}
          aria-current={item.id === selectedId ? "page" : undefined} data-entry={item.id}>
          {item.date ? <time dateTime={item.date} aria-label={formatDiaryDate(item.date)}>{minimal ? item.date.slice(-2) : dateParts(item.date).day}</time> : <span aria-label="日期待填">—</span>}
          <span className={styles.rowCopy} data-minimal-row-copy={minimal ? "" : undefined}>
            <span>{item.title}</span>
            {separateMood && <small data-minimal-desktop-only="">{mood}</small>}
            {caption && <small data-minimal-mobile-only={separateMood ? "" : undefined}>{caption}</small>}
          </span>
          {item.favorite && <i className={styles.ribbon} role="img" aria-label="已收藏" data-minimal-mobile-only={minimal ? "" : undefined} />}
        </Link>
      </li>
    );
  }

  return (
    <aside ref={panel} className={styles.index} data-journal-directory aria-label="日记目录"
      onClickCapture={event => {
        if (event.target instanceof Element && event.target.closest("a")) {
          openedFromLatest.current = Boolean(event.target.closest("[data-mobile-latest]"));
        }
      }}>
      {tab === "all" && !day && !mobileReading && (
        <MobileJournalMonth initialDay={initialDay} days={days} latest={rows[0]} onOpenMonth={openMonth} />
      )}
      <header className={styles.indexHead} id="notebook-index-title" tabIndex={-1} data-minimal-index-head={minimal ? "" : undefined}>
        <h2>{minimal ? "目录" : "日记目录"}</h2><span>{visibleCount} 篇</span>
      </header>
      <nav className={styles.tabs} aria-label="浏览范围" data-minimal-tabs={minimal ? "" : undefined}>
        {tabs.map(key => (
          <Link key={key} href={timelineHref(key)} scroll={false} prefetch={false} data-notebook-tab={key}
            transitionTypes={minimal ? ["minimal-read"] : undefined}
            aria-current={key === tab ? "page" : undefined}>{labels[key]}<small>{counts[key]}</small></Link>
        ))}
      </nav>
      {minimal && (
        <div data-minimal-directory-tools="" data-minimal-desktop-only="">
          <Link href="/revisit">寻笺与回望</Link>
          {tab === "all" && (
            <button data-day-control={day ? undefined : ""} type="button" aria-haspopup="dialog"
              onClick={event => openMonth(event.currentTarget)}>按月翻阅</button>
          )}
          {tab === "all" && !day && resume && (
            <Link href={draftHref(resume)} prefetch transitionTypes={["write-journal"]}>继续上次</Link>
          )}
        </div>
      )}
      <Link className={styles.revisit} href="/revisit" data-minimal-mobile-only={minimal ? "" : undefined}>寻笺与回望 <span aria-hidden="true">↗</span></Link>
      {tab === "all" && !day && resume && (
        <Link className={styles.resume} href={draftHref(resume)} prefetch transitionTypes={["write-journal"]} data-minimal-mobile-only={minimal ? "" : undefined}>
          <small>继续上次 <span aria-hidden="true">↗</span></small>
          <strong>{resume.title}</strong><span>{resume.excerpt || "继续写这份草稿"}</span>
        </Link>
      )}
      <div className={styles.indexContent} data-minimal-index-content={minimal ? "" : undefined}>
        {(tab === "all" || rows.length > 0) && (
          <div className={styles.listTools} data-minimal-mobile-only={minimal && tab !== "trash" && !day ? "" : undefined}>
            <span>{tab === "all" ? day ? formatDiaryDate(day) : "最近在前" : labels[tab]}</span>
            {tab === "all" && (day ? <Link data-day-control="" href="/timeline" scroll={false}
              transitionTypes={minimal ? ["minimal-read"] : undefined}>看全部</Link> :
              <button data-day-control="" type="button" onClick={event => openMonth(event.currentTarget)}>按月翻阅</button>)}
            {tab === "trash" && counts.trash > 0 && (
              <NotebookAction target={{ mutation: { operation: "empty", kind: "entry", id: "" },
                destination: timelineHref("trash"), focus: "tab", confirmation: `将永久删除回收站中的 ${counts.trash} 项，删除后无法恢复。` }}>
                清空回收站
              </NotebookAction>
            )}
          </div>
        )}
        {rows.length ? (
          tab === "all" || tab === "favorites" ? (
            <ol>
              {groupMonths(rows).map(group => (
                <li key={group.month} className={styles.monthGroup}>
                  {group.month && <h3 className={styles.month} data-minimal-month={minimal ? "" : undefined}>{tab === "all"
                    ? <button type="button" aria-label={"翻阅" + monthLabel(group.month)} onClick={event => openMonth(event.currentTarget, group.month)}>{monthLabel(group.month)}</button>
                    : monthLabel(group.month)}</h3>}
                  <ol>{group.items.map(renderRow)}</ol>
                </li>
              ))}
            </ol>
          ) : <ol>{rows.map(renderRow)}</ol>
        ) : <div className={styles.mobileEmpty}><NotebookEmpty tab={tab} day={day} /></div>}
      </div>
      <footer className={styles.indexFoot} data-minimal-index-foot={minimal ? "" : undefined}>
        <Link href={timelineHref("trash")} scroll={false} prefetch={false} data-notebook-tab="trash"
          transitionTypes={minimal ? ["minimal-read"] : undefined}
          aria-current={tab === "trash" ? "page" : undefined}>回收站 · {counts.trash}</Link>
      </footer>
      {month && <NotebookCalendar initialMonth={month} days={days} onClose={closeMonth}
        selectedDay={minimal ? day || rows.find(row => row.id === selectedId)?.date : undefined} />}
    </aside>
  );
}
