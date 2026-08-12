## Manual migrations

This project has no `prisma migrate` history — schema changes are applied with
`npm run prisma:push` (`prisma db push`), which is fine for additive changes (new
models, new nullable columns) but **is not safe for changes that alter an existing
column's type on a table that may already have rows** — Prisma's schema engine will
sometimes resolve those as a drop-and-recreate of the column, silently discarding any
existing values that don't match the new default. Verified concretely on 2026-08-12
with the `Purchase.status` String → enum conversion: `db push --accept-data-loss`
turned an existing `'PENDING'` row into `'RECEIVED'`, with no error.

`db push` always prints a warning ("There might be data loss when applying the
changes") before this kind of change. Treat that warning as a hard stop on any
database that isn't empty/disposable — do not pass `--accept-data-loss` and move on.
Instead:

1. Write the safe SQL by hand (typically `ALTER TABLE ... ALTER COLUMN ... TYPE ...
   USING ...`, which Postgres can apply as an in-place cast instead of a drop-recreate).
2. Verify it against a copy of real data — insert a row with the value you're worried
   about losing, apply the SQL, confirm it survived.
3. Save the verified SQL as a dated file in this directory, and run it by hand (or via
   whatever deploy mechanism applies schema to tenant databases) *before* running
   `prisma db push` with the corresponding `schema.prisma` change.

See `2026-08-12_purchase_status_enum.sql` for the reference example.
