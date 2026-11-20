import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import {
  dateParts,
  entryExcerpt,
  entryTitle,
  formatDiaryDate,
  moodLabel,
} from "@/lib/entries";
import { toEntryView, type EntryView } from "@/lib/entry-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的日记",
};

export default async function TimelinePage() {
  const { prisma, user } = await requireUser();

  let entries: EntryView[] | null = null;
  let error = false;

  try {
    const rows = await prisma.entry.findMany({
      where: {
        ownerId: user.id,
        deletedAt: null,
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    });
    entries = rows.map(toEntryView);
  } catch {
    error = true;
  }

  return (
    <main className="timeline-page">
      <section className="timeline-hero">
        <div>

          <h1>我的日记</h1>
        </div>
        <Link href="/entries/new" className="button-primary timeline-cta">
          <span aria-hidden="true">＋</span>
          写今天
        </Link>
      </section>

      {error ? (
        <section className="page-error" role="alert">
          <h2>这一页暂时没有打开</h2>
          <p>日记读取失败，请刷新页面再试一次。</p>
          <Link href="/timeline" className="button-secondary">
            重新加载
          </Link>
        </section>
      ) : null}

      {!error && entries && entries.length > 0 ? (
        <>
          <div className="timeline-toolbar">
            <span className="timeline-count">已收录 {entries.length} 篇</span>
            <span>最近在前</span>
          </div>

          <ol className="timeline-list">
            {entries.map((entry) => {
              const parts = dateParts(entry.entry_date);
              const mood = moodLabel(entry.mood);

              return (
                <li className="timeline-item" key={entry.id}>
                  <article className="card entry-card">
                    <div className="entry-date-row">
                      <time
                        className="entry-date"
                        dateTime={entry.entry_date}
                        aria-label={formatDiaryDate(entry.entry_date)}
                      >
                        <span className="entry-day">{parts.day}</span>
                        <span className="entry-month">
                          {parts.year} / {parts.month} 月
                        </span>
                      </time>
                      {mood ? (
                        <span className="badge badge-outline mood-tag">
                          <span className="mood-dot" aria-hidden="true" />
                          {mood}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="entry-title">
                      <Link href={`/entries/${entry.id}`}>
                        {entryTitle(entry)}
                      </Link>
                    </h2>
                    <p className="entry-excerpt">{entryExcerpt(entry.body)}</p>

                    <div className="entry-footer">
                      <span className="entry-month">
                        {formatDiaryDate(entry.entry_date)}
                      </span>
                      <Link
                        className="entry-edit-link"
                        href={`/entries/${entry.id}/edit`}
                        aria-label={`编辑「${entryTitle(entry)}」`}
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
      ) : null}

      {!error && entries && entries.length === 0 ? (
        <section className="empty-state">
          <div className="empty-glyph" aria-hidden="true">
            笺
          </div>
          <h2>还没有日记</h2>
          <Link href="/entries/new" className="button-primary">
            写下第一篇
          </Link>
        </section>
      ) : null}

      {!error && !entries ? (
        <section className="empty-state" aria-live="polite">
          <div className="empty-glyph" aria-hidden="true">
            山
          </div>
          <h2>正在整理这一页</h2>
          <p>稍等片刻，日记很快就来。</p>
        </section>
      ) : null}
    </main>
  );
}
