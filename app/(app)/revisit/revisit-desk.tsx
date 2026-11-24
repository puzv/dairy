"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { useEdition } from "@/components/edition/edition";
import { formatDiaryDate, MOOD_OPTIONS, moodLabel } from "@/lib/entries";
import { solarTermOn } from "@/lib/solar-terms";
import { recallJournal, recallMinimalJournal, searchJournal } from "./actions";
import { emptySearch, recallOptions, type FoundEntry, type MemoryState, type SearchState } from "./revisit-types";
import styles from "./revisit.module.css";

export function RevisitBackLink() {
  const { edition } = useEdition();
  return <Link href="/timeline" className={styles.back} data-minimal-revisit-back={edition === "minimal" ? "" : undefined}>
    {edition === "minimal" ? "← 目录" : "← 返回目录"}
  </Link>;
}

function EntryLink({ entry, minimal = false }: { entry: FoundEntry; minimal?: boolean }) {
  const mood = moodLabel(entry.mood);
  return (
    <Link href={`/entries/${entry.id}`} prefetch={false} className={styles.entry} data-revisit-entry={minimal ? "" : undefined}>
      <span className={styles.meta} data-revisit-date={minimal ? "" : undefined}>
        <time dateTime={entry.date}>{formatDiaryDate(entry.date)}</time>
        {mood && <span>{mood}</span>}
      </span>
      <strong>{entry.title}</strong>
      <span className={styles.excerpt} data-revisit-excerpt={minimal ? "" : undefined}>{entry.excerpt}</span>
      <span className={styles.read} data-revisit-read={minimal ? "" : undefined} aria-hidden="true">阅读全文 →</span>
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

function SearchPane({ owner, minimal }: { owner: string; minimal: boolean }) {
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
        <label htmlFor="revisit-phrase" className={minimal ? "sr-only" : undefined}>关键词</label>
        <div className={styles.queryLine} data-revisit-query={minimal ? "" : undefined}>
          <input id="revisit-phrase" ref={input} name="phrase" type="search" maxLength={120}
            value={phrase} onChange={event => setPhrase(event.target.value)}
            autoComplete="off" placeholder="搜索标题或正文" enterKeyHint="search" />
          <button type="submit" disabled={pending} className={styles.primary}>
            {pending ? "查找中…" : "查找"}
          </button>
        </div>
        <fieldset className={styles.moods} data-revisit-filter={minimal ? "" : undefined}>
          <legend className={minimal ? "sr-only" : undefined}>心情</legend>
          <div className={styles.options} data-revisit-options={minimal ? "" : undefined}>
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
        <section className={styles.results} aria-labelledby="revisit-found" data-revisit-results={minimal ? "" : undefined}>
          <h2 id="revisit-found" ref={output} tabIndex={-1}>
            {state.entries.length ? `本页找到 ${state.entries.length} 篇` : state.message}
          </h2>
          {state.entries.length > 0 && (
            <ol key={minimal ? JSON.stringify([state.phrase, state.mood, state.entries.map(entry => entry.id)]) : undefined}>
              {state.entries.map(entry => <li key={entry.id}><EntryLink entry={entry} minimal={minimal} /></li>)}
            </ol>
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

function setLocalDate(input: HTMLInputElement | null) {
  if (!input) return;
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  input.value = `${now.getFullYear()}-${month}-${day}`;
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
          <form action={action} onSubmit={() => setLocalDate(date.current)}>
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

function MinimalMemoryPane({ owner }: { owner: string }) {
  const [state, action, pending] = useActionState(recallMinimalJournal.bind(null, owner), {});
  const [choice, setChoice] = useState<(typeof recallOptions)[number]["value"]>("auto");
  const date = useRef<HTMLInputElement>(null);
  const { entry } = state;
  const mood = entry && moodLabel(entry.mood);
  const term = entry && solarTermOn(entry.date)?.name;

  return (
    <div data-revisit-memory>
      <h2>翻一页旧日记</h2>
      <p>自动回望会依次查找往年今日、上月同日和最近一篇旧日记。</p>
      <form action={action} onSubmit={() => setLocalDate(date.current)}>
        <input type="hidden" ref={date} name="today" />
        <fieldset data-revisit-filter>
          <legend className="sr-only">回望日期</legend>
          <div className={styles.options} data-revisit-options>
            {recallOptions.map(option => (
              <label key={option.value}>
                <input type="radio" name="recall" value={option.value} checked={choice === option.value}
                  onChange={() => setChoice(option.value)} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={pending} className={styles.primary}>
          {pending ? "正在翻阅…" : "翻开旧日记"}
        </button>
      </form>
      <p role="status" className={styles.status}>{entry ? `已找到 · ${state.label}` : state.message}</p>
      {entry && (
        <article aria-labelledby="revisit-memory-title" data-revisit-leaf data-minimal-reading>
          <div data-minimal-meta>
            <div>
              <time dateTime={entry.date}>{formatDiaryDate(entry.date)}</time>
              {mood && <span> · {mood}</span>}
              {term && <span> · {term}</span>}
            </div>
          </div>
          <h3 id="revisit-memory-title" data-notebook-reading-title>{entry.title}</h3>
          <div className="journal-prose">
            {(state.body ?? "").split(/(\r?\n(?:[^\S\r\n]*\r?\n)+)/).map((part, index) => index % 2
              ? <span key={index} data-minimal-paragraph-break="">{part}</span>
              : <p key={index}>{part}</p>)}
          </div>
          <Link href={`/entries/${entry.id}`} prefetch={false}>阅读全文 →</Link>
        </article>
      )}
    </div>
  );
}

export function RevisitDesk({ owner }: { owner: string }) {
  const { edition } = useEdition();
  const minimal = edition === "minimal";
  const [mode, setMode] = useState<"search" | "memory">("search");
  return (
    <div className={styles.sheet} data-revisit-sheet={minimal ? "" : undefined}>
      <div className={styles.modes} data-revisit-modes={minimal ? "" : undefined} role="group" aria-label="翻阅方式">
        <button type="button" aria-pressed={mode === "search"} aria-controls="revisit-search"
          onClick={() => setMode("search")}>寻笺</button>
        <button type="button" aria-pressed={mode === "memory"} aria-controls="revisit-memory"
          onClick={() => setMode("memory")}>回望</button>
      </div>
      <section id="revisit-search" hidden={mode !== "search"} aria-label="寻笺"><SearchPane owner={owner} minimal={minimal} /></section>
      <section id="revisit-memory" hidden={mode !== "memory"} aria-label="回望">
        {minimal ? <MinimalMemoryPane owner={owner} /> : <MemoryPane owner={owner} />}
      </section>
    </div>
  );
}
