"use client";

import { HeadlessMantineProvider, Textarea } from "@mantine/core";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";

import styles from "@/app/(app)/entries/new/writing-desk.module.css";
import { useEdition } from "@/components/edition/edition";
import type { EntryAction, EntryState } from "@/lib/entry-state";
import { initialEntryState } from "@/lib/entry-state";
import type { EntryView } from "@/lib/entry-view";

import type { DraftView } from "@/lib/notebook-types";
import { saveDraftAction } from "@/lib/actions/drafts";
import { currentSolarTerm } from "@/lib/solar-terms";
import { EditorDraft } from "./editor-draft";
import { MoodPicker } from "./mood-picker";
import { isDesktopWidth, useDesktopWidth } from "./use-desktop-width";

const draftLabels: Partial<Record<ReturnType<EditorDraft["snapshot"]>["status"], string>> = {
  loading: "正在打开草稿…",
  pending: "未保存的修改",
  saving: "正在保存草稿…",
  saved: "草稿已自动保存",
};

function DraftSavedTime({ savedAt }: { savedAt: number }) {
  const [recent, setRecent] = useState(true);
  useEffect(() => {
    // After the first minute use the actual clock time; no polling or live announcement.
    const timer = setTimeout(() => setRecent(false), Math.max(0, savedAt + 60_000 - Date.now()));
    return () => clearTimeout(timer);
  }, [savedAt]);
  const time = new Date(savedAt);
  const label = time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return <>{" · "}<time dateTime={time.toISOString()} title={label}>{recent ? "刚刚" : label}</time></>;
}

type EntryFormProps = {
  ownerId: string;
  scope: string;
  requestedId?: string | null;
  draft: DraftView | null;
  mode: "create" | "edit";
  action: EntryAction;
  entry?: EntryView;
};

function openEditor({ entry, ownerId, scope, requestedId = null, draft }: EntryFormProps) {
  return new EditorDraft({
    ownerId, scope, requestedId, draft,
    entryId: entry?.id ?? null,
    baseVersion: entry?.version ?? null,
    initial: {
      date: entry?.entry_date ?? "",
      body: entry?.body ?? "",
      title: entry?.title ?? "",
      mood: String(entry?.mood ?? ""),
    },
  }, saveDraftAction);
}

export function EntryForm(props: EntryFormProps) {
  const routeId = props.requestedId ?? props.entry?.id ?? null;
  const [slot, setSlot] = useState(() => ({ routeId, editor: openEditor(props), key: 0 }));
  if (routeId !== slot.routeId) {
    // The first autosave reserves our own URL. A server refresh of that URL
    // must retain the active form, its caret, pending publish and write queue.
    const samePaper = routeId !== null && slot.editor.snapshot().id === routeId;
    setSlot(samePaper
      ? { ...slot, routeId }
      : { routeId, editor: openEditor(props), key: slot.key + 1 });
  }
  return <PaperEditor key={slot.key} {...props} editor={slot.editor} />;
}

