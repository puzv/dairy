import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EntryForm } from "@/components/entry-form";
import { updateEntryAction } from "@/lib/actions/entries";
import { requireUser } from "@/lib/auth";
import { formatDiaryDate } from "@/lib/entries";
import { toEntryView } from "@/lib/entry-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "编辑日记",
};

type EditEntryPageProps = {
  params: Promise<{ id: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function EditEntryPage({ params }: EditEntryPageProps) {
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
  });

  if (!row) {
    notFound();
  }

  const entry = toEntryView(row);

  return (
    <main className="entry-edit">
      <div className="page-heading">

        <h1>编辑日记</h1>
        <p>
          {`这一篇写于 ${formatDiaryDate(entry.entry_date)}。修改只在手动保存后生效，保存后会回到阅读页。`}
        </p>
      </div>

      <div className="appearance-spread">
        <div className="journal-paper editor-card">
          <EntryForm mode="edit" action={updateEntryAction} entry={entry} />
        </div>
        <div data-appearance-outlet="" />
      </div>

      <div className="edit-return">
        <Link href={`/entries/${entry.id}`} className="back-link">
          <span aria-hidden="true">←</span>
          不修改了，返回阅读
        </Link>
      </div>
    </main>
  );
}
