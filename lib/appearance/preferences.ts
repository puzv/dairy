export const accents = {
  cinnabar: ["朱砂", "#98452d"], pine: ["松绿", "#385d49"],
  indigo: ["靛青", "#405779"], rouge: ["胭脂", "#a74769"],
  ochre: ["赭石", "#935929"], gold: ["琥珀", "#a77924"],
  purple: ["藤紫", "#755585"], teal: ["孔雀青", "#2f7374"],
} as const;

export const rulings = { plain: "素面", double: "双框", ruled: "横线", grid: "方格" } as const;

export const bindings = {
  plain: { name: "素笺朱印", stock: "米白宣纸", accent: "cinnabar", ruling: "plain", titleFont: "system", bodyFont: "system" },
  celadon: { name: "青瓷听雨", stock: "青瓷笺", accent: "pine", ruling: "double", titleFont: "wenkai", bodyFont: "source-han-serif" },
  rose: { name: "海棠花笺", stock: "海棠笺", accent: "rouge", ruling: "ruled", titleFont: "mashan", bodyFont: "wenkai" },
  indigo: { name: "靛蓝线装", stock: "线装纸", accent: "indigo", ruling: "double", titleFont: "source-han-serif", bodyFont: "source-han-serif" },
  rubbing: { name: "金石拓本", stock: "拓本纸", accent: "gold", ruling: "grid", titleFont: "xiaowei", bodyFont: "source-han-sans" },
  lamplight: { name: "灯下手札", stock: "灯下笺", accent: "ochre", ruling: "ruled", titleFont: "wenkai", bodyFont: "wenkai" },
} as const;

export type Paper = keyof typeof bindings;
export type Accent = keyof typeof accents;
export type Ruling = keyof typeof rulings;
export type FontRole = "titleFont" | "bodyFont";
export type Preferences = { paper: Paper; accent: Accent; ruling: Ruling; titleFont: string; bodyFont: string };

export const prefKey = "shanjian.appearance.v2";
export const oldPrefKey = "shanjian.appearance.v1";
export const defaultPrefs: Preferences = { paper: "plain", accent: "cinnabar", ruling: "plain", titleFont: "system", bodyFont: "system" };

function hasKey<T extends object>(obj: T, value: unknown): value is Extract<keyof T, string> {
  return typeof value === "string" && Object.hasOwn(obj, value);
}

export function readPreferences(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(prefKey) ?? localStorage.getItem(oldPrefKey) ?? "null");
    if (!raw || typeof raw !== "object") return defaultPrefs;
    const paper = raw.paper === "green" ? "celadon" : raw.paper === "night" ? "rubbing" : raw.paper;
    const font = (value: unknown) => {
      if (typeof value !== "string") return "system";
      const id = value.startsWith("builtin:") ? value.slice(8) : value;
      return /^(?:[a-z][a-z0-9-]{0,40}|local:[a-f0-9]{64})$/.test(id) ? id : "system";
    };
    return {
      paper: hasKey(bindings, paper) ? paper : defaultPrefs.paper,
      accent: hasKey(accents, raw.accent) ? raw.accent : defaultPrefs.accent,
      ruling: hasKey(rulings, raw.ruling) ? raw.ruling : defaultPrefs.ruling,
      titleFont: font(raw.titleFont), bodyFont: font(raw.bodyFont),
    };
  } catch {
    return defaultPrefs;
  }
}

export function applyPaper(prefs: Preferences) {
  const { dataset } = document.documentElement;
  dataset.paper = prefs.paper;
  dataset.accent = prefs.accent;
  dataset.ruling = prefs.ruling;
}

// All interpolated values come from the static preset catalogs. The head script
// needs only these three attributes to paint a returning reader's paper.
export const firstPaintScript = `(function(){try{
var p=JSON.parse(localStorage.getItem(${JSON.stringify(prefKey)})||localStorage.getItem(${JSON.stringify(oldPrefKey)})||"null");
if(!p)return;
var d=document.documentElement.dataset;
var paper=p.paper==="green"?"celadon":p.paper==="night"?"rubbing":p.paper;
if(${JSON.stringify(Object.keys(bindings))}.includes(paper))d.paper=paper;
if(${JSON.stringify(Object.keys(accents))}.includes(p.accent))d.accent=p.accent;
if(${JSON.stringify(Object.keys(rulings))}.includes(p.ruling))d.ruling=p.ruling;
}catch{}})()`;
