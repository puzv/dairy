import assert from "node:assert/strict";
// @ts-expect-error Node's native TypeScript support requires the .ts extension.
import { currentSolarTerm, solarTermOn, solarTermsOfMonth } from "../lib/solar-terms.ts";

// Hong Kong Observatory, Gregorian-Lunar Calendar Conversion Table (UTC+08:00).
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2024e.txt
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2025e.txt
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2026e.txt
// The U.S. Naval Observatory also publishes the four equinox/solstice instants:
// https://aa.usno.navy.mil/data/Earth_Seasons (convert UT to UTC+08:00).
const names = "小寒 大寒 立春 雨水 惊蛰 春分 清明 谷雨 立夏 小满 芒种 夏至 小暑 大暑 立秋 处暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至".split(" ");
const referenceDates = {
  2024: "01-06 01-20 02-04 02-19 03-05 03-20 04-04 04-19 05-05 05-20 06-05 06-21 07-06 07-22 08-07 08-22 09-07 09-22 10-08 10-23 11-07 11-22 12-06 12-21",
  2025: "01-05 01-20 02-03 02-18 03-05 03-20 04-04 04-20 05-05 05-21 06-05 06-21 07-07 07-22 08-07 08-23 09-07 09-23 10-08 10-23 11-07 11-22 12-07 12-21",
  2026: "01-05 01-20 02-04 02-18 03-05 03-20 04-05 04-20 05-05 05-21 06-05 06-21 07-07 07-23 08-07 08-23 09-07 09-23 10-08 10-23 11-07 11-22 12-07 12-22",
} as const;

function solarTermsOfYear(year: number) {
  return Array.from({ length: 12 }, (_, index) => solarTermsOfMonth(year, index + 1)).flat();
}

const rows = names.map(节气 => ({ 节气, 2024: "", 2025: "", 2026: "" }));
for (const year of [2024, 2025, 2026] as const) {
  const dates = referenceDates[year].split(" ");
  const terms = solarTermsOfYear(year);
  assert.deepEqual(terms.map(term => term.name), names, `${year} 年节气顺序`);
  assert.deepEqual(terms.map(term => term.date), dates.map(date => `${year}-${date}`), `${year} 年东八区节气日期`);
  terms.forEach(({ date }, index) => { rows[index][year] = date; });
}

let previousDate = "1900-12-22";
for (let year = 1901; year <= 2100; year++) {
  const terms = solarTermsOfYear(year);
  assert.equal(terms.length, 24, `${year} 年节气数量`);
  for (const term of terms) {
    const days = (Date.parse(term.date) - Date.parse(previousDate)) / 86_400_000;
    assert(days >= 14 && days <= 17, `${previousDate} 至 ${term.date} 节气间隔异常`);
    assert.deepEqual(solarTermOn(term.date), term);
    assert.deepEqual(currentSolarTerm(term.date), term);
    previousDate = term.date;
  }
}

const prompts = solarTermsOfYear(2026).map(term => term.prompt);
assert.equal(new Set(prompts).size, 24);
for (const prompt of prompts) assert([...prompt].length > 0 && [...prompt].length <= 24, prompt);

assert.equal(solarTermOn("2026-11-23"), null);
assert.equal(currentSolarTerm("2026-11-23")?.date, "2026-11-22");
assert.equal(currentSolarTerm("2026-12-01")?.date, "2026-11-22");
assert.equal(currentSolarTerm("2026-01-01")?.date, "2025-12-21");
assert.equal(currentSolarTerm("1901-01-01")?.date, "1900-12-22");
assert.equal(currentSolarTerm("2100-12-31")?.name, "冬至");
assert.equal(currentSolarTerm("2024-02-29")?.name, "雨水");
assert.equal(solarTermOn("2021-12-21")?.name, "冬至");
assert.equal(solarTermOn("2084-03-20")?.name, "春分");
for (const date of ["", "2026-2-04", "2026-02-29", "2026-04-31", "2026-00-15", "2026-01-00", "1900-12-22", "2101-01-05"]) {
  assert.equal(solarTermOn(date), null, date);
  assert.equal(currentSolarTerm(date), null, date);
}
for (const [year, month] of [[1900, 12], [2101, 1], [2026, 0], [2026, 13], [2026, 1.5]]) {
  assert.deepEqual(solarTermsOfMonth(year, month), []);
}

console.log("东八区二十四节气（公历）");
console.table(rows, ["节气", "2024", "2025", "2026"]);
console.log("通过：2024–2026 年 72 个参考日期，以及 1901–2100 年日期和查询边界检查。");
