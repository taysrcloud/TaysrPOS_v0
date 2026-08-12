-- Purchase.status: String -> PurchaseStatus enum
--
-- DO NOT apply this schema change via `prisma db push`. Verified empirically on
-- 2026-08-12 against a local Postgres instance: `db push --accept-data-loss` on this
-- exact String->enum change DROPS AND RECREATES the column, and any row whose status
-- value is not the enum's new default is SILENTLY replaced by that default. A row with
-- status='PENDING' came back as status='RECEIVED' after `db push` - no error, no warning
-- beyond the generic "There might be data loss" prompt. Postgres cannot auto-cast
-- arbitrary text to a new enum type, so Prisma's migration engine drops the column instead
-- of casting it when using db push.
--
-- This file is the verified-safe replacement: an explicit USING cast, which Postgres CAN
-- perform automatically since every value written by this app ('PENDING', 'RECEIVED') is a
-- member of the new enum. Confirmed on 2026-08-12: a 'PENDING' row survives this exact SQL
-- with its value intact (drop-recreate via db push loses it; this does not).
--
-- Run this by hand (psql, or wrap in your deploy tool) against ANY tenant database that
-- already has Purchase rows, BEFORE running `prisma db push` / `prisma migrate deploy` with
-- the updated schema.prisma. Databases with zero Purchase rows (e.g. a fresh tenant, or this
-- project's own dev DB before this migration was first applied) can safely use `db push`
-- instead, since there's no existing data for the drop-recreate to destroy.

CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'RETURNED');

ALTER TABLE "Purchase" ALTER COLUMN status DROP DEFAULT;
ALTER TABLE "Purchase"
  ALTER COLUMN status TYPE "PurchaseStatus"
  USING status::"PurchaseStatus";
ALTER TABLE "Purchase" ALTER COLUMN status SET DEFAULT 'RECEIVED'::"PurchaseStatus";
ALTER TABLE "Purchase" ALTER COLUMN status SET NOT NULL;
