import type { Metadata } from "next";

import { EntryForm } from "@/components/entry-form";
import { createEntryAction } from "@/lib/actions/entries";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "写今天",
};

export default async function NewEntryPage() {
  await requireUser();

  return (
    <main>
      <div className="page-heading">

        <h1>写日记</h1>
      </div>

      <div className="editor-card">
        <EntryForm mode="create" action={createEntryAction} />
      </div>
    </main>
  );
}
