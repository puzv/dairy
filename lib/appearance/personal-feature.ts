import type { PersonalLibrary } from "./contracts";
import { deleteStoredFont, getStoredFont, listStoredFonts, storeFont } from "./personal-storage";

type LibraryFont = Awaited<ReturnType<PersonalLibrary["importFile"]>>;
const changeKey = "shanjian.personal-fonts.changed";
const sessionFonts = new Map<string, { record: LibraryFont; source: Blob }>();
const knownStored = new Map<string, LibraryFont>();
const loadedFaces = new Map<string, FontFace>();
const subscribers = new Set<() => void>();
let channel: BroadcastChannel | undefined;
let previous: Promise<void> = Promise.resolve();

// Keep a late decode from reinstalling a face after a subsequent removal.
function inOrder<T>(operation: () => Promise<T>): Promise<T> {
  const next = previous.then(operation);
  previous = next.then(() => undefined, () => undefined);
  return next;
}

function notify() {
  for (const subscriber of subscribers) subscriber();
}

function changed() {
  notify();
  try {
    const sender = channel ?? new BroadcastChannel(changeKey);
    sender.postMessage("changed");
    if (sender !== channel) sender.close();
    return;
  } catch {
    // Browsers without BroadcastChannel can still synchronize via storage events.
  }
  try {
    localStorage.setItem(changeKey, crypto.randomUUID());
  } catch {
    // Returning focus also refreshes the catalog.
  }
}

function onStorage(event: StorageEvent) {
  if (event.key === changeKey || event.key === null) notify();
}

function subscribe(listener: () => void) {
  if (subscribers.size === 0) {
    try {
      channel = new BroadcastChannel(changeKey);
      channel.onmessage = notify;
    } catch {
      channel = undefined;
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", notify);
    window.addEventListener("pageshow", notify);
  }
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) {
      channel?.close();
      channel = undefined;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", notify);
      window.removeEventListener("pageshow", notify);
    }
  };
}

function evictFace(id: string) {
  const face = loadedFaces.get(id);
  if (face) {
    document.fonts.delete(face);
    loadedFaces.delete(id);
  }
}

function missingFont() {
  return new DOMException("此字体已从本机字库移除，请重新选择。", "NotFoundError");
}

function registerFace(id: string, face: FontFace) {
  document.fonts.add(face);
  loadedFaces.set(id, face);
  return face.family;
}

async function decode(id: string, bytes: ArrayBuffer) {
  try {
    return await new FontFace("ShanJianLocal-" + id.slice(6), bytes).load();
  } catch {
    throw new Error("无法读取此字体，请选择有效的 TTF、OTF 或 WOFF2 文件。");
  }
}

async function list() {
  try {
    const stored = await listStoredFonts();
    knownStored.clear();
    for (const font of stored) {
      knownStored.set(font.id, { ...font, persistent: true });
      sessionFonts.delete(font.id);
    }
    for (const id of loadedFaces.keys()) {
      if (!knownStored.has(id) && !sessionFonts.has(id)) evictFace(id);
    }
  } catch {
    // Imports in this tab are usable even when browser storage is blocked.
  }
  const records = new Map(knownStored);
  for (const [id, { record }] of sessionFonts) {
    if (!records.has(id)) records.set(id, record);
  }
  return [...records.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
}

async function importFile(file: File): Promise<LibraryFont> {
  if (!/\.(ttf|otf|woff2)$/i.test(file.name)) {
    throw new Error("请选择 TTF、OTF 或 WOFF2 字体文件。");
  }
  const bytes = await file.arrayBuffer();
  const signature = bytes.byteLength >= 4 ? new DataView(bytes).getUint32(0) : 0;
  // sfnt TrueType (including legacy Apple TrueType), OpenType/CFF, or WOFF2.
  if (![0x00010000, 0x74727565, 0x4f54544f, 0x774f4632].includes(signature)) {
    throw new Error("文件内容不是受支持的字体。");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = "local:" + hash;
  const existing = loadedFaces.get(id);
  const face = existing ?? await decode(id, bytes);
  const metadata = { id, label: sessionFonts.get(id)?.record.label ?? file.name };
  const source = new Blob([bytes]);
  let record: LibraryFont;
  try {
    const stored = await storeFont(metadata, source);
    record = { ...stored, persistent: true };
    knownStored.set(id, record);
    sessionFonts.delete(id);
  } catch {
    record = knownStored.get(id) ?? { ...metadata, persistent: false };
    if (!record.persistent) sessionFonts.set(id, { record, source });
  }
  if (!existing) registerFace(id, face);
  changed();
  return record;
}

async function load(id: string) {
  if (!/^local:[0-9a-f]{64}$/.test(id)) throw missingFont();
  let source = sessionFonts.get(id)?.source;
  const existing = loadedFaces.get(id);
  if (!source) {
    try {
      source = await getStoredFont(id);
    } catch {
      if (existing) return existing.family;
      throw new Error("暂时无法访问本机字库，请稍后重试。");
    }
  }
  if (!source) {
    knownStored.delete(id);
    evictFace(id);
    throw missingFont();
  }
  if (existing) return existing.family;
  return registerFace(id, await decode(id, await source.arrayBuffer()));
}

async function remove(id: string) {
  try {
    await deleteStoredFont(id);
  } catch {
    if (!sessionFonts.has(id) || knownStored.has(id)) throw new Error("字体未能移除，请重试。");
  }
  knownStored.delete(id);
  sessionFonts.delete(id);
  evictFace(id);
  changed();
}

export const personalLibrary: PersonalLibrary = {
  list: () => inOrder(list),
  importFile: (file) => inOrder(() => importFile(file)),
  load: (id) => inOrder(() => load(id)),
  remove: (id) => inOrder(() => remove(id)),
  subscribe,
};
