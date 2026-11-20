ALTER TABLE "entries" ADD COLUMN "favorite" BOOLEAN NOT NULL DEFAULT false;
CREATE SEQUENCE "entry_draft_revision_seq" AS INTEGER;

CREATE TABLE "entry_drafts" (
    "id" UUID PRIMARY KEY,
    "owner_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "entry_id" UUID UNIQUE REFERENCES "entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "entry_date" DATE,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL CHECK (char_length("body") <= 50000),
    "mood" SMALLINT CHECK ("mood" BETWEEN 1 AND 5),
    "revision" INTEGER NOT NULL DEFAULT nextval('entry_draft_revision_seq') CHECK ("revision" > 0),
    "base_version" INTEGER,
    "deleted_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CHECK (("entry_id" IS NULL AND "base_version" IS NULL) OR
           ("entry_id" IS NOT NULL AND "entry_id" = "id" AND "base_version" IS NOT NULL
            AND "base_version" > 0 AND "deleted_at" IS NULL))
);
CREATE INDEX "entry_drafts_owner_updated_idx" ON "entry_drafts" ("owner_id", "updated_at");
ALTER SEQUENCE "entry_draft_revision_seq" OWNED BY "entry_drafts"."revision";
