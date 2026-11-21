import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import { requireUser } from "@/lib/auth";
import { NotebookBookmark, NotebookEntryActions } from "../../timeline/notebook-entry-actions";
import {
  entryTitle,
  formatDiaryDate,
  formatUpdatedAt,
  moodLabel,
} from "@/lib/entries";
import { toEntryView } from "@/lib/entry-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "翻阅日记",
};

type EntryPageProps = {
  params: Promise<{ id: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function EntryPage({ params }: EntryPageProps) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const { prisma, user } = await requireUser();
  const row = await prisma.entry.findFirst({
    where: {
      id,
      ownerId: user.id,
      deletedAt: null,
    },
    include: { draft: { select: { ownerId: true, deletedAt: true } } },
  });

  if (!row) {
    notFound();
  }

  const entry = toEntryView(row);

  const item = { id: row.id, kind: "entry" as const, entryId: row.id, favorite: row.favorite, hasDraft: row.draft?.ownerId === user.id && row.draft.deletedAt === null };
  const mood = moodLabel(entry.mood);
  const title = entryTitle(entry);

  const page = (
    <main className="entry-detail">
      <Link href="/timeline" className="back-link">
        <span aria-hidden="true">←</span>
        回到日记
      </Link>

      <div className="appearance-spread">
        <article className="journal-paper">
          <header className="reading-header">
            <div className="reading-meta">
              <time dateTime={entry.entry_date}>
                {formatDiaryDate(entry.entry_date)}
              </time>
              {mood ? (
                <span className="badge badge-outline mood-tag">
                  <span className="mood-dot" aria-hidden="true" />
                  {mood}
                </span>
              ) : null}
              <NotebookBookmark item={item} />
            </div>
            <h1>{title}</h1>
            <p className="reading-byline">
              第 {entry.version} 版 · 最近保存于 {formatUpdatedAt(entry.updated_at)}
            </p>
          </header>

          <div className="reading-body journal-prose">{entry.body}</div>
          <NotebookEntryActions item={item} editTransition="open-paper" />
        </article>
        <div data-appearance-outlet="" />
      </div>

      <footer className="reading-actions">
        <Link href="/entries/new" className="button-secondary">
          再写一篇
        </Link>
      </footer>
    </main>
  );
  return (
    <ViewTransition name="notebook-page" exit={{ "open-paper": "auto", default: "none" }} default="none">
      {page}
    </ViewTransition>
  );
}
