"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  isMood,
  isValidEntryDate,
  type Mood,
} from "@/lib/entries";
import type { EntryState } from "@/lib/entry-state";

import { isNotebookId } from "@/lib/notebook-data";
import { lockNotebookItem } from "@/lib/notebook-write";

type ParsedEntry =
  | {
      ok: true;
      date: string;
      title: string | null;
      body: string;
      mood: Mood | null;
    }
  | {
      ok: false;
      state: EntryState;
    };

function toDatabaseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseEntryForm(formData: FormData): ParsedEntry {
  const rawDate = String(formData.get("date") ?? "").trim();
  const rawTitle = String(formData.get("title") ?? "");
  // HTML form submissions can encode textarea newlines as CRLF. Drafts and the
  // editor count LF, including for the 50,000-character body limit.
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n");
  const rawMood = String(formData.get("mood") ?? "").trim();
  const fieldErrors: NonNullable<EntryState["fieldErrors"]> = {};

  if (!rawDate) {
    fieldErrors.date = "请选择这一篇的日期。";
  } else if (!isValidEntryDate(rawDate)) {
    fieldErrors.date = "日期格式不正确。";
  }

  const title = rawTitle.trim() || null;
  if (title && title.length > 200) {
    fieldErrors.title = "标题最多 200 个字。";
  }

  if (!body.trim()) {
    fieldErrors.body = "正文不能为空，写一句也可以。";
  } else if (body.length > 50_000) {
    fieldErrors.body = "正文最多 50,000 个字。";
  }

  let mood: Mood | null = null;
  if (rawMood) {
    const parsedMood = Number(rawMood);
    if (!isMood(parsedMood)) {
      fieldErrors.mood = "请选择有效的情绪标记。";
    } else {
      mood = parsedMood;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      state: {
        status: "error",
        message: "还有几处需要调整。",
        fieldErrors,
      },
    };
  }

  return {
    ok: true,
    date: rawDate,
    title,
    body,
    mood,
  };
}

const stale: EntryState = { status: "error", message: "日记或草稿已在其他页面更改。请保留当前文字，再重新打开。" };

async function publish(formData: FormData, editing: boolean): Promise<EntryState> {
  const parsed = parseEntryForm(formData);
  if (!parsed.ok) return parsed.state;
  const draftId = String(formData.get("draft_id") ?? "");
  const revision = Number(formData.get("draft_revision") ?? 0);
  const version = Number(formData.get("version"));
  const id = editing ? String(formData.get("entry_id") ?? "") : draftId || randomUUID();
  if (!isNotebookId(id) || (draftId && draftId !== id) || !Number.isSafeInteger(revision) || revision < 0 ||
      (editing && (!Number.isSafeInteger(version) || version < 1))) return stale;

  const { prisma, user } = await requireUser();
  if (formData.has("editor_owner_id") && formData.get("editor_owner_id") !== user.id) {
    return { status: "error", message: "登录账号已切换，请重新打开日记。" };
  }
  const data = { entryDate: toDatabaseDate(parsed.date), title: parsed.title, body: parsed.body, mood: parsed.mood };
  try {
    const saved = await prisma.$transaction(async tx => {
      await lockNotebookItem(tx, id);
      const draft = await tx.entryDraft.findUnique({ where: { id }, select: {
        ownerId: true, revision: true, entryId: true, deletedAt: true, baseVersion: true,
      } });
      if (draft && (draft.ownerId !== user.id || draft.deletedAt || draft.revision !== revision ||
          (editing ? draft.entryId !== id || draft.baseVersion !== version : draft.entryId !== null))) return false;

      if (editing) {
        if (!draft && revision > 0) return false;
        const result = await tx.entry.updateMany({
          where: { id, ownerId: user.id, deletedAt: null, version },
          data: { ...data, version: { increment: 1 } },
        });
        if (result.count !== 1) return false;
      } else {
        const existing = await tx.entry.findUnique({ where: { id } });
        if (existing) {
          // A retried request for a newly published draft can return its existing reading page.
          return !draft && existing.ownerId === user.id && !existing.deletedAt && existing.version === 1 &&
            existing.entryDate.getTime() === data.entryDate.getTime() && existing.title === data.title &&
            existing.body === data.body && existing.mood === data.mood;
        }
        if (!draft && revision > 0) return false;
        await tx.entry.create({ data: { ...data, id, ownerId: user.id } });
      }
      if (draft) await tx.entryDraft.delete({ where: { id } });
      return true;
    });
    if (!saved) return stale;
  } catch {
    return { status: "error", message: "这一篇没有保存成功，请稍后再试。" };
  }
  revalidatePath("/timeline");
  revalidatePath(`/entries/${id}`);
  revalidatePath(`/entries/${id}/edit`);
  redirect(`/entries/${id}`);
}

export async function createEntryAction(_state: EntryState, data: FormData) {
  return publish(data, false);
}

export async function updateEntryAction(_state: EntryState, data: FormData) {
  return publish(data, true);
}
