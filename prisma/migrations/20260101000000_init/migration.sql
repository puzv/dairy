-- Initial PostgreSQL migration for 山笺.
-- This migration is additive: it creates the Prisma tables and does not alter
-- or drop any existing database objects.

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" VARCHAR(120) NOT NULL DEFAULT '本地开发者',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "entry_date" DATE NOT NULL,
    "title" VARCHAR(200),
    "body" TEXT NOT NULL,
    "mood" SMALLINT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entries_owner_id_fkey"
        FOREIGN KEY ("owner_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entries_title_length"
        CHECK ("title" IS NULL OR char_length("title") <= 200),
    CONSTRAINT "entries_title_not_blank"
        CHECK ("title" IS NULL OR char_length(btrim("title")) > 0),
    CONSTRAINT "entries_body_not_blank"
        CHECK (char_length(btrim("body")) > 0),
    CONSTRAINT "entries_body_length"
        CHECK (char_length("body") <= 50000),
    CONSTRAINT "entries_mood_valid"
        CHECK ("mood" IS NULL OR ("mood" BETWEEN 1 AND 5)),
    CONSTRAINT "entries_version_positive"
        CHECK ("version" > 0)
);

-- Timeline reads are always owner-scoped, live-only, newest first.
CREATE INDEX "entries_owner_timeline_idx"
    ON "entries" ("owner_id", "entry_date" DESC, "created_at" DESC)
    WHERE "deleted_at" IS NULL;
