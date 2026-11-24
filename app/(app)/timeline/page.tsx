import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

import { AppearanceTrigger } from "@/components/appearance/appearance";
import { NonMinimalControls } from "@/components/edition/edition";
import { logoutAction } from "@/lib/actions/auth";
import { requireUser } from "@/lib/auth";
import { formatDiaryDate, formatUpdatedAt, isValidEntryDate, moodLabel } from "@/lib/entries";
import { getNotebook } from "@/lib/notebook-data";
import type { NotebookData, NotebookTab } from "@/lib/notebook-types";
import { solarTermOn } from "@/lib/solar-terms";
import { NotebookDirectory } from "./notebook-directory";
import { NotebookEmpty } from "./notebook-empty";
import { timelineHref } from "./notebook-links";
import { NotebookReader } from "./notebook-reader";
import styles from "./timeline.module.css";
import "./journal-fold.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "我的日记" };

const coverTransition = { "write-journal": "auto", "return-journal": "auto", default: "none" } as const;
const leafLabels = { all: "日记正文", drafts: "草稿预览", favorites: "收藏的日记", trash: "回收站预览" };

type Search = Partial<Record<"tab" | "entry" | "day", string | string[]>>;

export default async function TimelinePage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ user }, query] = await Promise.all([requireUser(), searchParams]);
  const tab: NotebookTab = query.tab === "drafts" || query.tab === "favorites" || query.tab === "trash" ? query.tab : "all";
  const requestedId = typeof query.entry === "string" ? query.entry : "";
  const day = tab === "all" && typeof query.day === "string" && isValidEntryDate(query.day) ? query.day : "";

  let data: NotebookData;
  try {
    data = await getNotebook(user.id, tab, requestedId, day);
  } catch {
    return (
      <main className="page-error" role="alert">
        <h1>这一页暂时没有打开</h1>
        <p>日记读取失败，请刷新页面再试一次。</p>
        <Link href={timelineHref(tab, requestedId, day)} className="button-secondary">重新加载</Link>
      </main>
    );
  }

  const selectedIndex = data.rows.findIndex(item => item.selectedBody !== null);
  const selected = data.rows[selectedIndex];
  const selectedMood = selected && moodLabel(selected.mood);
  const selectedTerm = selected?.date ? solarTermOn(selected.date) : null;
  const timestamp = selected?.selectedTimestamp?.toISOString();
  const characters = [...(selected?.selectedBody ?? "").replace(/\s/g, "")].length;
  const mobileReading = Boolean(requestedId && selected?.id === requestedId);
  const rows = data.rows.map(({ id, kind, entryId, date, title, mood, favorite }) => ({ id, kind, entryId, date, title, mood, favorite }));
  const [previous, next] = [rows[selectedIndex - 1], rows[selectedIndex + 1]].map(item =>
    item ? { title: item.title, href: timelineHref(tab, item.id, day) } : null);

  return (
    <main data-desktop-journal="">
      <div className={styles.desktop} data-mobile-view={mobileReading ? "leaf" : "index"}
        data-mobile-home={tab === "all" && !day && !mobileReading ? "" : undefined}>
        <ViewTransition name="journal-cover" share={coverTransition} default="none">
          <header className={styles.cover} data-journal-cover>
            <span className="journal-cover-window" aria-hidden="true"><span className="journal-cover-scenery" /></span>
            <Link className={`journal-cover-imprint ${styles.brand}`} href="/timeline" aria-label="山笺 · 回到日记">
              <span aria-hidden="true">山</span>山笺
            </Link>
            <h1 className="journal-cover-title">我的日记</h1>
            <Link className={`journal-cover-link ${styles.write}`} href="/entries/new" prefetch transitionTypes={["write-journal"]}>
              {data.counts.all ? "写今天" : "写下第一篇"} <span aria-hidden="true">→</span>
            </Link>
          </header>
        </ViewTransition>

        <NotebookDirectory tab={tab} day={day} rows={rows} counts={data.counts} resume={data.resume} days={data.days}
          initialDay={new Date().toISOString().slice(0, 10)}
          selectedId={selected?.id || ""} mobileReading={mobileReading} />

        <section className={styles.reader} data-journal-reader aria-label={leafLabels[tab]}>
          <div className={styles.readerHeader}>
            <Link href={timelineHref(tab, "", day)} data-notebook-back="" className={styles.mobileBack} scroll={false}>← 返回目录</Link>
            <span>{leafLabels[tab]}</span>
            <NonMinimalControls>
              <div className={styles.readerTools}>
                <AppearanceTrigger />
                <form action={logoutAction}><button type="submit">退出登录</button></form>
              </div>
            </NonMinimalControls>
          </div>
          <div className="appearance-spread">
            {selected ? (
              <NotebookReader
                item={{ id: selected.id, kind: selected.kind, entryId: selected.entryId, title: selected.title,
                  favorite: selected.favorite, hasDraft: selected.hasDraft, revised: selected.revised }}
                tab={tab} day={day} body={selected.selectedBody ?? ""} characters={characters}
                date={selected.date ? { value: selected.date, label: formatDiaryDate(selected.date) } : null}
                timestamp={timestamp ? { value: timestamp, label: formatUpdatedAt(timestamp) } : null}
                mood={selectedMood} solarTerm={selectedTerm?.name ?? null} previous={previous} next={next}
              />
            ) : <NotebookEmpty tab={tab} day={day} />}
            <div data-appearance-outlet="" />
          </div>
        </section>
      </div>
    </main>
  );
}
