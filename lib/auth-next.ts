export const AUTH_NEXT_HEADER = "x-shanjian-auth-next";
export const DEFAULT_AUTH_DESTINATION = "/timeline";

const BASE = "https://shanjian.invalid";
const SCHEME = /(?:^|[^a-z0-9+.-])[a-z][a-z0-9+.-]*:/i;

function hasUnsafeContent(value: string): boolean {
  if (value.includes("\\") || SCHEME.test(value)) return true;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function safeAuthNext(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (hasUnsafeContent(value) || hasUnsafeContent(decoded) || decoded.startsWith("//")) {
      return null;
    }

    const target = new URL(value, BASE);
    const decodedPath = decodeURIComponent(target.pathname);
    const normalizedPath = new URL(decodedPath, BASE).pathname;
    // Dot segments and encoded separators must not turn an apparently local
    // value into //host or an auth route.
    if (
      target.origin !== BASE ||
      target.pathname.startsWith("//") ||
      decodedPath.startsWith("//") ||
      normalizedPath.startsWith("//") ||
      /^\/(login|register)(?:\/|$)/i.test(normalizedPath)
    ) {
      return null;
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function authPageHref(path: "/login" | "/register", next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
