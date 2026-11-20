import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { EntryForm } from "@/components/entry-form";
import { editorScope } from "@/components/editor-scope";
import { WritingDesk } from "@/components/writing-desk";
import { updateEntryAction } from "@/lib/actions/entries";
import { requireUser } from "@/lib/auth";
import { toEntryView } from "@/lib/entry-view";
import { getEditorDraft, isNotebookId } from "@/lib/notebook-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "编辑日记" };

type Props = { params: Promise<{ id: string }> };

export default async function EditEntryPage({ params }: Props) {
  const [{ id }, { prisma, user }] = await Promise.all([params, requireUser()]);
  if (!isNotebookId(id)) notFound();
  const [row, draft, scope] = await Promise.all([
    prisma.entry.findFirst({ where: { id, ownerId: user.id, deletedAt: null } }),
    getEditorDraft(user.id, id),
    editorScope(user.id),
  ]);
  if (!row || (draft && draft.entryId !== id)) notFound();
  return (
    <WritingDesk title="编辑日记">
      <EntryForm key={`${scope}:${id}`} mode="edit" action={updateEntryAction} entry={toEntryView(row)}
        ownerId={user.id} scope={scope} draft={draft} />
      <Link href={`/entries/${id}`} className="back-link">返回阅读已保存的日记</Link>
    </WritingDesk>
  );
}
