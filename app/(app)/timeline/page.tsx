import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

import { requireUser } from "@/lib/auth";
import { dateParts, formatDiaryDate, moodLabel } from "@/lib/entries";
import { logoutAction } from "@/lib/actions/auth";

import { MobileTimeline } from "./mobile-timeline";
import styles from "./timeline.module.css";
import "./journal-fold.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的日记" };

const coverTransition = { "write-journal": "auto", "return-journal": "auto", default: "none" } as const;

export type TimelineEntry = {
  id: string;
  date: string;
  title: string;
  excerpt: string;
  mood: number | null;
  selectedBody: string | null;
};

type TimelineProps = {
  searchParams: Promise<{ entry?: string | string[] }>;
};

export default async function TimelinePage({ searchParams }: TimelineProps) {
  const [{ prisma, user }, { entry }] = await Promise.all([requireUser(), searchParams]);
  const requestedId = typeof entry === "string" ? entry : "";

  let entries: TimelineEntry[];
  try {
    // A single snapshot supplies bounded card previews and one complete body.
    // A missing or inaccessible selection falls back to the newest owned entry.
    entries = await prisma.$queryRaw<TimelineEntry[]>`
      SELECT id, to_char(entry_date, 'YYYY-MM-DD') AS date, mood,
        COALESCE(NULLIF(btrim(title), ''), NULLIF(left(split_part(
          regexp_replace(body, '^[[:space:]]+', ''), chr(10), 1
        ), 200), ''), '无题') AS title,
        left(btrim(regexp_replace(body, '[[:space:]]+', ' ', 'g')), 111) AS excerpt,
        CASE WHEN row_number() OVER (
          ORDER BY (id::text = ${requestedId}) DESC, entry_date DESC, created_at DESC, id DESC
        ) = 1 THEN body END AS "selectedBody"
      FROM entries
      WHERE owner_id = ${user.id}::uuid AND deleted_at IS NULL
      ORDER BY entry_date DESC, created_at DESC, id DESC
    `;
  } catch {
    return (
      <main className="page-error" role="alert">
        <h1>这一页暂时没有打开</h1>
        <p>日记读取失败，请刷新页面再试一次。</p>
        <Link href="/timeline" className="button-secondary">重新加载</Link>
      </main>
    );
  }

  const selected = entries.find((item) => item.selectedBody !== null);
  const selectedMood = selected && moodLabel(selected.mood);

  return (
    <main data-desktop-journal="">
      <MobileTimeline entries={entries} className={styles.mobile} />
      <div className={styles.desktop}>
        <ViewTransition name="journal-cover" share={coverTransition} default="none">
          <header className={styles.cover}>
            <Link className={styles.brand} href="/timeline" aria-label="山笺 · 回到日记">
              <span aria-hidden="true">山</span>山笺
            </Link>
            <h1>我的日记</h1>
            <Link
              className={styles.write}
              href="/entries/new"
              prefetch={true}
              transitionTypes={["write-journal"]}
            >
              {selected ? "写今天" : "写下第一篇"} <span aria-hidden="true">＋</span>
            </Link>
          </header>
        </ViewTransition>

        <nav className={styles.directory} data-journal-directory aria-label="日记目录">
          <div className={styles.directoryHeader}>
            <h2>日记目录</h2><span>{entries.length} 篇</span>
          </div>
          <ol>
            {entries.map((item, index) => {
              const { year, month, day } = dateParts(item.date);
              const startsMonth = item.date.slice(0, 7) !== entries[index - 1]?.date.slice(0, 7);
              return (
                <li key={item.id}>
                  {startsMonth && <h3 className={styles.month}>{year} 年 {Number(month)} 月</h3>}
                  <Link
                    className={styles.row}
                    href={{ pathname: "/timeline", query: { entry: item.id } }}
                    prefetch={false}
                    scroll={false}
                    aria-current={item.id === selected?.id ? "page" : undefined}
                  >
                    <time dateTime={item.date} aria-label={formatDiaryDate(item.date)}>{day}</time>
                    <span>{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className={styles.reader} data-journal-reader key={selected?.id} aria-label="日记正文">
          <div className={styles.readerHeader}>
            <span>日记正文</span>
            <form action={logoutAction}><button type="submit">退出登录</button></form>
          </div>
          <article className={styles.spread}>
            {selected ? (
              <>
                <div className={styles.meta}>
                  <time dateTime={selected.date}>{formatDiaryDate(selected.date)}</time>
                  {selectedMood && <span>{selectedMood}</span>}
                </div>
                <h2>{selected.title}</h2>
                <div className={styles.prose}>{selected.selectedBody}</div>
                <Link className={styles.edit} href={`/entries/${selected.id}/edit`}>编辑这一篇</Link>
              </>
            ) : (
              <h2>还没有日记</h2>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
