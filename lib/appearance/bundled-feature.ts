import type { BundledLibrary } from "./contracts";

const assets = [
  { id: "wenkai", label: "霞鹜文楷", family: "ShanJianWenKai", revision: "5803e2a52caa" },
  { id: "source-han-serif", label: "思源宋体", family: "ShanJianSong", revision: "7ef59b41f49f" },
  { id: "source-han-sans", label: "思源黑体", family: "ShanJianHei", revision: "829f3f89c087" },
  { id: "mashan", label: "马善政楷书", family: "ShanJianBrush", revision: "984a446bbcdb" },
  { id: "xiaowei", label: "站酷小薇体", family: "ShanJianXiaoWei", revision: "0175def33369" },
] as const;

type Asset = (typeof assets)[number];

class FontDownloadError extends Error {}

const cacheName = "shanjian-bundled-fonts-v1";
const registrations = new Map<string, Promise<string>>();

async function openFontCache(): Promise<Cache | undefined> {
  try {
    return await window.caches?.open(cacheName);
  } catch {
    // Private browsing and storage policies may disable persistent caching.
    return undefined;
  }
}

async function readOrDownload(asset: Asset, url: string, cache?: Cache): Promise<FontFace> {
  const cached = await cache?.match(url).catch(() => undefined);
  if (cached) {
    try {
      return await new FontFace(asset.family, await cached.arrayBuffer()).load();
    } catch {
      await cache?.delete(url).catch(() => false);
    }
  }

  let bytes: ArrayBuffer;
  try {
    const response = await fetch(url, { mode: "same-origin", credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    bytes = await response.arrayBuffer();
  } catch (error) {
    throw new FontDownloadError(`下载${asset.label}失败，请检查网络后重试。`, { cause: error });
  }

  const face = await new FontFace(asset.family, bytes).load();
  if (cache) {
    // Store only a decodable file. A full or disabled cache can still use the face now.
    const copy = new Response(bytes, { headers: { "Content-Type": "font/woff2" } });
    await cache.put(url, copy).catch(() => undefined);
  }
  return face;
}

async function register(asset: Asset): Promise<string> {
  const url = `/fonts/${asset.id}.${asset.revision}.woff2`;
  const cache = await openFontCache();
  const acquire = () => readOrDownload(asset, url, cache);
  let face: FontFace;

  try {
    // Tabs of the same origin can share the first download through the cache.
    face = cache && navigator.locks
      ? await navigator.locks.request(cacheName + url, acquire)
      : await acquire();
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "SecurityError")) throw error;
    // Some embedded browsers expose Web Locks but deny their use.
    face = await acquire();
  }

  document.fonts.add(face);
  return face.family;
}

function load(id: string): Promise<string> {
  const existing = registrations.get(id);
  if (existing) return existing;

  const asset = assets.find((item) => item.id === id);
  if (!asset) return Promise.reject(new Error("未找到这款内置字体。"));
  if (typeof FontFace !== "function" || !document.fonts) {
    return Promise.reject(new Error("当前浏览器无法加载网页字体。"));
  }

  const pending = register(asset).catch((error: unknown) => {
    registrations.delete(id);
    if (error instanceof FontDownloadError) throw error;
    throw new Error(`无法读取${asset.label}的字体数据，请重试。`, { cause: error });
  });
  registrations.set(id, pending);
  return pending;
}

export const bundledLibrary: BundledLibrary = {
  fonts: assets.map(({ id, label }) => ({ id, label })),
  load,
};
