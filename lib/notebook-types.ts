export type NotebookTab = "all" | "drafts" | "favorites" | "trash";

export type NotebookItem = {
  id: string;
  kind: "entry" | "draft";
  entryId: string | null;
  date: string;
  title: string;
  excerpt: string;
  mood: number | null;
  favorite: boolean;
  hasDraft: boolean;
  selectedBody: string | null;
};

export type NotebookData = {
  rows: NotebookItem[];
  counts: Record<NotebookTab, number>;
  resume: { id: string; entryId: string | null; title: string; excerpt: string } | null;
  days: Record<string, number>;
};

export type DraftFields = { date: string; title: string; body: string; mood: string };
export type DraftView = {
  id: string;
  entryId: string | null;
  fields: DraftFields;
  revision: number;
  baseVersion: number | null;
};

export type SaveDraftInput = Omit<DraftView, "fields"> & { fields: DraftFields; expectedOwnerId: string };
export type DraftResult = { ok: true; revision: number } | { ok: false; message: string; conflict?: boolean };
export type NotebookOperation = "favorite" | "unfavorite" | "trash" | "restore" | "purge" | "empty" | "discard";
export type NotebookMutation = { operation: NotebookOperation; kind: NotebookItem["kind"]; id: string };
