import Link from "next/link";

import { dateParts, entryExcerpt, formatDiaryDate, moodLabel } from "@/lib/entries";
import type { TimelineEntry } from "./page";

export function MobileTimeline({ entries, className }: {
  entries: TimelineEntry[];
  className: string;
}) {
  return (
    <div className={`timeline-page ${className}`}>
      <section className="timeline-hero">
        <h1>我的日记</h1>
        <Link href="/entries/new" className="button-primary timeline-cta">
          <span aria-hidden="true">＋</span>写今天
        </Link>
      </section>
      {entries.length > 0 ? (
        <>
          <div className="timeline-toolbar">
            <span className="timeline-count">已收录 {entries.length} 篇</span>
            <span>最近在前</span>
          </div>
          <ol className="timeline-list">
            {entries.map((entry) => {
              const parts = dateParts(entry.date);
              const mood = moodLabel(entry.mood);
              return (
                <li className="timeline-item" key={entry.id}>
                  <article className="card entry-card">
                    <div className="entry-date-row">
                      <time className="entry-date" dateTime={entry.date} aria-label={formatDiaryDate(entry.date)}>
                        <span className="entry-day">{parts.day}</span>
                        <span className="entry-month">{parts.year} / {parts.month} 月</span>
                      </time>
                      {mood && (
                        <span className="badge badge-outline mood-tag">
                          <span className="mood-dot" aria-hidden="true" />{mood}
                        </span>
                      )}
                    </div>
                    <h2 className="entry-title">
                      <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
                    </h2>
                    <p className="entry-excerpt">{entryExcerpt(entry.excerpt)}</p>
                    <div className="entry-footer">
                      <span className="entry-month">{formatDiaryDate(entry.date)}</span>
                      <Link
                        className="entry-edit-link"
                        href={`/entries/${entry.id}/edit`}
                        aria-label={`编辑「${entry.title}」`}
                      >
                        编辑
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <section className="empty-state">
          <div className="empty-glyph" aria-hidden="true">笺</div>
          <h2>还没有日记</h2>
          <Link href="/entries/new" className="button-primary">写下第一篇</Link>
        </section>
      )}
    </div>
  );
}
