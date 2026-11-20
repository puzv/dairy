import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/lib/auth";

/** Isolates temporary tab recovery across sign-ins, even for the same account. */
export async function editorScope(ownerId: string) {
  const session = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!session) throw new Error("编辑会话已结束。");
  return createHash("sha256").update("editor-recovery-v1\0").update(ownerId)
    .update("\0").update(session).digest("hex");
}
