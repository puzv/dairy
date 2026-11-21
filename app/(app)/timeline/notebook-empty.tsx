import Link from "next/link";
import type { NotebookTab } from "@/lib/notebook-types";
import styles from "./empty.module.css";

const copy = {
  all: ["还没有日记", "写下第一篇，往后的日子就能按月翻阅。"],
  drafts: ["还没有草稿", "写到一半时返回目录，文字会自动收在这里。"],
  favorites: ["还没有收藏", "翻阅日记时点「收藏」，就能在这里重读。"],
  trash: ["回收站是空的", "移入回收站的日记和草稿，可以在这里恢复。"],
  day: ["这一天还没有日记", "回到全部日记，翻阅其他日期的记录。"],
} as const;

export function NotebookEmpty({ tab, day }: { tab: NotebookTab; day: string }) {
  const scope = day ? "day" : tab;
  const [title, description] = copy[scope];
  return (
    <div className={styles.empty} data-empty-scope={scope}>
      <div className={styles.stationery} aria-hidden="true">
        <span className={styles.print} />
        <span className={styles.note}><i /></span>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className={styles.actions}>
        {(scope === "all" || scope === "drafts") && (
          <Link href="/entries/new" transitionTypes={["write-journal"]}>
            {scope === "drafts" ? "起一份草稿" : "写下第一篇"} <span aria-hidden="true">→</span>
          </Link>
        )}
        {scope !== "all" && <Link href="/timeline">回到全部日记</Link>}
      </div>
    </div>
  );
}
