import type { Entry } from "@prisma/client";

import { isMood, type Mood } from "@/lib/entries";

/**
 * Shape consumed by the existing Chinese UI and client form. PostgreSQL dates
 * are converted to YYYY-MM-DD and timestamps to ISO strings at the server
 * boundary so Server Components can pass them to Client Components.
 */
export type EntryView = {
  id: string;
  entry_date: string;
  title: string | null;
  body: string;
  mood: Mood | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function toEntryView(entry: Entry): EntryView {
  return {
    id: entry.id,
    // Prisma represents a PostgreSQL date as UTC midnight.
    entry_date: entry.entryDate.toISOString().slice(0, 10),
    title: entry.title,
    body: entry.body,
    mood: entry.mood !== null && isMood(entry.mood) ? entry.mood : null,
    version: entry.version,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
    deleted_at: entry.deletedAt?.toISOString() ?? null,
  };
}
