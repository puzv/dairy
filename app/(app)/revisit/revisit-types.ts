export type FoundEntry = {
  id: string;
  date: string;
  title: string;
  excerpt: string;
  mood: number | null;
};

export type SearchState = {
  phase: "idle" | "results" | "error";
  phrase: string;
  mood: string;
  entries: FoundEntry[];
  hasNewer: boolean;
  hasOlder: boolean;
  message: string;
};

export const emptySearch: SearchState = {
  phase: "idle", phrase: "", mood: "", entries: [], hasNewer: false, hasOlder: false, message: "",
};

export type MemoryState = {
  entry?: FoundEntry;
  label?: string;
  message?: string;
};

export const recallOptions = [
  { value: "auto", label: "自动" },
  { value: "anniversary", label: "往年今日" },
  { value: "last-month", label: "上月同日" },
  { value: "latest", label: "最近一篇" },
] as const;

export type MinimalMemoryState = MemoryState & { body?: string };
