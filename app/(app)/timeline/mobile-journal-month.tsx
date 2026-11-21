"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties } from "react";

import { monthLabel } from "./notebook-calendar";
import { timelineHref } from "./notebook-links";
import styles from "./mobile-journal-month.module.css";

function localDay() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function subscribeToDay(update: () => void) {
  let timer: number;
  function nextMidnight() {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 100);
    timer = window.setTimeout(() => { update(); nextMidnight(); }, midnight.getTime() - Date.now());
  }
  nextMidnight();
  window.addEventListener("focus", update);
  return () => { window.clearTimeout(timer); window.removeEventListener("focus", update); };
}

type Props = {
  days: Record<string, number>;
  initialDay: string;
  latest?: { id: string; title: string };
  onOpenMonth: (button: HTMLElement, month: string) => void;
};

export function MobileJournalMonth({ days, initialDay, latest, onOpenMonth }: Props) {
  const today = useSyncExternalStore(subscribeToDay, localDay, () => initialDay);
  const month = today.slice(0, 7);
  const end = new Date(month + "-01T00:00:00Z");
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const dates = Array.from({ length: end.getUTCDate() }, (_, index) => {
    const date = month + "-" + String(index + 1).padStart(2, "0");
    return { date, count: days[date] ?? 0 };
  });
  const recorded = dates.filter(day => day.count > 0).length;
  const entries = dates.reduce((sum, day) => sum + day.count, 0);

  return (
    <section className={styles.overview} data-mobile-journal="" aria-labelledby="mobile-journal-title">
      <header className={styles.masthead}>
        <h1 id="mobile-journal-title">我的日记</h1>
        <time dateTime={month}>{monthLabel(month)}</time>
      </header>

      <button type="button" className={styles.almanac} data-month-orbit=""
        aria-label={`翻阅${monthLabel(month)}的日历，记录了 ${recorded} 天`}
        onClick={event => onOpenMonth(event.currentTarget, month)}>
        <span className={styles.orbit} aria-hidden="true">
          <span className={styles.landscape} />
          {dates.map(({ date, count }, index) => (
            <i key={date} className={styles.day}
              style={{ "--angle": (index * 360 / dates.length) + "deg" } as CSSProperties}
              data-recorded={count > 0 ? "" : undefined} data-today={date === today ? "" : undefined} />
          ))}
        </span>
        <span className={styles.calendarLabel}>翻开月历 <span aria-hidden="true">↗</span></span>
      </button>

      <div className={styles.measure}>
        <p>本月记录</p>
        <div><strong>{recorded}</strong><span>天</span></div>
      </div>

      <dl className={styles.summary}>
        <div><dt>本月日记</dt><dd>{entries} 篇</dd></div>
        <div><dt>最近一篇</dt><dd>{latest
          ? <Link href={timelineHref("all", latest.id)} prefetch={false} scroll={false} data-mobile-latest={latest.id}>
              <span>{latest.title}</span><i aria-hidden="true">↗</i>
            </Link>
          : "暂无记录"}</dd></div>
      </dl>

      <nav className={styles.actions} aria-label="日记快捷入口">
        <Link className={styles.write} href="/entries/new" transitionTypes={["write-journal"]}>
          {latest ? "写今天" : "写下第一篇"}<span aria-hidden="true">↗</span>
        </Link>
        <a href="#notebook-index-title">浏览目录<span aria-hidden="true">↓</span></a>
      </nav>
    </section>
  );
}
