"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { useEdition } from "@/components/edition/edition";
import { useDesktopWidth } from "@/components/use-desktop-width";
import { solarTermsOfMonth } from "@/lib/solar-terms";
import { timelineHref } from "./notebook-links";
import styles from "./calendar.module.css";

const months = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

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
  const monthHeading = useId();
  const [month, setMonth] = useState(initialMonth);
  const { edition } = useEdition();
  const desktopWidth = useDesktopWidth();
  const first = new Date(month + "-01T00:00:00Z");
  const terms = desktopWidth && edition === "shanjian"
    ? new Map(solarTermsOfMonth(first.getUTCFullYear(), first.getUTCMonth() + 1).map(term => [term.date, term.name]))
    : null;
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const offset = (first.getUTCDay() + 6) % 7;
  const dates = Array.from({ length: last.getUTCDate() }, (_, index) => {
    const number = index + 1;
    const date = month + "-" + String(number).padStart(2, "0");
    return { number, date, count: days[date] ?? 0 };
  });
  const recordedDays = dates.filter(day => day.count > 0).length;
  const weeks = Math.ceil((offset + dates.length) / 7);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  function moveMonth(step: number) {
    setMonth(previous => {
      const next = new Date(previous + "-01T00:00:00Z");
      next.setUTCMonth(next.getUTCMonth() + step);
      const year = next.getUTCFullYear();
      return year >= 1 && year <= 9999 ? next.toISOString().slice(0, 7) : previous;
    });
  }

  return (
    <dialog ref={dialog} className={styles.sheet} aria-labelledby={heading} onClose={onClose}>
      <header className={styles.top}>
        <h2 id={heading}>按月翻阅</h2>
        <button className={styles.close} type="button" aria-label="关闭日历" onClick={() => dialog.current?.close()}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className={styles.masthead}>
        <h3 id={monthHeading} className={styles.period} aria-live="polite" aria-atomic="true">
          <span className={styles.year}>{first.getUTCFullYear()} 年</span>
          <span className={styles.month}>{months[first.getUTCMonth()]}月</span>
        </h3>
        <div className={styles.turn}>
          <button type="button" aria-label="上个月" disabled={month === "0001-01"} onClick={() => moveMonth(-1)}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" aria-label="下个月" disabled={month === "9999-12"} onClick={() => moveMonth(1)}>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <table className={styles.grid} data-solar-terms={terms?.size ? "" : undefined} aria-labelledby={monthHeading}>
        <thead>
          <tr>{weekdays.map(day => <th key={day} scope="col" aria-label={`星期${day}`}>{day}</th>)}</tr>
        </thead>
        <tbody>
          {Array.from({ length: weeks }, (_, week) => (
            <tr key={week}>
              {weekdays.map((weekday, column) => {
                const day = dates[week * 7 + column - offset];
                const term = day && terms?.get(day.date);
                const label = day && `${monthLabel(month)} ${day.number} 日${term ? `，${term}` : ""}`;
                const marker = term && <span className={styles.solarTerm} aria-hidden="true">{term}</span>;
                return (
                  <td key={weekday} aria-label={term && day?.count === 0 ? label : undefined}>
                    {day && (day.count > 0 ? (
                      <Link
                        className={styles.recorded}
                        href={timelineHref("all", "", day.date)}
                        scroll={false}
                        prefetch={false}
                        aria-label={`${label}，${day.count} 篇日记`}
                        data-day={day.date}
                        onNavigate={() => dialog.current?.close()}
                      >
                        <span className={styles.stampedNumber}>{day.number}</span>
                        {marker}
                      </Link>
                    ) : <time dateTime={day.date}>{day.number}{marker}</time>)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.foot}>
        {recordedDays > 0 && <span className={styles.imprint} aria-hidden="true" />}
        {recordedDays ? `有日记 · ${recordedDays} 天` : "本月暂无日记"}
      </p>
    </dialog>
  );
}
