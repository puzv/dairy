"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { formatDiaryDate, MOOD_OPTIONS, moodLabel } from "@/lib/entries";
import { recallJournal, searchJournal } from "./actions";
import { emptySearch, type FoundEntry, type MemoryState, type SearchState } from "./revisit-types";
import styles from "./revisit.module.css";

function EntryLink({ entry }: { entry: FoundEntry }) {
  const mood = moodLabel(entry.mood);
  return (
    <Link href={`/entries/${entry.id}`} prefetch={false} className={styles.entry}>
      <span className={styles.meta}>
        <time dateTime={entry.date}>{formatDiaryDate(entry.date)}</time>
        {mood && <span>{mood}</span>}
      </span>
      <strong>{entry.title}</strong>
      <span className={styles.excerpt}>{entry.excerpt}</span>
      <span className={styles.read} aria-hidden="true">阅读全文 →</span>
    </Link>
  );
}

function PageTurn({ state, turn, action, pending }: {
  state: SearchState; turn: "newer" | "older"; action: (form: FormData) => void; pending: boolean;
}) {
  const cursor = turn === "newer" ? state.entries[0] : state.entries[state.entries.length - 1];
  return (
    <form action={action}>
      <input type="hidden" name="turn" value={turn} />
      <input type="hidden" name="phrase" value={state.phrase} />
      <input type="hidden" name="mood" value={state.mood} />
      <input type="hidden" name="cursorDate" value={cursor.date} />
      <input type="hidden" name="cursorId" value={cursor.id} />
      <button className={styles.textAction} disabled={pending}>{turn === "newer" ? "← 上一页" : "下一页 →"}</button>
    </form>
  );
}

function SearchPane({ owner }: { owner: string }) {
  const [state, action, pending] = useActionState(searchJournal.bind(null, owner), emptySearch);
  const [phrase, setPhrase] = useState("");
  const [mood, setMood] = useState("");
  const output = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.phase === "results") output.current?.focus();
  }, [state]);
  return (
    <>
      <form action={action} className={styles.search}>
        <label htmlFor="revisit-phrase">关键词</label>
        <div className={styles.queryLine}>
          <input id="revisit-phrase" ref={input} name="phrase" type="search" maxLength={120}
            value={phrase} onChange={event => setPhrase(event.target.value)}
            autoComplete="off" placeholder="搜索标题或正文" enterKeyHint="search" />
          <button type="submit" disabled={pending} className={styles.primary}>
            {pending ? "查找中…" : "查找"}
          </button>
        </div>
        <fieldset className={styles.moods}>
          <legend>心情</legend>
          <div className={styles.options}>
            {[{ value: "", label: "全部" }, ...MOOD_OPTIONS].map(option => (
              <label key={option.value}>
                <input type="radio" name="mood" value={option.value}
                  checked={mood === String(option.value)} onChange={event => setMood(event.target.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {(phrase || mood || state.phase !== "idle") && (
          <button name="turn" value="clear" type="submit" disabled={pending} className={styles.textAction}
            onClick={() => { setPhrase(""); setMood(""); input.current?.focus(); }}>
            清除查找
          </button>
        )}
      </form>
      {state.phase === "error" && <p className={styles.status} role="alert">{state.message}</p>}
      {state.phase === "results" && (
        <section className={styles.results} aria-labelledby="revisit-found">
          <h2 id="revisit-found" ref={output} tabIndex={-1}>
            {state.entries.length ? `本页找到 ${state.entries.length} 篇` : state.message}
          </h2>
          {state.entries.length > 0 && (
            <ol>{state.entries.map(entry => <li key={entry.id}><EntryLink entry={entry} /></li>)}</ol>
          )}
          {(state.hasNewer || state.hasOlder) && (
            <nav aria-label="查找结果翻页" className={styles.pager}>
              {state.hasNewer && <PageTurn state={state} action={action} turn="newer" pending={pending} />}
              {state.hasOlder && <PageTurn state={state} action={action} turn="older" pending={pending} />}
            </nav>
          )}
        </section>
      )}
    </>
  );
}

function MemoryPane({ owner }: { owner: string }) {
  const [state, action, pending] = useActionState<MemoryState, FormData>(recallJournal.bind(null, owner), {});
  const date = useRef<HTMLInputElement>(null);
  return (
    <div className={styles.memory}>
      <h2>{state.label || "翻一页旧日记"}</h2>
      {state.entry ? <EntryLink entry={state.entry} /> : (
        <>
          <p>先找往年今日，再看上月同日。都没有时，翻开最近的一篇旧日记。</p>
          <form action={action} onSubmit={() => {
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const day = String(now.getDate()).padStart(2, "0");
            if (date.current) date.current.value = `${now.getFullYear()}-${month}-${day}`;
          }}>
            <input type="hidden" ref={date} name="today" />
            <button type="submit" disabled={pending} className={styles.primary}>{pending ? "正在翻阅…" : "翻开旧日记"}</button>
          </form>
        </>
      )}
      <span role="status" className={state.entry ? styles.announcement : styles.status}>
        {state.message || (state.entry ? `已找到${state.label}：${state.entry.title}` : "")}
      </span>
    </div>
  );
}

export function RevisitDesk({ owner }: { owner: string }) {
  const [mode, setMode] = useState<"search" | "memory">("search");
  return (
    <div className={styles.sheet}>
      <div className={styles.modes} role="group" aria-label="翻阅方式">
        <button type="button" aria-pressed={mode === "search"} aria-controls="revisit-search"
          onClick={() => setMode("search")}>寻笺</button>
        <button type="button" aria-pressed={mode === "memory"} aria-controls="revisit-memory"
          onClick={() => setMode("memory")}>回望</button>
      </div>
      <section id="revisit-search" hidden={mode !== "search"} aria-label="寻笺"><SearchPane owner={owner} /></section>
      <section id="revisit-memory" hidden={mode !== "memory"} aria-label="回望"><MemoryPane owner={owner} /></section>
    </div>
  );
}
