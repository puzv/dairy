"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { isMood, isValidEntryDate } from "@/lib/entries";
import { isNotebookId } from "@/lib/notebook-data";
import type { DraftResult, SaveDraftInput } from "@/lib/notebook-types";
import { lockNotebookItem } from "@/lib/notebook-write";

const stale: DraftResult = { ok: false, conflict: true, message: "草稿已在其他页面更改，请保留当前文字并重新打开。" };

export async function saveDraftAction(input: SaveDraftInput): Promise<DraftResult> {
  const { prisma, user } = await requireUser();
  if (!input || input.expectedOwnerId !== user.id) return { ok: false, conflict: true, message: "登录账号已切换，请重新打开日记。" };
  const { id, entryId, revision, baseVersion, fields } = input;
  if (!isNotebookId(id) || (entryId !== null && entryId !== id) || !Number.isSafeInteger(revision) || revision < 0 ||
      (entryId === null ? baseVersion !== null : !Number.isSafeInteger(baseVersion) || Number(baseVersion) < 1)) return stale;
  if (!fields || typeof fields.title !== "string" || fields.title.length > 200 ||
      typeof fields.body !== "string" || fields.body.length > 50000 || typeof fields.date !== "string" ||
      (fields.date !== "" && !isValidEntryDate(fields.date)) || typeof fields.mood !== "string" ||
      (fields.mood !== "" && !isMood(Number(fields.mood)))) {
    return { ok: false, message: "草稿的日期、字数或情绪无效，请检查后重试。" };
  }
  const data = {
    entryDate: fields.date ? new Date(fields.date + "T00:00:00Z") : null,
    title: fields.title, body: fields.body, mood: fields.mood ? Number(fields.mood) : null,
  };
  try {
    const result = await prisma.$transaction<DraftResult>(async tx => {
      await lockNotebookItem(tx, id);
      const entry = await tx.entry.findUnique({ where: { id }, select: { ownerId: true, version: true, deletedAt: true } });
      if (entryId ? (!entry || entry.ownerId !== user.id || entry.deletedAt || entry.version !== baseVersion) : !!entry) return stale;
      const current = await tx.entryDraft.findUnique({ where: { id } });
      if (current) {
        if (current.ownerId !== user.id || current.deletedAt || current.entryId !== entryId || current.baseVersion !== baseVersion) return stale;
        if (current.title === data.title && current.body === data.body && current.mood === data.mood &&
            current.entryDate?.getTime() === data.entryDate?.getTime()) return { ok: true, revision: current.revision };
        if (current.revision !== revision) return stale;
        const [updated] = await tx.$queryRaw<{revision: number}[]>`
          UPDATE entry_drafts SET title = ${data.title}, body = ${data.body}, mood = ${data.mood}::smallint,
            entry_date = ${data.entryDate}::date, revision = nextval('entry_draft_revision_seq'), updated_at = now()
          WHERE id = ${id}::uuid AND owner_id = ${user.id}::uuid AND revision = ${revision} AND deleted_at IS NULL RETURNING revision`;
        return updated ? { ok: true, revision: updated.revision } : stale;
      }
      if (revision !== 0) return stale;
      const draft = await tx.entryDraft.create({ data: { ...data, id, entryId, baseVersion, ownerId: user.id }, select: { revision: true } });
      return { ok: true, revision: draft.revision };
    });
    if (result.ok) revalidatePath("/timeline");
    return result;
  } catch {
    return { ok: false, message: "草稿暂时没有保存成功，请稍后重试。" };
  }
}
