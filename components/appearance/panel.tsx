"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { accents, bindings, defaultPrefs, rulings, type Accent, type Paper, type Preferences, type Ruling } from "@/lib/appearance/preferences";
import { bundledLibrary } from "@/lib/appearance/bundled-feature";
import { personalLibrary } from "@/lib/appearance/personal-feature";
import type { usePreferences } from "./use-preferences";
import styles from "./panel.module.css";

const papers = Object.keys(bindings) as Paper[];
const inkColors = Object.keys(accents) as Accent[];
const lines = Object.keys(rulings) as Ruling[];

function recipe(paper: Paper): Preferences {
  const { accent, ruling, titleFont, bodyFont } = bindings[paper];
  return { paper, accent, ruling, titleFont: bundledLibrary ? titleFont : "system", bodyFont: bundledLibrary ? bodyFont : "system" };
}

export function AppearancePanel({ settings, close, closing, onClosed }: {
  settings: ReturnType<typeof usePreferences>;
  close: () => void;
  closing: boolean;
  onClosed: () => void;
}) {
  const { prefs, records, update, message, pending, removeFont } = settings;
  const [tab, setTab] = useState<"sets" | "mix">("sets");
  const [importing, setImporting] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panelNode = useRef<HTMLElement>(null);
  const motion = useRef<Animation | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const selected = recipe(prefs.paper);
  const matched = selected.accent === prefs.accent && selected.ruling === prefs.ruling &&
    selected.titleFont === prefs.titleFont && selected.bodyFont === prefs.bodyFont;

  useLayoutEffect(() => {
    const node = panelNode.current;
    if (!node) return;
    if (!closing) closeButton.current?.focus({ preventScroll: true });

    if (typeof node.animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (closing) onClosed();
      return;
    }
    // Reuse the active animation so a second click reverses from its current frame.
    let animation = motion.current;
    if (!animation) {
      const bottom = node.parentElement?.hasAttribute("data-appearance-fallback");
      try {
        animation = node.animate([
          { opacity: 0, transform: bottom ? "translateY(1.5rem)" : "translateX(1.25rem)" },
          { opacity: 1, transform: "none" },
        ], { duration: 220, easing: "cubic-bezier(.2,.7,.25,1)", fill: "both" });
      } catch {
        if (closing) onClosed();
        return;
      }
      if (closing) animation.currentTime = 220;
      motion.current = animation;
    }
    animation.playbackRate = closing ? -1.25 : 1;
    animation.play();
    const finish = () => {
      window.clearTimeout(fallback);
      if (closing) onClosed();
      else {
        animation.cancel();
        motion.current = null;
      }
    };
    animation.onfinish = finish;
    const fallback = window.setTimeout(finish, 320);
    return () => {
      animation.onfinish = null;
      window.clearTimeout(fallback);
    };
  }, [closing, onClosed]);

  useLayoutEffect(() => () => {
    motion.current?.cancel();
    motion.current = null;
  }, []);

  const localOptions = records.map(font => ({
    ...font, label: records.some(other => other.id !== font.id && other.label === font.label)
      ? `${font.label} · ${font.id.slice(6, 12)}` : font.label,
  }));
  const fonts = [{ id: "system", label: "原设字体" }, ...(bundledLibrary?.fonts ?? []), ...localOptions];
  const name = (id: string) => fonts.find(font => font.id === id)?.label ?? "本机字体";

  return (
    <aside ref={panelNode} inert={closing} id="journal-appearance-panel" aria-labelledby="journal-appearance-heading" className={styles.panel}>
      <header className={styles.head}>
        <div><h2 id="journal-appearance-heading">外观</h2>
          <p>当前 <strong>{matched ? bindings[prefs.paper].name : "自定义"}</strong></p></div>
        <button type="button" className={styles.close} onClick={() => close()} aria-label="关闭外观" ref={closeButton}>×</button>
      </header>
      <div role="tablist" className={styles.tabs} ref={tabs} aria-label="外观设置方式" onKeyDown={event => {
        const arrows = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!arrows.includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "sets" : event.key === "End" ? "mix" : tab === "sets" ? "mix" : "sets";
        setTab(next);
        tabs.current?.querySelector<HTMLButtonElement>(`#appearance-tab-${next}`)?.focus();
      }}>
        {(["sets", "mix"] as const).map(id => <button type="button" key={id} role="tab" id={`appearance-tab-${id}`}
          aria-selected={tab === id} aria-controls={`appearance-pane-${id}`} tabIndex={tab === id ? 0 : -1}
          onClick={() => setTab(id)}>{id === "sets" ? "主题套装" : "自由搭配"}</button>)}
      </div>
      <section role="tabpanel" id="appearance-pane-sets" aria-labelledby="appearance-tab-sets" hidden={tab !== "sets"}>
        <div className={styles.sets}>
          {papers.map(paper => {
            const set = bindings[paper];
            return <button type="button" key={paper} data-set={paper} aria-pressed={matched && prefs.paper === paper}
              className={styles.card} onClick={() => update(recipe(paper))}>
              <span aria-hidden="true" data-appearance-swatch={paper} className={`appearance-swatch ${styles.mini}`}>
                <i className="swatch-cover" /><i className="swatch-index" /><i className="swatch-page" />
              </span>
              <b>{set.name}</b><small>{set.stock} · {accents[set.accent][0]}</small>
            </button>;
          })}
        </div>
        <p className={styles.recipe}>{bundledLibrary && <>标题 · {name(prefs.titleFont)}　正文 · {name(prefs.bodyFont)}　</>}{rulings[prefs.ruling]}</p>
      </section>
      <section role="tabpanel" id="appearance-pane-mix" aria-labelledby="appearance-tab-mix" hidden={tab !== "mix"} className={styles.mix}>
        <label className={styles.row}>笺纸<select value={prefs.paper} onChange={e => update({ paper: e.target.value as Paper })}>
          {papers.map(paper => <option key={paper} value={paper}>{bindings[paper].stock}</option>)}</select></label>
        <fieldset><legend>印色</legend><div className={styles.inks}>
          {inkColors.map(ink => <label key={ink}><input type="radio" name="journal-ink" value={ink} checked={prefs.accent === ink}
            onChange={() => update({ accent: ink })} /><i aria-hidden="true" style={{ backgroundColor: accents[ink][1] }} />{accents[ink][0]}</label>)}
        </div></fieldset>
        <fieldset><legend>栏线</legend><div className={styles.rulings}>
          {lines.map(line => <label key={line}><input type="radio" name="journal-ruling" value={line} checked={prefs.ruling === line}
            onChange={() => update({ ruling: line })} />{rulings[line]}</label>)}
        </div></fieldset>
        {(bundledLibrary || personalLibrary) && <div className={styles.fonts}>{(["titleFont", "bodyFont"] as const).map(role =>
          <label className={styles.row} key={role}>{role === "titleFont" ? "标题字体" : "正文字体"}
            <select value={prefs[role]} onChange={e => update({ [role]: e.target.value })}>
              {prefs[role].startsWith("local:") && !fonts.some(font => font.id === prefs[role]) && (
                <option value={prefs[role]}>本机字体（待载入）</option>
              )}
              {fonts.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}
            </select>
          </label>)}</div>}
        {personalLibrary && <div className={styles.library}>
          <button type="button" className={styles.import} disabled={importing} onClick={() => picker.current?.click()}>
            {importing ? "正在导入…" : "＋ 导入本机字体"}</button>
          <input type="file" hidden multiple ref={picker} accept=".ttf,.otf,.woff2" onChange={async e => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            setImporting(true);
            try { await settings.importFiles(files); } finally { setImporting(false); }
          }} />
          <p>TTF、OTF、WOFF2 · 仅保存在此浏览器</p>
          {localOptions.length > 0 && <ul>{localOptions.map(font => <li key={font.id}>
            <span>{font.label}{!font.persistent && "（仅本次）"}</span>
            <button type="button" aria-label={`移除 ${font.label}`} onClick={() => void removeFont(font.id)}>移除</button>
          </li>)}</ul>}
        </div>}
      </section>
      <div role="status" aria-live="polite" className={styles.status}>{pending ? "正在加载字体…" : message}
        {settings.canRetry && !pending && <button type="button" onClick={settings.retry}>重试加载</button>}
      </div>
      <footer className={styles.foot}>
        <button type="button" onClick={() => update(defaultPrefs)}>恢复默认</button>
        <button type="button" className={styles.done} onClick={() => close()}>完成</button>
      </footer>
    </aside>
  );
}
