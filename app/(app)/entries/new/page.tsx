import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntryForm } from "@/components/entry-form";
import { editorScope } from "@/components/editor-scope";
import { WritingDesk } from "@/components/writing-desk";
import { createEntryAction } from "@/lib/actions/entries";
import { requireUser } from "@/lib/auth";
import { getEditorDraft, isNotebookId } from "@/lib/notebook-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "写今天" };

type Props = { searchParams: Promise<{ draft?: string | string[] }> };

export default async function NewEntryPage({ searchParams }: Props) {
  const [{ user }, { draft: id }] = await Promise.all([requireUser(), searchParams]);
  if (id !== undefined && !isNotebookId(id)) notFound();
  const [scope, draft] = await Promise.all([
    editorScope(user.id), id ? getEditorDraft(user.id, id) : null,
  ]);
  if (draft?.entryId) notFound();

  return (
    <WritingDesk title="写日记">
      <EntryForm key={scope} mode="create" action={createEntryAction}
        ownerId={user.id} scope={scope} requestedId={id} draft={draft} />
    </WritingDesk>
  );
}
