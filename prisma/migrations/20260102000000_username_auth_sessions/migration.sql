-- Additive local account and database-backed session migration for 山笺.
-- Existing users keep their rows and entries. Legacy users receive NULL for
-- both new credential columns and therefore cannot log in automatically.

BEGIN;

ALTER TABLE "users"
    ADD COLUMN "username" VARCHAR(32),
    ADD COLUMN "password_hash" VARCHAR(255);

-- Credentials are configured as a pair: both NULL (legacy) or both present
-- (a local account). SQL enforces this even outside the application.
ALTER TABLE "users"
    ADD CONSTRAINT "users_credentials_pair_check"
    CHECK (
        ("username" IS NULL AND "password_hash" IS NULL)
        OR ("username" IS NOT NULL AND "password_hash" IS NOT NULL)
    );

-- PostgreSQL unique indexes allow multiple NULLs, so legacy rows coexist.
CREATE UNIQUE INDEX "users_username_key" ON "users" ("username");

CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_digest" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Only the SHA-256 digest of the opaque browser token is stored, never the
-- token itself. Each digest is unique.
CREATE UNIQUE INDEX "sessions_token_digest_key" ON "sessions" ("token_digest");

-- Supports cascade cleanup and inexpensive session revocation.
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");

-- Supports server-enforced expiry checks and bounded expired-row cleanup.
CREATE INDEX "sessions_expires_at_idx" ON "sessions" ("expires_at");

COMMIT;
