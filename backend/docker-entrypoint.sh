#!/bin/sh
set -e

echo "==> [API Entrypoint] Starting TaysrPOS v0 API initialization..."

# Extract host and port from DATABASE_URL if available, defaulting to db:5432
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "==> [API Entrypoint] Waiting for PostgreSQL database at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; do
  echo "    Database not ready yet, retrying in 2 seconds..."
  sleep 2
done

echo "==> [API Entrypoint] PostgreSQL is ready!"

echo "==> [API Entrypoint] Applying Prisma database schema..."
npx prisma db push --schema prisma/schema.prisma --accept-data-loss

echo "==> [API Entrypoint] Database schema up to date."

echo "==> [API Entrypoint] Starting API server..."
exec node --import tsx src/index.ts
