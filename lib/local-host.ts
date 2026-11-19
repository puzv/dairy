const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLoopbackHost(hostHeader: string | null): boolean {
  if (!hostHeader) {
    return false;
  }

  try {
    const { hostname } = new URL(`http://${hostHeader}`);
    return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * The app remains local-only until a real account system exists. Both the
 * development runtime and an explicit loopback Host are required.
 */
export function isLocalDeveloperRequest(hostHeader: string | null): boolean {
  return process.env.NODE_ENV === "development" && isLoopbackHost(hostHeader);
}