function PaperEditor({ mode, action, entry, ownerId, editor }: EntryFormProps & { editor: EditorDraft }) {
  const router = useRouter();
  const { edition } = useEdition();
  const desktopWidth = useDesktopWidth();
  const isDesktop = desktopWidth && edition === "shanjian";
  const isEdit = mode === "edit";
  const current = useSyncExternalStore(editor.subscribe, editor.snapshot, editor.snapshot);
  const { date, body, title, mood } = current.fields;
  const season = isDesktop && !isEdit ? currentSolarTerm(date) : null;
  const seasonPrompt = season && season.date === date ? season.prompt : undefined;
  // Compare calendar dates at UTC midnight, not local instants that can straddle DST.
  const seasonNote = season && season.date !== date
    ? `时令 · ${season.name}后第 ${(Date.parse(date) - Date.parse(season.date)) / 86_400_000} 天`
    : null;
  const submitButton = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const composing = useRef(false);
  const leaveDialog = useRef<HTMLDialogElement>(null);
  const destination = useRef<{ href: string; path: string } | null>(null);
  const [leavePhase, setLeavePhase] = useState<"ready" | "saving" | "blocked">("ready");
  const [state, formAction, pending] = useActionState<EntryState, FormData>(
    async (previous, data) => {
      try {
        if (!await editor.flush()) {
          return { status: "error", message: editor.snapshot().message };
        }
        const { id, revision, baseVersion } = editor.snapshot();
        data.set("editor_owner_id", ownerId);
        if (id && revision > 0) {
          data.set("draft_id", id);
          data.set("draft_revision", String(revision));
        }
        if (baseVersion !== null) data.set("version", String(baseVersion));
        return await action(previous, data);
      } finally {
        submitting.current = false;
      }
    }, initialEntryState,
  );

  useEffect(() => {
    if (!isDesktop) {
      destination.current = null;
      leaveDialog.current?.close();
    }
  }, [isDesktop]);

  useEffect(() => {
    const resumeId = editor.attach();
    if (resumeId) router.replace(`/entries/new?draft=${resumeId}`, { scroll: false });
    const flushHidden = () => {
      if (document.visibilityState === "hidden" && editor.canFlush()) void editor.flush();
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (editor.needsUnloadWarning()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    // The cover, header and footer all leave this same paper editor.
    const leaveWithDraft = (event: MouseEvent) => {
      if (!editor.needsRecovery() || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.origin !== location.origin ||
        link.pathname.startsWith("//") || link.hasAttribute("download")) return;
      const desktop = isDesktopWidth() && document.documentElement.dataset.edition === "shanjian";
      if (desktop) {
        if ((link.target && link.target.toLowerCase() !== "_self") ||
          (link.pathname === location.pathname && link.search === location.search)) return;
      } else if (link.target || link.pathname === location.pathname) {
        return;
      }
      const href = link.pathname + link.search + link.hash;
      event.preventDefault();
      event.stopPropagation();
      const dialog = leaveDialog.current;
      if (desktop && dialog) {
        destination.current = { href, path: link.pathname };
        setLeavePhase("ready");
        if (!dialog.open) dialog.showModal();
        return;
      }
      void editor.flush().then(saved => {
        if (saved) router.push(href, {
          transitionTypes: link.pathname === "/timeline" ? ["return-journal"] : undefined,
        });
      });
    };
    const retryOnline = () => { if (editor.canFlush()) void editor.flush(); };
    let releaseLogout = false;
    let loggingOut = false;
    const flushBeforeLogout = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches(".logout-form") ||
        releaseLogout || !editor.needsRecovery()) return;
      event.preventDefault();
      event.stopPropagation();
      if (loggingOut) return;
      loggingOut = true;
      void editor.flush().then(saved => {
        loggingOut = false;
        if (!form.isConnected) return;
        if (saved || window.confirm("草稿尚未同步。仍要退出并清除此标签页暂存的文字吗？")) {
          releaseLogout = true;
          form.requestSubmit();
          releaseLogout = false;
        }
      });
    };
    const verifyRestoredSession = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("online", retryOnline);
    window.addEventListener("pageshow", verifyRestoredSession);
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("visibilitychange", flushHidden);
    document.addEventListener("click", leaveWithDraft, true);
    document.addEventListener("submit", flushBeforeLogout, true);
    return () => {
      window.removeEventListener("online", retryOnline);
      window.removeEventListener("pageshow", verifyRestoredSession);
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("visibilitychange", flushHidden);
      document.removeEventListener("click", leaveWithDraft, true);
      document.removeEventListener("submit", flushBeforeLogout, true);
      destination.current = null;
      editor.detach();
    };
  }, [editor, router]);

  function closeLeaveDialog() {
    destination.current = null;
    leaveDialog.current?.close();
  }

  async function confirmLeave() {
    const next = destination.current;
    if (!next || leavePhase === "saving") return;
    setLeavePhase("saving");
    const synced = await editor.flush();
    // Escape, "继续写" or a theme/viewport change can cancel while syncing.
    if (destination.current !== next) return;
    if (!synced && !editor.hasTabRecovery()) {
      setLeavePhase("blocked");
      return;
    }
    closeLeaveDialog();
    router.push(next.href, {
      transitionTypes: next.path === "/timeline" ? ["return-journal"] : undefined,
    });
  }

  const unavailable = current.status === "loading" || current.status === "missing";
  const disabled = pending || unavailable;
  // Keep the text field focused so a second shortcut cannot open the browser's save dialog.
  const readOnly = isDesktop && pending;
  const textDisabled = unavailable || (pending && !readOnly);
  const fieldErrors = state.fieldErrors ?? {};
  const dateHintId = fieldErrors.date ? "entry-date-error" : "entry-date-hint";
  const draftStatus = (isDesktop ? draftLabels[current.status] : undefined) ?? current.message;
  const submitLabel = pending
    ? "正在保存…"
    : isEdit
      ? "保存修改"
      : "保存这篇";

  return (
    <form action={formAction} className="entry-form"
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={event => {
        if (!isDesktop || event.defaultPrevented || !(event.metaKey || event.ctrlKey) ||
          event.altKey || event.shiftKey || event.key.toLowerCase() !== "s" ||
          composing.current || event.nativeEvent.isComposing || event.keyCode === 229 ||
          !(event.target instanceof HTMLElement) ||
          (event.target.id !== "entry-title" && event.target.id !== "entry-body")) return;
        event.preventDefault();
        const button = submitButton.current;
        if (!disabled && !submitting.current && !event.repeat && button) {
          event.currentTarget.requestSubmit(button);
        }
      }}
      onSubmit={event => {
        if (!isDesktop) return;
        if (disabled || submitting.current) {
          event.preventDefault();
        } else {
          submitting.current = true;
        }
      }}>
      {isEdit && entry ? (
        <>
          <input type="hidden" name="entry_id" value={entry.id} />
          <input type="hidden" name="version" value={current.baseVersion ?? entry.version} />
        </>
      ) : null}

      <input type="hidden" name="editor_owner_id" value={ownerId} />
      {current.id && current.revision > 0 && (
        <>
          <input type="hidden" name="draft_id" value={current.id} />
          <input type="hidden" name="draft_revision" value={current.revision} />
        </>
      )}

      <div className="form-row">
        <div className="field">
          <label className="field-label" htmlFor="entry-date">
            日期
          </label>
          <input
            id="entry-date"
            name="date"
            type="date"
            className="field-control"
            value={date}
            disabled={disabled}
            onChange={(event) => editor.change("date", event.target.value)}
            suppressHydrationWarning
            aria-invalid={Boolean(fieldErrors.date)}
            aria-describedby={seasonNote ? `${dateHintId} entry-season-hint` : dateHintId}
            required
          />
          {fieldErrors.date ? (
            <p className="field-error" id="entry-date-error">
              {fieldErrors.date}
            </p>
          ) : (
            <p className="field-hint" id="entry-date-hint">
              默认是此刻设备上的今天。
            </p>
          )}
          {seasonNote && <p className={styles.seasonHint} id="entry-season-hint">{seasonNote}</p>}
        </div>

        <MoodPicker value={mood} disabled={disabled} error={fieldErrors.mood}
          onChange={value => editor.change("mood", value)} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="entry-title">
          标题 <span aria-hidden="true">（可选）</span>
        </label>
        <Input
          id="entry-title"
          name="title"
          type="text"
          placeholder={isEdit ? undefined : "为今天题名"}
          maxLength={200}
          value={title}
          disabled={textDisabled}
          readOnly={readOnly}
          onChange={(event) => editor.change("title", event.target.value)}
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={
            fieldErrors.title ? "entry-title-error" : "entry-title-hint"
          }
        />
        {fieldErrors.title ? (
          <p className="field-error" id="entry-title-error">
            {fieldErrors.title}
          </p>
        ) : (
          <p className="field-hint" id="entry-title-hint">
            标题留空时，以正文第一行为题。
          </p>
        )}
      </div>

      <div className="field">
        <div className="field-meta">
          <label className="field-label" htmlFor="entry-body">
            正文
          </label>
          <span className="character-count" aria-hidden="true">
            {body.length} / 50000
          </span>
        </div>
        <HeadlessMantineProvider>
          <Textarea
            autosize
            minRows={8}
            maxRows={isDesktop ? undefined : 24}
            id="entry-body"
            name="body"
            value={body}
            disabled={textDisabled}
            readOnly={readOnly}
            onChange={(event) => editor.change("body", event.target.value)}
            maxLength={50_000}
            placeholder={seasonPrompt ?? "今天发生了什么？哪怕只写一句。"}
            classNames={{ input: "field-control" }}
            aria-invalid={Boolean(fieldErrors.body)}
            aria-describedby={fieldErrors.body ? "entry-body-error" : undefined}
            required
          />
        </HeadlessMantineProvider>
        {fieldErrors.body ? (
          <p className="field-error" id="entry-body-error">
            {fieldErrors.body}
          </p>
        ) : null}
      </div>

      {state.status === "error" && state.message ? (
        <p className="form-alert" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className={styles.saveBar}>
        <div className="form-actions">
          <button ref={submitButton} type="submit" className="button-primary" disabled={disabled}
            aria-keyshortcuts={isDesktop ? "Control+S Meta+S" : undefined}>
            {submitLabel}
          </button>
          <Link
            href="/timeline"
            prefetch={true}
            transitionTypes={["return-journal"]}
            className="text-link entry-cancel-link"
          >
            返回目录
          </Link>
        </div>

        <div className={`field-hint ${styles.draftSlip}`}
          role={isDesktop ? undefined : "status"} aria-live={isDesktop ? undefined : "polite"}>
          {isDesktop ? <span role="status" aria-live="polite">{draftStatus}</span> : draftStatus}
          {isDesktop && current.status === "saved" && current.savedAt !== null && (
            <DraftSavedTime key={current.savedAt} savedAt={current.savedAt} />
          )}
          {current.status === "error" && (
            <>　<button type="button" className="text-link" onClick={() => { void editor.flush(); }}>重试</button></>
          )}
          {current.status === "conflict" && (
            <>　<button type="button" className="text-link" onClick={() => {
              const id = editor.saveAsNew();
              if (id) router.push(`/entries/new?draft=${id}`);
            }}>另存为新草稿</button></>
          )}
          {current.status === "missing" && <>　<Link href="/entries/new" className="text-link">另写一篇</Link></>}
        </div>
        <p className="form-footnote">
          手动保存后，这些文字会收进日记。
          {isEdit && entry ? ` 当前为第 ${entry.version} 版。` : ""}
        </p>
      </div>

      <dialog ref={leaveDialog} className={styles.leaveDialog}
        aria-labelledby="entry-leave-title" aria-describedby="entry-leave-description"
        onCancel={event => { event.preventDefault(); closeLeaveDialog(); }}>
        <h2 id="entry-leave-title">要离开吗？</h2>
        <p id="entry-leave-description">未保存的修改会保留为草稿。如果暂时无法同步，可以在此标签页重新打开续写。</p>
        <p className={styles.leaveFeedback} role="status" aria-live="polite">
          {leavePhase === "saving" ? "正在保存草稿…" : leavePhase === "blocked"
            ? "草稿还没能保存，且这个标签页没有可用的暂存。请重试或继续写。" : ""}
        </p>
        <div className={styles.leaveActions}>
          <button type="button" className="button-secondary" onClick={closeLeaveDialog}>继续写</button>
          <button type="button" className="button-primary" aria-disabled={leavePhase === "saving"}
            onClick={() => { void confirmLeave(); }}>
            {leavePhase === "blocked" ? "重试并离开" : "保留草稿并离开"}
          </button>
        </div>
      </dialog>
    </form>
  );
}
