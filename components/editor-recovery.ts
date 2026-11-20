import type { DraftFields } from "@/lib/notebook-types";

const prefix = "shan-jian:pending-draft:";

export type PendingDraft = {
  id: string;
  entryId: string | null;
  baseVersion: number | null;
  revision: number;
  fields: DraftFields;
  sending: DraftFields | null;
  writer: string;
};

const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export function isDraftId(id: unknown): id is string {
  return typeof id === "string" && uuid.test(id);
}

function fieldsValid(fields: unknown): fields is DraftFields {
  if (!fields || typeof fields !== "object") return false;
  return ["date", "title", "body", "mood"].every(
    key => typeof (fields as Record<string, unknown>)[key] === "string",
  );
}

export function sameFields(a: DraftFields, b: DraftFields) {
  return a.date === b.date && a.title === b.title && a.body === b.body && a.mood === b.mood;
}

export function clearEditorRecovery(keepScope?: string) {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix) && !(keepScope && key.startsWith(prefix + keepScope + ":"))) {
        sessionStorage.removeItem(key);
      }
    }
  } catch { /* Storage can be disabled. Database saves still work. */ }
}

export function pendingNewId(scope: string) {
  try {
    const id = sessionStorage.getItem(prefix + scope + ":new");
    return isDraftId(id) ? id : null;
  } catch { return null; }
}

export function readPending(scope: string, id: string): PendingDraft | null {
  try {
    const text = sessionStorage.getItem(prefix + scope + ":" + id);
    if (!text) return null;
    const value = JSON.parse(text);
    if (value?.id !== id || !isDraftId(id) || !fieldsValid(value.fields) ||
      !(value.sending === null || fieldsValid(value.sending)) ||
      !(value.entryId === null || value.entryId === id) ||
      !(value.baseVersion === null || Number.isSafeInteger(value.baseVersion)) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      typeof value.writer !== "string") return null;
    return value;
  } catch { return null; }
}

export function writePending(scope: string, pending: PendingDraft) {
  try {
    sessionStorage.setItem(prefix + scope + ":" + pending.id, JSON.stringify(pending));
    if (!pending.entryId) sessionStorage.setItem(prefix + scope + ":new", pending.id);
    return true;
  } catch { return false; }
}

export function removePending(scope: string, id: string, writer: string) {
  try {
    if (readPending(scope, id)?.writer !== writer) return;
    sessionStorage.removeItem(prefix + scope + ":" + id);
    if (pendingNewId(scope) === id) sessionStorage.removeItem(prefix + scope + ":new");
  } catch { /* The authenticated copy is already durable. */ }
}
