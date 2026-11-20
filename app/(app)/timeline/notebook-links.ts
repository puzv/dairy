import type { NotebookItem, NotebookTab } from "@/lib/notebook-types";

export function timelineHref(tab: NotebookTab, entry = "", day = "") {
  const query = new URLSearchParams();
  if (tab !== "all") query.set("tab", tab);
  if (entry) query.set("entry", entry);
  if (tab === "all" && day) query.set("day", day);
  const search = query.toString();
  return search ? `/timeline?${search}` : "/timeline";
}

export function draftHref(draft: Pick<NotebookItem, "id" | "entryId">) {
  return draft.entryId ? `/entries/${draft.entryId}/edit` : `/entries/new?draft=${draft.id}`;
}
