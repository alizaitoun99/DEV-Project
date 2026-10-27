BEGIN;

-- Abort rather than merging accounts or discarding user-owned data.
LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User" WHERE "email" IS NOT NULL
    GROUP BY lower(btrim("email")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Canonical email collisions exist; resolve account ownership before retrying this migration.';
  END IF;
END $$;

UPDATE "User" SET "email" = lower(btrim("email"))
WHERE "email" IS DISTINCT FROM lower(btrim("email"));

-- Together with User_email_key, enforce canonical uniqueness for every writer.
ALTER TABLE "User" ADD CONSTRAINT "User_email_canonical_check"
CHECK ("email" IS NULL OR "email" = lower(btrim("email")));

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");

COMMIT;
