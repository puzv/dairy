"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { mutateNotebook } from "@/lib/actions/notebook";
import { timelineHref } from "./notebook-links";
import styles from "./notebook.module.css";

type Mutation = Omit<Parameters<typeof mutateNotebook>[0], "expectedOwnerId">;
type Target = { mutation: Mutation; destination?: string; confirmation?: string; focus?: "tab" | "reader" };
type Notice = { text: string; undo?: Target; focus?: Target["focus"] };
type Controls = { pending: boolean; request: (target: Target) => void };

const Context = createContext<Controls | null>(null);
const confirmTitles = {
  discard: ["放弃这次修改？", "放弃修改"],
  purge: ["永久删除这篇？", "永久删除"],
  empty: ["清空回收站？", "清空回收站"],
};

function focusVisible(selector: string) {
  const node = [...document.querySelectorAll<HTMLElement>(selector)].find(item => item.getClientRects().length > 0);
  node?.focus({ preventScroll: true });
  return Boolean(node);
}

export function NotebookActionsProvider({ children, ownerId }: { children: ReactNode; ownerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [target, setTarget] = useState<Target | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeButton = useRef<HTMLButtonElement>(null);
  const confirmId = useId();
  const confirmBodyId = useId();

  useEffect(() => {
    if (target && !dialog.current?.open) dialog.current?.showModal();
  }, [target]);

  useEffect(() => {
    if (!notice || pending) return;
    if (notice.focus === "tab" && focusVisible("[data-notebook-tab][aria-current=page], [data-notebook-back]")) return;
    if (notice.focus === "reader" && focusVisible("[data-notebook-back], [data-notebook-bookmark], [data-notebook-continue]")) return;
    noticeButton.current?.focus({ preventScroll: true });
  }, [notice, pending]);

  function perform(item: Target) {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        const result = await mutateNotebook({ ...item.mutation, expectedOwnerId: ownerId });
        if (!result.ok) {
          setNotice({ text: result.message });
          return;
        }
        const { operation, kind, id } = item.mutation;
        const undo = operation === "trash" ? {
          mutation: { operation: "restore" as const, kind, id },
          destination: timelineHref(kind === "draft" ? "drafts" : "all", id),
          focus: "reader" as const,
        } : undefined;
        setNotice({ text: result.message, undo, focus: item.focus });
        if (item.destination && item.destination !== location.pathname + location.search) {
          router.replace(item.destination, { scroll: false });
        } else {
          router.refresh();
        }
      } catch {
        setNotice({ text: "操作暂时未完成，请重试。" });
      } finally {
        busy.current = false;
      }
    });
  }

  function request(item: Target) {
    if (pending || busy.current) return;
    if (item.confirmation) setTarget(item);
    else perform(item);
  }

  function closeNotice() {
    setNotice(null);
    focusVisible("[data-notebook-back], [data-notebook-tab][aria-current=page], [data-notebook-bookmark]");
  }

  const operation = target?.mutation.operation;
  const confirmation = operation && operation in confirmTitles
    ? confirmTitles[operation as keyof typeof confirmTitles] : undefined;
  return (
    <Context.Provider value={{ pending, request }}>
      {children}
      {notice && (
        <div className={styles.notice}>
          <span role="status">{notice.text}</span>
          {notice.undo && <button className={styles.noticeUndo} ref={noticeButton} type="button" disabled={pending}
            onClick={() => notice.undo && perform(notice.undo)}>撤销</button>}
          <button ref={notice.undo ? undefined : noticeButton} type="button" aria-label="关闭提示" onClick={closeNotice}>×</button>
        </div>
      )}
      <dialog className={styles.dialog} ref={dialog} aria-labelledby={confirmId} aria-describedby={confirmBodyId}
        onClose={() => setTarget(null)}>
        <h2 id={confirmId}>{confirmation?.[0]}</h2><p id={confirmBodyId}>{target?.confirmation}</p>
        <div className={styles.dialogActions}>
          <button type="button" autoFocus onClick={() => dialog.current?.close()}>取消</button>
          <button type="button" className={styles.solid} disabled={pending} onClick={() => {
            dialog.current?.close();
            if (target) perform(target);
          }}>{confirmation?.[1]}</button>
        </div>
      </dialog>
    </Context.Provider>
  );
}

type ActionProps = {
  target: Target;
  children: ReactNode;
  bookmark?: boolean;
  className?: string;
};

export function NotebookAction({ target, children, bookmark, className }: ActionProps) {
  const controls = useContext(Context);
  if (!controls) throw new Error("NotebookAction requires NotebookActionsProvider");
  return (
    <button type="button" className={className} disabled={controls.pending} aria-pressed={bookmark}
      data-notebook-bookmark={bookmark !== undefined ? "" : undefined} onClick={() => controls.request(target)}>
      {children}
    </button>
  );
}
