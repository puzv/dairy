"use client";

import { HeadlessMantineProvider, Textarea } from "@mantine/core";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useActionState, useState } from "react";

import { MOOD_OPTIONS } from "@/lib/entries";
import type { EntryAction, EntryState } from "@/lib/entry-state";
import { initialEntryState } from "@/lib/entry-state";
import type { EntryView } from "@/lib/entry-view";

type EntryFormProps = {
  mode: "create" | "edit";
  action: EntryAction;
  entry?: EntryView;
};

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EntryForm({ mode, action, entry }: EntryFormProps) {
  const [state, formAction, pending] = useActionState<EntryState, FormData>(
    action,
    initialEntryState,
  );
  const [date, setDate] = useState(
    () => entry?.entry_date ?? localToday(),
  );
  const [body, setBody] = useState(entry?.body ?? "");
  const [title, setTitle] = useState(entry?.title ?? "");
  const [mood, setMood] = useState(String(entry?.mood ?? ""));

  const isEdit = mode === "edit";
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
          <input type="hidden" name="version" value={entry.version} />
        </>
      ) : null}

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
            disabled={pending}
            onChange={(event) => setDate(event.target.value)}
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
            disabled={pending}
            onChange={(event) => setMood(event.target.value)}
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
          disabled={pending}
          onChange={(event) => setTitle(event.target.value)}
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
            disabled={pending}
            onChange={(event) => setBody(event.target.value)}
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
        <button type="submit" className="button-primary" disabled={pending}>
          {submitLabel}
        </button>
        <Link
          href={isEdit && entry ? `/entries/${entry.id}` : "/timeline"}
          prefetch={isEdit ? undefined : true}
          transitionTypes={isEdit ? undefined : ["return-journal"]}
          className="text-link entry-cancel-link"
        >
          取消
        </Link>
      </div>

      <p className="form-footnote">
        手动保存后，内容才会写入数据库。
        {isEdit && entry ? ` 当前为第 ${entry.version} 版。` : ""}
      </p>
    </form>
  );
}
