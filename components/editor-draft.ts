import type { DraftFields, DraftView } from "@/lib/notebook-types";
import type { saveDraftAction } from "@/lib/actions/drafts";
import { clearEditorRecovery, pendingNewId, readPending, removePending, sameFields, writePending } from "./editor-recovery";

type Status = "loading" | "idle" | "pending" | "saving" | "saved" | "error" | "conflict" | "missing";
type Options = {
  ownerId: string;
  scope: string;
  entryId: string | null;
  baseVersion: number | null;
  requestedId: string | null;
  initial: DraftFields;
  draft: DraftView | null;
};

type Snapshot = {
  id: string | null;
  fields: DraftFields;
  baseVersion: number | null;
  revision: number;
  status: Status;
  message: string;
};

/** Each mounted editor has one ordered write queue; the database revision is its CAS token. */
export class EditorDraft {
  private listeners = new Set<() => void>();
  private state: Snapshot;
  private dirty = false;
  private attached = false;
  private initialized = false;
  private writer = "";
  private timer?: ReturnType<typeof setTimeout>;
  private inFlight: Promise<boolean> | null = null;
  private sending: DraftFields | null = null;
  private backedUp = false;

  constructor(private options: Options, private save: typeof saveDraftAction) {
    const { draft, requestedId, entryId, baseVersion, initial } = options;
    this.state = {
      id: draft?.id ?? entryId ?? requestedId,
      fields: draft?.fields ?? initial,
      baseVersion: draft?.baseVersion ?? baseVersion,
      revision: draft?.revision ?? 0,
      status: "loading",
      message: "",
    };
  }

  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(changes: Partial<Snapshot>) {
    this.state = { ...this.state, ...changes };
    this.listeners.forEach(listener => listener());
  }

  attach() {
    this.attached = true;
    if (this.initialized) return null;
    this.initialized = true;
    this.writer = crypto.randomUUID();
    const { draft, scope, entryId, requestedId } = this.options;
    clearEditorRecovery(scope);

    // Back from an interrupted first save: opening "写今天" also finds the tab copy.
    if (!this.state.id) {
      const pendingId = pendingNewId(scope);
      if (pendingId && readPending(scope, pendingId)) return pendingId;
    }
    const local = this.state.id ? readPending(scope, this.state.id) : null;
    if (local && local.entryId === entryId) {
      if (draft && sameFields(draft.fields, local.fields)) {
        removePending(scope, local.id, local.writer);
      } else {
        const sameBase = !draft || draft.baseVersion === local.baseVersion;
        const ackedInFlight = draft && local.sending && sameFields(draft.fields, local.sending);
        const canResume = sameBase && (draft
          ? draft.revision === local.revision || !!ackedInFlight
          : local.revision === 0);
        this.dirty = true;
        this.update({
          fields: local.fields,
          revision: canResume && draft ? draft.revision : local.revision,
          baseVersion: local.baseVersion,
          status: canResume ? "pending" : "conflict",
          message: canResume ? "正在恢复此标签页的修改…" : "草稿已在别处更改。本页保留了你尚未同步的文字。",
        });
        this.backUp();
        if (canResume) this.schedule();
        return null;
      }
    }
    if (requestedId && !draft && !entryId) {
      this.update({ status: "missing", message: "这份草稿已不可用。" });
      return null;
    }
    let fields = this.state.fields;
    if (!draft && !entryId) {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      fields = { ...fields, date: `${now.getFullYear()}-${month}-${day}` };
    }
    this.update({ fields, status: draft ? "saved" : "idle", message: draft ? "草稿已保存" : "修改会自动存为草稿" });
    return null;
  }

  detach() {
    this.attached = false;
    clearTimeout(this.timer);
    if (this.canFlush()) void this.flush();
  }

  private backUp() {
    const { id, revision, baseVersion, fields } = this.state;
    if (!id) return;
    const { scope, entryId } = this.options;
    // A previous component's delayed response must never replace the new component's copy.
    if (!this.attached && readPending(scope, id)?.writer !== this.writer) return;
    this.backedUp = writePending(scope, {
      id, entryId, revision, baseVersion, fields, sending: this.sending, writer: this.writer,
    });
  }

  change(name: keyof DraftFields, value: string) {
    if (["loading", "missing"].includes(this.state.status)) return;
    if (!this.state.id) {
      const id = crypto.randomUUID();
      const url = new URL(window.location.href);
      url.searchParams.set("draft", id);
      window.history.replaceState(null, "", url);
      this.update({ id });
    }
    this.dirty = true;
    const conflicted = this.state.status === "conflict";
    this.update({
      fields: { ...this.state.fields, [name]: value },
      ...(conflicted ? {} : { status: "pending", message: "草稿待保存…" }),
    });
    this.backUp();
    if (!conflicted) this.schedule();
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, 450);
  }

  canFlush = () => this.dirty && this.state.status !== "conflict";
  needsRecovery = () => this.dirty;
  needsUnloadWarning = () => this.dirty && !this.backedUp;

  flush = (): Promise<boolean> => {
    clearTimeout(this.timer);
    if (this.state.status === "conflict" || this.state.status === "missing") return Promise.resolve(false);
    if (this.inFlight) return this.inFlight;
    if (!this.dirty) return Promise.resolve(true);
    this.inFlight = this.drain().finally(() => { this.inFlight = null; });
    return this.inFlight;
  };

  private async drain() {
    while (this.dirty && this.state.id) {
      const { id, fields, baseVersion, revision } = this.state;
      const { ownerId, entryId, scope } = this.options;
      if (!this.attached && this.backedUp && readPending(scope, id)?.writer !== this.writer) return false;
      this.sending = fields;
      this.update({ status: "saving", message: "正在保存草稿…" });
      this.backUp();
      try {
        const result = await this.save({ id, entryId, expectedOwnerId: ownerId, baseVersion, revision, fields });
        if (!result.ok) {
          this.update({ status: result.conflict ? "conflict" : "error", message: result.message });
          return false;
        }
        this.update({ revision: result.revision });
        this.sending = null;
        if (sameFields(fields, this.state.fields)) {
          this.dirty = false;
          removePending(scope, id, this.writer);
          this.update({ status: "saved", message: "草稿已保存" });
        } else {
          this.backUp();
        }
      } catch {
        this.update({
          status: "error",
          message: this.backedUp ? "尚未同步。修改已暂存在此标签页，可以重试。" : "草稿尚未保存，请保持页面打开并重试。",
        });
        return false;
      }
    }
    return true;
  }

  saveAsNew() {
    const id = crypto.randomUUID();
    const { scope } = this.options;
    const ok = writePending(scope, {
      id, entryId: null, revision: 0, baseVersion: null, fields: this.state.fields,
      writer: this.writer, sending: null,
    });
    if (!ok) {
      this.update({ message: "浏览器暂存不可用，请先复制本页中的文字。" });
      return null;
    }
    if (this.state.id) removePending(scope, this.state.id, this.writer);
    return id;
  }
}
