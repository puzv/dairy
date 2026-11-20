"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { isNotebookId } from "@/lib/notebook-data";
import type { NotebookMutation, NotebookOperation } from "@/lib/notebook-types";
import { lockNotebookItem } from "@/lib/notebook-write";

const notices: Record<NotebookOperation, string> = {
  favorite: "已收藏", unfavorite: "已取消收藏", trash: "已移入回收站", restore: "已恢复",
  purge: "已永久删除", empty: "回收站已清空", discard: "已放弃修改，保留原日记",
};

async function changeItem(tx: Prisma.TransactionClient, ownerId: string, { id, kind, operation }: NotebookMutation) {
  const where = { id, ownerId };
  if (operation === "empty") {
    await tx.entryDraft.deleteMany({ where: { ownerId, entryId: null, deletedAt: { not: null } } });
    await tx.entry.deleteMany({ where: { ownerId, deletedAt: { not: null } } });
    return true;
  }
  await lockNotebookItem(tx, id);
  if (operation === "favorite" || operation === "unfavorite") {
    if (kind !== "entry") return false;
    // A bookmark changes organization, not the timestamp of the last text edit.
    return (await tx.$executeRaw`UPDATE entries SET favorite = ${operation === "favorite"}
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid AND deleted_at IS NULL`) === 1;
  }
  if (operation === "discard") {
    if (kind !== "draft") return false;
    return (await tx.entryDraft.deleteMany({
      where: { ...where, entryId: id, deletedAt: null, entry: { ownerId, deletedAt: null } },
    })).count === 1;
  }
  if (kind === "entry") {
    if (operation === "purge") return (await tx.entry.deleteMany({ where: { ...where, deletedAt: { not: null } } })).count === 1;
    if (operation === "trash") return (await tx.$executeRaw`UPDATE entries SET deleted_at = now()
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid AND deleted_at IS NULL`) === 1;
    if (operation === "restore") return (await tx.$executeRaw`UPDATE entries SET deleted_at = NULL
      WHERE id = ${id}::uuid AND owner_id = ${ownerId}::uuid AND deleted_at IS NOT NULL`) === 1;
  } else {
    const standalone = { ...where, entryId: null };
    if (operation === "purge") return (await tx.entryDraft.deleteMany({ where: { ...standalone, deletedAt: { not: null } } })).count === 1;
    if (operation === "trash" || operation === "restore") {
      const trash = operation === "trash";
      return (await tx.entryDraft.updateMany({
        where: { ...standalone, deletedAt: trash ? null : { not: null } },
        data: { deletedAt: trash ? new Date() : null },
      })).count === 1;
    }
  }
  return false;
}

export async function mutateNotebook(input: NotebookMutation & { expectedOwnerId: string }): Promise<{ ok: boolean; message: string }> {
  const { prisma, user } = await requireUser();
  if (input?.expectedOwnerId !== user.id) return { ok: false, message: "登录账号已切换，请重新打开日记。" };
  if (!input || !Object.hasOwn(notices, input.operation) || !["entry", "draft"].includes(input.kind) ||
      (input.operation !== "empty" && !isNotebookId(input.id))) return { ok: false, message: "无法执行这个操作。" };
  try {
    const ok = await prisma.$transaction(tx => changeItem(tx, user.id, input));
    if (!ok) return { ok: false, message: "这条记录已变动，请刷新目录后重试。" };
  } catch {
    return { ok: false, message: "操作没有完成，请稍后重试。" };
  }
  revalidatePath("/timeline");
  if (input.operation !== "empty") {
    revalidatePath(`/entries/${input.id}`);
    revalidatePath(`/entries/${input.id}/edit`);
  }
  return { ok: true, message: notices[input.operation] };
}
