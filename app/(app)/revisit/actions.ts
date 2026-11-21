"use server";

import { Prisma } from "@prisma/client";

import { requireUser } from "@/lib/auth";
import { isMood, isValidEntryDate } from "@/lib/entries";
import { isNotebookId } from "@/lib/notebook-data";
import { emptySearch, type FoundEntry, type MemoryState, type SearchState } from "./revisit-types";

// Return just the display title and a bounded passage, including when the only
// matching word occurs far beyond the start of a long diary.
const entryFields = Prisma.sql`
  id, to_char(entry_date, 'YYYY-MM-DD') AS date, mood,
  coalesce(nullif(btrim(title), ''), nullif(left(split_part(
    regexp_replace(body, '^[[:space:]]+', ''), chr(10), 1), 200), ''), '无题') AS title`;
const pageSize = 12;

export async function searchJournal(
  expectedOwner: string, _previous: SearchState, form: FormData,
): Promise<SearchState> {
  const { user, prisma } = await requireUser();
  const error = (message: string): SearchState => ({ ...emptySearch, phase: "error", message });
  if (expectedOwner !== user.id) return error("登录账号已切换，请刷新页面。");
  const turn = form.get("turn");
  if (turn === "clear") return emptySearch;
  const value = form.get("phrase");
  const mood = form.get("mood");
  if (typeof value !== "string" || value.length > 120 || value.includes("\u0000") ||
      typeof mood !== "string" || (mood !== "" && (!/^[1-5]$/.test(mood) || !isMood(Number(mood))))) {
    return error("请检查关键词与心情后重试。");
  }
  const phrase = value.trim();
  if (!phrase && !mood) return error("请输入关键词，或选一种心情。");

  const newer = turn === "newer";
  const older = turn === "older";
  const ascending = newer ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  let boundary = Prisma.empty;
  if (newer || older) {
    const date = form.get("cursorDate");
    const id = form.get("cursorId");
    if (typeof date !== "string" || !isValidEntryDate(date) || !isNotebookId(id)) {
      return error("翻页位置无效，请重新查找。");
    }
    const comparison = newer ? Prisma.sql`>` : Prisma.sql`<`;
    boundary = Prisma.sql`AND (entry_date, id) ${comparison} (${date}::date, ${id}::uuid)`;
  }

  const position = phrase ? Prisma.sql`strpos(lower(body), lower(${phrase}))` : Prisma.sql`1`;
  const textFilter = phrase
    ? Prisma.sql`WHERE body_pos > 0 OR strpos(lower(coalesce(title, '')), lower(${phrase})) > 0`
    : Prisma.empty;
  try {
    const items = await prisma.$queryRaw<FoundEntry[]>`
      WITH visible AS (
        SELECT id, entry_date, title, body, mood, ${position} AS body_pos
        FROM entries WHERE owner_id = ${user.id}::uuid AND deleted_at IS NULL
        ${mood ? Prisma.sql`AND mood = ${Number(mood)}::smallint` : Prisma.empty} ${boundary}
      )
      SELECT ${entryFields},
        (CASE WHEN body_pos > 25 THEN '…' ELSE '' END) ||
        substr(body, greatest(1, body_pos - 24), 160) ||
        (CASE WHEN char_length(body) >= greatest(1, body_pos - 24) + 160 THEN '…' ELSE '' END) AS excerpt
      FROM visible ${textFilter}
      ORDER BY entry_date ${ascending}, id ${ascending} LIMIT ${pageSize + 1}`;
    const more = items.length > pageSize;
    const entries = items.slice(0, pageSize);
    if (newer) entries.reverse();
    return {
      phase: "results", phrase, mood, entries,
      hasNewer: entries.length > 0 && (newer ? more : older),
      hasOlder: entries.length > 0 && (newer || more),
      message: entries.length ? "" : "没有找到符合条件的日记。",
    };
  } catch {
    return error("日记暂时没有取回，请稍后重试。");
  }
}

export async function recallJournal(
  expectedOwner: string, _previous: MemoryState, form: FormData,
): Promise<MemoryState> {
  const { user, prisma } = await requireUser();
  if (expectedOwner !== user.id) return { message: "登录账号已切换，请刷新页面。" };
  const localDate = form.get("today");
  const today = typeof localDate === "string" && isValidEntryDate(localDate)
    ? localDate : new Date().toISOString().slice(0, 10);

  try {
    const [match] = await prisma.$queryRaw<(FoundEntry & { priority: number })[]>`
      WITH earlier AS (
        SELECT e.id, e.entry_date, e.title, e.body, e.mood,
          CASE
            WHEN extract(month FROM e.entry_date) = extract(month FROM ref.today)
              AND extract(day FROM e.entry_date) = extract(day FROM ref.today) THEN 1
            WHEN e.entry_date >= (date_trunc('month', ref.today::timestamp) - interval '1 month')::date
              AND e.entry_date < date_trunc('month', ref.today::timestamp)::date
              AND extract(day FROM e.entry_date) = extract(day FROM ref.today) THEN 2
            ELSE 3
          END AS priority
        FROM entries e CROSS JOIN (SELECT ${today}::date AS today) ref
        WHERE e.owner_id = ${user.id}::uuid AND e.deleted_at IS NULL AND e.entry_date < ref.today
        ORDER BY priority, e.entry_date DESC, e.id DESC LIMIT 1
      )
      SELECT ${entryFields}, priority, left(body, 160) ||
        (CASE WHEN char_length(body) > 160 THEN '…' ELSE '' END) AS excerpt FROM earlier`;
    if (!match) return { message: "还没有今天以前的日记。" };
    const { priority, ...entry } = match;
    const label = priority === 1 ? "往年今日" : priority === 2 ? "上月同日" : "最近的旧日记";
    return { entry, label };
  } catch {
    return { message: "旧日记暂时没有取回，请稍后重试。" };
  }
}
