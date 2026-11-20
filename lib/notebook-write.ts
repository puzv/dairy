import type { Prisma } from "@prisma/client";

// A new draft and its eventual entry share an ID but live in different tables.
// Lock that identity through autosave, explicit save, discard and trash operations.
export async function lockNotebookItem(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${id.toLowerCase()}, 0))`;
}
