type TermName = (typeof termNotes)[number][0];

export type SolarTerm = Readonly<{
  name: TermName;
  date: string;
  prompt: string;
}>;

// Gregorian month order: 小寒、大寒、立春…大雪、冬至.
const termNotes = [
  ["小寒", "小寒到了，哪扇窗还留着昨夜的雾？"],
  ["大寒", "大寒这天，哪一口热气让你慢了下来？"],
  ["立春", "立春了，今天哪处光线先松动？"],
  ["雨水", "雨水这天，屋檐下可有一点回声？"],
  ["惊蛰", "到了惊蛰，今早最先醒来的声音是什么？"],
  ["春分", "春分这天，你在哪儿看见光和影相接？"],
  ["清明", "清明这天，你想起了哪一个旧地名？"],
  ["谷雨", "谷雨这天，有什么小事正在悄悄长大？"],
  ["立夏", "立夏了，你在何处第一次卷起袖口？"],
  ["小满", "小满这天，哪件小事已经足够？"],
  ["芒种", "芒种到了，今天你把哪件事种下？"],
  ["夏至", "夏至的长光里，哪一刻最值得留下？"],
  ["小暑", "小暑到了，你在哪儿借到一点凉？"],
  ["大暑", "大暑这天，杯壁的水珠落在了哪里？"],
  ["立秋", "立秋了，哪一阵风先换了味道？"],
  ["处暑", "处暑这天，傍晚的台阶还热吗？"],
  ["白露", "白露到了，有没有一片叶子还捧着水？"],
  ["秋分", "秋分这天，你看见最后一线光落在哪儿？"],
  ["寒露", "寒露这天，哪件衣裳又被拿了出来？"],
  ["霜降", "霜降到了，今早摸到的第一样东西凉吗？"],
  ["立冬", "立冬这晚，屋里哪一点光让你想留下？"],
  ["小雪", "小雪到了，窗边哪一种颜色淡了？"],
  ["大雪", "大雪这天，窗外最轻的一声是什么？"],
  ["冬至", "冬至夜长，哪一盏灯为你多亮了一会儿？"],
] as const;

const FIRST_YEAR = 1901;
const LAST_YEAR = 2100;

