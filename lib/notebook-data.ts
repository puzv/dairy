import { Prisma } from "@prisma/client";

import { isValidEntryDate } from "@/lib/entries";
import type { DraftView, NotebookData, NotebookItem, NotebookTab } from "@/lib/notebook-types";
import { getPrisma } from "@/lib/prisma";

export function isNotebookId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function getEditorDraft(ownerId: string, id: string): Promise<DraftView | null> {
  if (!isNotebookId(id)) return null;
  const row = await getPrisma().entryDraft.findFirst({
    where: { id, ownerId, deletedAt: null, OR: [{ entryId: null }, { entry: { ownerId, deletedAt: null } }] },
  });
  return row && {
    id: row.id, entryId: row.entryId, revision: row.revision, baseVersion: row.baseVersion,
    fields: { date: row.entryDate?.toISOString().slice(0, 10) ?? "", title: row.title, body: row.body, mood: String(row.mood ?? "") },
  };
}

const displayTitle = Prisma.sql`COALESCE(NULLIF(btrim(title), ''), NULLIF(left(split_part(
  regexp_replace(body, '^[[:space:]]+', ''), chr(10), 1), 200), ''), '无题')`;
const displayExcerpt = Prisma.sql`left(btrim(regexp_replace(body, '[[:space:]]+', ' ', 'g')), 111)`;

export async function getNotebook(ownerId: string, tab: NotebookTab, selectedId: string, day: string): Promise<NotebookData> {
  const db = getPrisma();
  const owner = Prisma.sql`${ownerId}::uuid`;
  const saved = Prisma.sql`SELECT e.id, 'entry' AS kind, e.id AS "entryId", e.entry_date, e.title, e.body, e.mood,
    e.favorite, (d.id IS NOT NULL) AS "hasDraft", e.deleted_at, e.created_at AS touched
    FROM entries e LEFT JOIN entry_drafts d ON d.entry_id = e.id AND d.owner_id = e.owner_id
    WHERE e.owner_id = ${owner}`;
  const drafts = Prisma.sql`SELECT d.id, 'draft' AS kind, d.entry_id AS "entryId", d.entry_date, d.title, d.body, d.mood,
    COALESCE(e.favorite, false) AS favorite, true AS "hasDraft", d.deleted_at, d.updated_at AS touched
    FROM entry_drafts d LEFT JOIN entries e ON e.id = d.entry_id AND e.owner_id = d.owner_id
    WHERE d.owner_id = ${owner}`;
  let source: Prisma.Sql;
  if (tab === "trash") {
    source = Prisma.sql`${saved} AND e.deleted_at IS NOT NULL UNION ALL ${drafts} AND d.entry_id IS NULL AND d.deleted_at IS NOT NULL`;
  } else if (tab === "drafts") {
    source = Prisma.sql`${drafts} AND d.deleted_at IS NULL AND (d.entry_id IS NULL OR (e.id IS NOT NULL AND e.deleted_at IS NULL))`;
  } else {
    const filter = tab === "favorites" ? Prisma.sql`AND e.favorite` :
      isValidEntryDate(day) ? Prisma.sql`AND e.entry_date = ${day}::date` : Prisma.empty;
    source = Prisma.sql`${saved} AND e.deleted_at IS NULL ${filter}`;
  }
  const order = tab === "trash" ? Prisma.sql`deleted_at DESC, id DESC` :
    tab === "drafts" ? Prisma.sql`touched DESC, id DESC` : Prisma.sql`entry_date DESC, touched DESC, id DESC`;
  // Counts, the resume link and the selected text should describe the same notebook
  // even when another tab publishes or restores an entry during this request.
  const [rows, dates, draftStats, deleted] = await db.$transaction([
    db.$queryRaw<NotebookItem[]>`
      WITH visible AS (${source})
      SELECT id, kind, "entryId", COALESCE(to_char(entry_date, 'YYYY-MM-DD'), '') AS date,
        ${displayTitle} AS title, ${displayExcerpt} AS excerpt, mood, favorite, "hasDraft",
        CASE WHEN row_number() OVER (ORDER BY (id::text = ${selectedId}) DESC, ${order}) = 1 THEN body END AS "selectedBody"
      FROM visible ORDER BY ${order}`,
    db.$queryRaw<{ day: string; total: number; favorite: number }[]>`
      SELECT to_char(entry_date, 'YYYY-MM-DD') AS day, count(*)::int AS total,
        (count(*) FILTER (WHERE favorite))::int AS favorite
      FROM entries WHERE owner_id = ${owner} AND deleted_at IS NULL GROUP BY entry_date`,
    db.$queryRaw<{ id: string; entryId: string | null; title: string; excerpt: string; total: number }[]>`
      SELECT id, "entryId", ${displayTitle} AS title, ${displayExcerpt} AS excerpt, (count(*) OVER())::int AS total
      FROM (${drafts} AND d.deleted_at IS NULL AND (d.entry_id IS NULL OR (e.id IS NOT NULL AND e.deleted_at IS NULL))) draft_list
      ORDER BY touched DESC, id DESC LIMIT 1`,
    db.$queryRaw<{ total: number }[]>`SELECT (
      (SELECT count(*) FROM entries WHERE owner_id = ${owner} AND deleted_at IS NOT NULL) +
      (SELECT count(*) FROM entry_drafts WHERE owner_id = ${owner} AND entry_id IS NULL AND deleted_at IS NOT NULL)
      )::int AS total`,
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const latest = draftStats[0];
  const counts = { all: 0, favorites: 0, drafts: latest?.total ?? 0, trash: deleted[0].total };
  const days: Record<string, number> = {};
  for (const row of dates) {
    days[row.day] = row.total;
    counts.all += row.total;
    counts.favorites += row.favorite;
  }
  return { rows, counts, days, resume: latest ? { id: latest.id, entryId: latest.entryId, title: latest.title, excerpt: latest.excerpt } : null };
}
