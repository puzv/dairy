"use client";

import { HeadlessMantineProvider, Textarea } from "@mantine/core";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";

import { MOOD_OPTIONS } from "@/lib/entries";
import type { EntryAction, EntryState } from "@/lib/entry-state";
import { initialEntryState } from "@/lib/entry-state";
import type { EntryView } from "@/lib/entry-view";

import type { DraftView } from "@/lib/notebook-types";
import { saveDraftAction } from "@/lib/actions/drafts";
import { EditorDraft } from "./editor-draft";

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
  const isEdit = mode === "edit";
  const current = useSyncExternalStore(editor.subscribe, editor.snapshot, editor.snapshot);
  const { date, body, title, mood } = current.fields;
  const [state, formAction, pending] = useActionState<EntryState, FormData>(
    async (previous, data) => {
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
      return action(previous, data);
    }, initialEntryState,
  );

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
      if (!(link instanceof HTMLAnchorElement) || link.target || link.origin !== location.origin ||
        link.hasAttribute("download") || link.pathname === location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      void editor.flush().then(saved => {
        if (saved) router.push(link.pathname + link.search + link.hash, {
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
      editor.detach();
    };
  }, [editor, router]);

  const disabled = pending || current.status === "loading" || current.status === "missing";
  const fieldErrors = state.fieldErrors ?? {};
  const submitLabel = pending
    ? "正在保存…"
    : isEdit
      ? "保存修改"
      : "保存这篇";

  return (
    <form action={formAction} className="entry-form">
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
            aria-describedby={
              fieldErrors.date ? "entry-date-error" : "entry-date-hint"
            }
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
        </div>

        <div className="field">
          <label className="field-label" htmlFor="entry-mood">
            情绪 <span aria-hidden="true">（可选）</span>
          </label>
          <select
            id="entry-mood"
            name="mood"
            className="field-control"
            value={mood}
            disabled={disabled}
            onChange={(event) => editor.change("mood", event.target.value)}
            aria-invalid={Boolean(fieldErrors.mood)}
            aria-describedby={fieldErrors.mood ? "entry-mood-error" : undefined}
          >
            <option value="">不标注</option>
            {MOOD_OPTIONS.map((option) => (
              <option value={String(option.value)} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {fieldErrors.mood ? (
            <p className="field-error" id="entry-mood-error">
              {fieldErrors.mood}
            </p>
          ) : null}
        </div>
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
          disabled={disabled}
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
            maxRows={24}
            id="entry-body"
            name="body"
            value={body}
            disabled={disabled}
            onChange={(event) => editor.change("body", event.target.value)}
            maxLength={50_000}
            placeholder="今天发生了什么？哪怕只写一句。"
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

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={disabled}>
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

      <div className="field-hint" role="status" aria-live="polite">
        {current.message}
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
    </form>
  );
}
