"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { bundledLibrary } from "@/lib/appearance/bundled-feature";
import { personalLibrary } from "@/lib/appearance/personal-feature";
import type { FontRecord } from "@/lib/appearance/contracts";
import {
  applyPaper, defaultPrefs, oldPrefKey, prefKey, readPreferences,
  type FontRole, type Preferences,
} from "@/lib/appearance/preferences";

const fontVars = { titleFont: "--journal-title-font", bodyFont: "--journal-body-font" };

function useFontRole(
  shell: RefObject<HTMLDivElement | null>, role: FontRole, id: string, revision: number,
  onFailure: (role: FontRole, requested: string, fallback: string | null, message: string) => void,
) {
  const applied = useRef("system");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    const surface = shell.current;
    if (!surface) return;
    async function apply() {
      if (!surface) return;
      const service = id.startsWith("local:") ? personalLibrary : bundledLibrary;
      if (id === "system" || !service) {
        surface.style.removeProperty(fontVars[role]);
        applied.current = "system";
        setPending(false);
        return;
      }
      try {
        setPending(true);
        const family = await service.load(id);
        if (!active) return;
        surface.style.setProperty(fontVars[role], `"${CSS.escape(family)}", var(--font-serif)`);
        applied.current = id;
      } catch (error) {
        if (!active) return;
        const missing = error instanceof DOMException && error.name === "NotFoundError";
        const fallback = missing || applied.current === id ? "system" : applied.current;
        // A temporary IndexedDB failure during restoration should be retryable.
        const keepChoice = id.startsWith("local:") && !missing;
        onFailure(role, id, keepChoice ? null : fallback, error instanceof Error ? error.message : "字体暂时无法载入。");
      } finally {
        if (active) setPending(false);
      }
    }
    void apply();
    return () => { active = false; };
  }, [shell, role, id, revision, onFailure]);
  return pending;
}

export function usePreferences(shell: RefObject<HTMLDivElement | null>) {
  const [prefs, setPrefs] = useState(defaultPrefs);
  const current = useRef(defaultPrefs);
  const [records, setRecords] = useState<FontRecord[]>([]);
  const temporaryIds = useRef(new Set<string>());
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [retryFonts, setRetryFonts] = useState<Partial<Record<FontRole, string>>>({});

  const change = useCallback((patch: Partial<Preferences>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    applyPaper(next);
    setPrefs(next);
    const stored = { ...next, version: 2 };
    for (const role of ["titleFont", "bodyFont"] as const) {
      if (temporaryIds.current.has(stored[role])) stored[role] = "system";
    }
    try { localStorage.setItem(prefKey, JSON.stringify(stored)); }
    catch { setMessage("当前浏览器只能在本次打开时保留这些设置。"); }
  }, []);

  useEffect(() => {
    function restore() {
      const restored = readPreferences();
      current.current = restored;
      applyPaper(restored);
      setPrefs(restored);
      setRetryFonts({});
    }
    function sync(event: StorageEvent) {
      if (event.key === prefKey || event.key === oldPrefKey || event.key === null) restore();
    }
    restore();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    const library = personalLibrary;
    if (!library) return;
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
      try {
        const list = await library.list();
        if (request !== generation) return;
        temporaryIds.current = new Set(list.filter(record => !record.persistent).map(record => record.id));
        setRecords(list);
      } catch { /* Reading and writing remain available without stored fonts. */ }
    };
    void refresh();
    const unsubscribe = library.subscribe(() => {
      void refresh();
      setRevision(n => n + 1);
    });
    return () => { generation++; unsubscribe(); };
  }, [retryCount]);

  const onFailure = useCallback((role: FontRole, id: string, fallback: string | null, error: string) => {
    if (current.current[role] !== id) return;
    setMessage(error);
    if (fallback === null || bundledLibrary?.fonts.some(font => font.id === id)) {
      setRetryFonts(previous => ({ ...previous, [role]: id }));
    }
    if (fallback !== null) change({ [role]: fallback });
  }, [change]);
  const titlePending = useFontRole(shell, "titleFont", prefs.titleFont, (prefs.titleFont.startsWith("local:") ? revision : 0) + retryCount, onFailure);
  const bodyPending = useFontRole(shell, "bodyFont", prefs.bodyFont, (prefs.bodyFont.startsWith("local:") ? revision : 0) + retryCount, onFailure);

  async function importFiles(files: File[]) {
    const library = personalLibrary;
    if (!library) return;
    const notices: string[] = [];
    for (const file of files) {
      try {
        const font = await library.importFile(file);
        if (!font.persistent) temporaryIds.current.add(font.id);
        notices.push(`${font.label} · ${font.persistent ? "已加入本机字库" : "仅本次打开可用"}`);
      } catch (error) {
        notices.push(error instanceof Error ? error.message : "文件导入失败。");
      }
    }
    setMessage(notices.join("；"));
  }

  async function removeFont(id: string) {
    try {
      await personalLibrary?.remove(id);
      const patch: Partial<Preferences> = {};
      if (current.current.titleFont === id) patch.titleFont = "system";
      if (current.current.bodyFont === id) patch.bodyFont = "system";
      if (Object.keys(patch).length) change(patch);
      setMessage("已从本机字库移除。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "移除字体失败。"); }
  }

  function update(patch: Partial<Preferences>) {
    setMessage("");
    setRetryFonts({});
    change(patch);
  }
  function retry() {
    update(retryFonts);
    setRetryCount(n => n + 1);
  }

  return {
    prefs, records, update, message, pending: titlePending || bodyPending,
    importFiles, removeFont, canRetry: Object.keys(retryFonts).length > 0, retry,
  };
}
