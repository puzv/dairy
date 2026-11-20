"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { timelineHref } from "./notebook-links";
import styles from "./notebook.module.css";

export function monthLabel(month: string) {
  return `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`;
}

export function NotebookCalendar({ initialMonth, days, onClose }: {
  initialMonth: string;
  days: Record<string, number>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [month, setMonth] = useState(initialMonth);
  const firstDay = new Date(month + "-01T00:00:00Z");
  const lastDay = new Date(firstDay);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  const blanks = (firstDay.getUTCDay() + 6) % 7;

  useEffect(() => {
    const node = dialog.current;
    if (!node?.open) node?.showModal();
  }, []);

  function moveMonth(offset: number) {
    const next = new Date(firstDay);
    next.setUTCMonth(next.getUTCMonth() + offset);
    setMonth(next.toISOString().slice(0, 7));
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onClose={onClose}>
      <div className={styles.calendarHead}><h2 id={heading}>按月翻阅</h2>
        <button type="button" aria-label="关闭日历" onClick={() => dialog.current?.close()}>×</button>
      </div>
      <div className={styles.calendarHead}>
        <button type="button" aria-label="上个月" disabled={month === "0001-01"} onClick={() => moveMonth(-1)}>‹</button>
        <strong aria-live="polite">{monthLabel(month)}</strong>
        <button type="button" aria-label="下个月" disabled={month === "9999-12"} onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className={styles.calendarGrid}>
        {["一", "二", "三", "四", "五", "六", "日"].map(weekday => <span key={weekday} className={styles.weekday}>{weekday}</span>)}
        {Array.from({ length: blanks }, (_, index) => <span key={"blank" + index} aria-hidden="true" />)}
        {Array.from({ length: lastDay.getUTCDate() }, (_, index) => {
          const number = index + 1;
          const date = month + "-" + String(number).padStart(2, "0");
          const count = days[date] || 0;
          return count ? (
            <Link key={date} href={timelineHref("all", "", date)} scroll={false} prefetch={false}
              aria-label={`${monthLabel(month)} ${number} 日，${count} 篇日记`} data-day={date}
              onClick={() => dialog.current?.close()}>{number}</Link>
          ) : <span key={date}>{number}</span>;
        })}
      </div>
      <p className={styles.calendarKey}><i aria-hidden="true" /> 当日有日记</p>
    </dialog>
  );
}
