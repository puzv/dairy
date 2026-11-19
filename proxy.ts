import { NextResponse, type NextRequest } from "next/server";

import { isLocalDeveloperRequest } from "@/lib/local-host";

/**
 * Deny-by-default gate for every application route. Page-level requireUser()
 * checks remain the final authority; this runs earlier and also covers Server
 * Actions before they can reach the database.
 */
export function proxy(request: NextRequest) {
  if (!isLocalDeveloperRequest(request.headers.get("host"))) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
