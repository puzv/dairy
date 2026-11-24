import Link from "next/link";

import type { NotebookItem, NotebookTab } from "@/lib/notebook-types";
import { NotebookAction } from "./notebook-actions";
import { draftHref, timelineHref } from "./notebook-links";
import styles from "./notebook.module.css";

type ActionItem = Pick<NotebookItem, "id" | "kind" | "entryId" | "favorite" | "hasDraft">;
type ActionProps = { item: ActionItem; tab?: NotebookTab; day?: string; minimal?: boolean };

export function NotebookBookmark({ item, tab = "all", minimal = false }: ActionProps) {
  if (tab === "trash" || item.kind !== "entry") return null;
  const leavingFavorites = item.favorite && tab === "favorites";
  return (
    <NotebookAction bookmark={item.favorite} className={styles.bookmark} target={{
      mutation: { operation: item.favorite ? "unfavorite" : "favorite", kind: item.kind, id: item.id },
      destination: leavingFavorites ? timelineHref("favorites") : undefined,
      focus: leavingFavorites ? "tab" : "reader",
    }}>
      {!minimal && <i className={styles.ribbon} aria-hidden="true" />}{item.favorite ? "已收藏" : "收藏"}
    </NotebookAction>
  );
}

export function NotebookEntryActions({ item, tab = "all", day = "", editTransition = "write-journal", minimal = false }:
  ActionProps & { editTransition?: "write-journal" | "open-paper" }) {
  const { kind, id } = item;
  if (tab === "trash") {
    return (
      <div className={styles.paperActions} data-minimal-reading-actions={minimal ? "" : undefined}>
        <NotebookAction target={{ mutation: { operation: "restore", kind, id },
          destination: timelineHref(kind === "draft" ? "drafts" : "all", id), focus: "reader" }}>恢复</NotebookAction>
        <NotebookAction className={styles.danger} target={{ mutation: { operation: "purge", kind, id },
          destination: timelineHref("trash"), focus: "tab",
          confirmation: kind === "draft" ? "这份草稿将被永久删除，无法恢复。" : "这篇日记与它尚未收进日记的修改将被永久删除，无法恢复。" }}>永久删除</NotebookAction>
      </div>
    );
  }
  return (
    <div className={styles.paperActions} data-minimal-reading-actions={minimal ? "" : undefined}>
      <Link data-notebook-continue="" href={kind === "draft" ? draftHref(item) : `/entries/${id}/edit`}
        prefetch transitionTypes={[editTransition]}>
        {kind === "draft" ? "继续写" : item.hasDraft ? "继续修改" : minimal ? "编辑" : "编辑这一篇"}
      </Link>
      {kind === "draft" && item.entryId ? (
        <NotebookAction target={{ mutation: { operation: "discard", kind, id },
          destination: timelineHref("all", item.entryId), confirmation: "放弃这份修改草稿后，原日记仍可照常翻阅。", focus: "reader" }}>放弃修改</NotebookAction>
      ) : (
        <NotebookAction target={{ mutation: { operation: "trash", kind, id },
          destination: timelineHref(tab, "", day) }}>移入回收站</NotebookAction>
      )}
    </div>
  );
}