// One base-36 day-of-month per term, two per month and 24 per year.
// Dates are fixed UTC+08:00 civil dates, not UTC dates or the device's local dates.
// Calculated offline from apparent solar longitude (285°, 300°, …, 270°):
// Meeus, Astronomical Algorithms, 2nd ed., chs. 22, 25, 32 (VSOP87D,
// FK5, nutation and aberration), with ΔT to convert TT before adding 8h.
// ΔT https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html
// The 2084 spring equinox uses March 20, the published calendar correction
// for the crossing near midnight. See scripts/check-solar-terms.ts for the
// independent 2024–2026 calendar reference dates.
const yearDays = [
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1901
  "6l5j6l6l6m7m8o8o8o9o8n8n", // 1902
  "6l5k7m6l7m7m8o9o9o9o8n8n", // 1903
  "7l5k6l5k6l6m7n8n8n9o8n7m", // 1904
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1905
  "6l5j6l6l6m6m8o8o8o9o8n8n", // 1906
  "6l5k7m6l7m7m8o9o9o9o8n8n", // 1907
  "7l5k6l5k6l6m7n8n8n9o8n7m", // 1908
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1909
  "6l5j6l6l6m6m8o8o8o9o8n8n", // 1910
  "6l5k7m6l7m7m8o9o9o9o8n8n", // 1911
  "7l5k6l5k6l6m7n8n8n9o8m7m", // 1912
  "6k4j6l5l6m6m8n8o8n9o8n8m", // 1913
  "6l4j6l5l6m6m8o8o8o9o8n8n", // 1914
  "6l5k6m6l6m7m8o8o9o9o8n8n", // 1915
  "6l5k6l5k6l6m7n8n8n8o8m7m", // 1916
  "6k4j6l5l6l6m8n8o8n9o8n8m", // 1917
  "6l4j6l5l6m6m8o8o8o9o8n8m", // 1918
  "6l5k6m6l6m7m8o8o9o9o8n8n", // 1919
  "6l5k6l5k6l6m7n8n8n8o8m7m", // 1920
  "6k4j6l5k6l6m8n8o8n9o8n7m", // 1921
  "6l4j6l5l6m6m8o8o8o9o8n8m", // 1922
  "6l5j6l6l6m7m8o8o9o9o8n8n", // 1923
  "6l5k6l5k6l6m7n8n8n8o8m7m", // 1924
  "6k4j6l5k6l6m8n8o8n9o8n7m", // 1925
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1926
  "6l5j6l6l6m7m8o8o9o9o8n8n", // 1927
  "6l5k6l5k6l6m7n8n8n8n7m7m", // 1928
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1929
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1930
  "6l5j6l6l6m7m8o8o8o9o8n8n", // 1931
  "6l5k6l5k6l6l7n8n8n8n7m7m", // 1932
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1933
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1934
  "6l5j6l6l6m6m8o8o8o9o8n8n", // 1935
  "6l5k6l5k6l6l7n8n8n8n7m7m", // 1936
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1937
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1938
  "6l5j6l6l6m6m8o8o8o9o8n8n", // 1939
  "6l5k6l5k6l6l7n8n8n8n7m7m", // 1940
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1941
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1942
  "6l5j6l6l6m6m8o8o8o9o8n8n", // 1943
  "6l5k6l5k5l6l7n8n8n8n7m7m", // 1944
  "6k4j6l5k6l6m7n8n8n8o8m7m", // 1945
  "6k4j6l5l6m6m8n8o8n9o8n8m", // 1946
  "6l4j6l5l6m6m8o8o8o9o8n8n", // 1947
  "6l5k5l5k5l6l7n7n8n8n7m7m", // 1948
  "5k4j6l5k6l6m7n8n8n8o8m7m", // 1949
  "6k4j6l5k6l6m8n8o8n9o8n8m", // 1950
  "6l4j6l5l6m6m8o8o8o9o8n8n", // 1951
  "6l5k5l5k5l6l7n7n8n8n7m7m", // 1952
  "5k4j6l5k6l6m7n8n8n8o8m7m", // 1953
  "6k4j6l5k6l6m8n8o8n9o8n7m", // 1954
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1955
  "6l5k5k5k5l6l7n7n8n8n7m7m", // 1956
  "5k4j6l5k6l6m7n8n8n8o8m7m", // 1957
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1958
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1959
  "6l5j5k5k5l6l7n7n7n8n7m7m", // 1960
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 1961
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1962
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1963
  "6l5j5k5k5l6l7n7n7n8n7m7m", // 1964
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 1965
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1966
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1967
  "6l5j5k5k5l5l7n7n7n8n7m7m", // 1968
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 1969
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1970
  "6l4j6l5l6m6m8n8o8o9o8n8m", // 1971
  "6l5j5k5k5l5l7n7n7n8n7m7m", // 1972
  "5k4j6l5k5l6l7n8n8n8n7m7m", // 1973
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1974
  "6l4j6l5l6m6m8n8o8n9o8n8m", // 1975
  "6l5j5k4k5l5l7n7n7n8n7m7m", // 1976
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 1977
  "6k4j6l5k6l6m7n8n8n8o8n7m", // 1978
  "6k4j6l5l6l6m8n8o8n9o8n8m", // 1979
  "6l5j5k4k5l5l7n7n7n8n7m7m", // 1980
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 1981
  "6k4j6l5k6l6m7n8n8n8o8m7m", // 1982
  "6k4j6l5k6l6m8n8o8n9o8n8m", // 1983
  "6l4j5k4k5l5l7m7n7n8n7m7m", // 1984
  "5k4j5l5k5l6l7n7n8n8n7m7m", // 1985
  "5k4j6l5k6l6m7n8n8n8o8m7m", // 1986
  "6k4j6l5k6l6m7n8o8n9o8n7m", // 1987
  "6l4j5k4k5l5l7m7n7n8n7m7l", // 1988
  "5k4j5k5k5l6l7n7n7n8n7m7m", // 1989
  "5k4j6l5k6l6l7n8n8n8o8m7m", // 1990
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1991
  "6l4j5k4k5l5l7m7n7n8n7m7l", // 1992
  "5k4i5k5k5l6l7n7n7n8n7m7m", // 1993
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 1994
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1995
  "6l4j5k4k5l5l7m7n7n8n7m7l", // 1996
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 1997
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 1998
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 1999
  "6l4j5k4k5l5l7m7n7n8n7m7l", // 2000
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2001
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 2002
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 2003
  "6l4j5k4k5l5l7m7n7n8n7m7l", // 2004
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2005
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 2006
  "6k4j6l5k6l6m7n8n8n9o8n7m", // 2007
  "6l4j5k4k5l5l7m7n7m8n7m7l", // 2008
  "5k4i5k4k5l5l7n7n7n8n7m7m", // 2009
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 2010
  "6k4j6l5k6l6m7n8n8n8o8n7m", // 2011
  "6l4j5k4k5k5l7m7n7m8n7m7l", // 2012
  "5k4i5k4k5l5l7m7n7n8n7m7m", // 2013
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 2014
  "6k4j6l5k6l6m7n8n8n8o8m7m", // 2015
  "6k4j5k4j5k5l7m7n7m8n7m7l", // 2016
  "5k3i5k4k5l5l7m7n7n8n7m7m", // 2017
  "5k4j5l5k5l6l7n7n8n8n7m7m", // 2018
  "5k4j6l5k6l6l7n8n8n8o8m7m", // 2019
  "6k4j5k4j5k5l6m7m7m8n7m7l", // 2020
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2021
  "5k4j5k5k5l6l7n7n7n8n7m7m", // 2022
  "5k4j6l5k6l6l7n8n8n8o8m7m", // 2023
  "6k4j5k4j5k5l6m7m7m8n7m6l", // 2024
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2025
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2026
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 2027
  "6k4j5k4j5k5l6m7m7m8n7m6l", // 2028
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2029
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2030
  "5k4j6l5k6l6l7n8n8n8n7m7m", // 2031
  "6k4j5k4j5k5l6m7m7m8n7m6l", // 2032
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2033
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2034
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 2035
  "6k4j5k4j5k5l6m7m7m8n7m6l", // 2036
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2037
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2038
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 2039
  "6k4j5k4j5k5l6m7m7m8n7m6l", // 2040
  "5k3i5k4k5k5l7m7n7m8n7m7l", // 2041
  "5k4i5k4k5l5l7n7n7n8n7m7m", // 2042
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 2043
  "6k4j5k4j5k5l6m7m7m7n7m6l", // 2044
  "5k3i5k4j5k5l7m7n7m8n7m7l", // 2045
  "5k4i5k4k5l5l7m7n7n8n7m7m", // 2046
  "5k4j6l5k5l6l7n7n8n8n7m7m", // 2047
  "6k4j5k4j5k5k6m7m7m7n7l6l", // 2048
  "5j3i5k4j5k5l6m7m7m8n7m7l", // 2049
  "5k3i5k4k5l5l7m7n7n8n7m7m", // 2050
  "5k4j5k5k5l6l7n7n7n8n7m7m", // 2051
  "5k4j5k4j5k5k6m7m7m7n7l6l", // 2052
  "5j3i5k4j5k5l6m7m7m8n7m7l", // 2053
  "5k3i5k4k5l5l7m7n7n8n7m7m", // 2054
  "5k4j5k5k5l5l7n7n7n8n7m7m", // 2055
  "5k4j5k4j5k5k6m7m7m7n7l6l", // 2056
  "5j3i5k4j5k5l6m7m7m8n7m6l", // 2057
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2058
  "5k4j5k5k5l5l7n7n7n8n7m7m", // 2059
  "5k4j5k4j5k5k6m7m7m7m6l6l", // 2060
  "5j3i5k4j5k5l6m7m7m8n7m6l", // 2061
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2062
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2063
  "5k4j5k4j5k5k6m7m7m7m6l6l", // 2064
  "5j3i5k4j5k5l6m7m7m8n7m6l", // 2065
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2066
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2067
  "5k4j5k4j4k5k6m6m7m7m6l6l", // 2068
  "5j3i5k4j5k5l6m7m7m8n7m6l", // 2069
  "5k3i5k4k5k5l7m7n7m8n7m7l", // 2070
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2071
  "5k4j5k4j4k5k6m6m7m7m6l6l", // 2072
  "5j3i5k4j5k5l6m7m7m7n7m6l", // 2073
  "5k3i5k4k5k5l7m7n7m8n7m7l", // 2074
  "5k4i5k4k5l5l7m7n7n8n7m7m", // 2075
  "5k4j5k4j4k5k6m6m7m7m6l6l", // 2076
  "5j3i5k4j5k5l6m7m7m7n7m6l", // 2077
  "5k3i5k4j5k5l6m7n7m8n7m7l", // 2078
  "5k4i5k4k5l5l7m7n7n8n7m7m", // 2079
  "5k4j5k4j4k5k6m6m7m7m6l6l", // 2080
  "5j3i5k4j5k5k6m7m7m7n7l6l", // 2081
  "5k3i5k4j5k5l6m7m7m8n7m7l", // 2082
  "5k3i5k4k5l5l7m7n7n8n7m7m", // 2083
  "5k4j4k4j4k5k6m6m6m7m6l6l", // 2084
  "4j3i5k4j5k5k6m7m7m7n7l6l", // 2085
  "5j3i5k4j5k5l6m7m7m8n7m7l", // 2086
  "5k3i5k4k5l5l7m7n7n8n7m7m", // 2087
  "5k4j4j4j4k4k6m6m6m7m6l6l", // 2088
  "4j3i5k4j5k5k6m7m7m7n7l6l", // 2089
  "5j3i5k4j5k5l6m7m7m8n7m6l", // 2090
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2091
  "5k4j4j4j4k4k6m6m6m7m6l6l", // 2092
  "4j3i5k4j5k5k6m7m7m7m6l6l", // 2093
  "5j3i5k4j5k5l6m7m7m8n7m6l", // 2094
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2095
  "5k4i4j4j4k4k6m6m6m7m6l6l", // 2096
  "4j3i5k4j5k5k6m6m7m7m6l6l", // 2097
  "5j3i5k4j5k5l6m7m7m8n7m6l", // 2098
  "5k3i5k4k5l5l7m7n7n8n7m7l", // 2099
  "5k4i5k5k5l5l7n7n7n8n7m7m", // 2100
] as const;

