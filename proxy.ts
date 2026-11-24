import { NextResponse, type NextRequest } from "next/server";

import { AUTH_NEXT_HEADER } from "@/lib/auth-next";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Always replace any client-supplied value on protected routes.
  const { pathname, search } = request.nextUrl;
  headers.set(AUTH_NEXT_HEADER, `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Keep in sync with the protected URL prefixes under app/(app).
  matcher: ["/timeline/:path*", "/entries/:path*", "/revisit/:path*"],
};
