export const MOOD_OPTIONS = [
  { value: 1, label: "低落" },
  { value: 2, label: "烦乱" },
  { value: 3, label: "平静" },
  { value: 4, label: "轻快" },
  { value: 5, label: "满足" },
] as const;

export type Mood = (typeof MOOD_OPTIONS)[number]["value"];

const MOOD_LABELS: Record<Mood, string> = {
  1: "低落",
  2: "烦乱",
  3: "平静",
  4: "轻快",
  5: "满足",
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function isMood(value: number): value is Mood {
  return MOOD_OPTIONS.some((option) => option.value === value);
}

export function moodLabel(value: number | null): string | null {
  if (value === null || !isMood(value)) {
    return null;
  }

  return MOOD_LABELS[value];
}

export function firstLine(body: string): string {
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

export function entryTitle(entry: {
  title: string | null;
  body: string;
}): string {
  return entry.title?.trim() || firstLine(entry.body) || "无题";
}

export function entryExcerpt(body: string, limit = 110): string {
  const compact = body.replace(/\s+/g, " ").trim();

  if (compact.length <= limit) {
    return compact;
  }

  return `${compact.slice(0, limit)}…`;
}

export function isValidEntryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function formatDiaryDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  const weekday = WEEKDAYS[date.getUTCDay()];

  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日 · 周${weekday}`;
}

export function dateParts(value: string): {
  day: string;
  month: string;
  year: string;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return { day: "--", month: "--", year: "----" };
  }

  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
}

export function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