function makeTerm(year: number, index: number, day: number): SolarTerm {
  const [name, prompt] = termNotes[index];
  const month = Math.floor(index / 2) + 1;
  return {
    name,
    prompt,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Both terms in a Gregorian month (1–12), in date order. */
export function solarTermsOfMonth(year: number, month: number): SolarTerm[] {
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR ||
      !Number.isInteger(month) || month < 1 || month > 12) return [];
  const row = yearDays[year - FIRST_YEAR];
  const index = (month - 1) * 2;
  return [
    makeTerm(year, index, Number.parseInt(row[index], 36)),
    makeTerm(year, index + 1, Number.parseInt(row[index + 1], 36)),
  ];
}

function supportedMonth(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (year < FIRST_YEAR || year > LAST_YEAR || month < 1 || month > 12 ||
      day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return { year, month };
}

/** A term only if it starts on this East Asia civil date (YYYY-MM-DD). */
export function solarTermOn(date: string): SolarTerm | null {
  const parts = supportedMonth(date);
  return parts ? solarTermsOfMonth(parts.year, parts.month).find(term => term.date === date) ?? null : null;
}

/** The most recent term, including this date; null outside 1901–2100. */
export function currentSolarTerm(date: string): SolarTerm | null {
  const parts = supportedMonth(date);
  if (!parts) return null;
  const { year, month } = parts;
  const [early, late] = solarTermsOfMonth(year, month);
  if (date >= late.date) return late;
  if (date >= early.date) return early;
  if (year === FIRST_YEAR && month === 1) return makeTerm(1900, 23, 22);
  return month === 1
    ? solarTermsOfMonth(year - 1, 12)[1]
    : solarTermsOfMonth(year, month - 1)[1];
}
