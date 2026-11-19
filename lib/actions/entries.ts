"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import {
  isMood,
  isValidEntryDate,
  type Mood,
} from "@/lib/entries";
import type { EntryState } from "@/lib/entry-state";

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toDatabaseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseEntryForm(formData: FormData): ParsedEntry {
  const rawDate = String(formData.get("date") ?? "").trim();
  const rawTitle = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
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

export async function createEntryAction(
  _previousState: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const parsed = parseEntryForm(formData);
  if (!parsed.ok) {
    return parsed.state;
  }

  const { prisma, user } = await requireUser();
  let entryId: string;

  try {
    const entry = await prisma.entry.create({
      data: {
        ownerId: user.id,
        entryDate: toDatabaseDate(parsed.date),
        title: parsed.title,
        body: parsed.body,
        mood: parsed.mood,
      },
      select: { id: true },
    });
    entryId = entry.id;
  } catch {
    return {
      status: "error",
      message: "这一篇没有保存成功，请稍后再试。",
    };
  }

  revalidatePath("/timeline");
  redirect(`/entries/${entryId}`);
}

export async function updateEntryAction(
  _previousState: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const id = String(formData.get("entry_id") ?? "").trim();
  const rawVersion = String(formData.get("version") ?? "").trim();
  const version = Number(rawVersion);

  if (!isUuid(id)) {
    return { status: "error", message: "找不到要修改的日记。" };
  }
  if (!Number.isInteger(version) || version < 1) {
    return { status: "error", message: "版本信息无效，请刷新页面后重试。" };
  }

  const parsed = parseEntryForm(formData);
  if (!parsed.ok) {
    return parsed.state;
  }

  const { prisma, user } = await requireUser();
  let updatedCount: number;

  try {
    // Single atomic compare-and-swap: owner, live row, and expected version
    // are all part of the UPDATE predicate. A stale editor cannot overwrite
    // a newer save, and another owner's row cannot be touched.
    const result = await prisma.entry.updateMany({
      where: {
        id,
        ownerId: user.id,
        version,
        deletedAt: null,
      },
      data: {
        entryDate: toDatabaseDate(parsed.date),
        title: parsed.title,
        body: parsed.body,
        mood: parsed.mood,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    updatedCount = result.count;
  } catch {
    return {
      status: "error",
      message: "修改没有保存成功，请稍后再试。",
    };
  }

  if (updatedCount !== 1) {
    return {
      status: "error",
      message:
        "这一篇已在别处更新。为避免覆盖，请刷新页面查看最新内容后再修改。",
    };
  }

  revalidatePath("/timeline");
  revalidatePath(`/entries/${id}`);
  revalidatePath(`/entries/${id}/edit`);
  redirect(`/entries/${id}`);
}
