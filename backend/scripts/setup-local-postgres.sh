#!/data/data/com.termux/files/usr/bin/bash
# Sets up a local Postgres server for DB-backed testing on Termux/Android (aarch64).
# Prisma's engine auto-detection picks a debian-openssl-1.1.x x86-64 binary on this
# platform ("Prisma detected unknown OS android... defaulting to linux"), which cannot
# execute here (wrong CPU architecture, wrong libc). This script:
#   1. Installs and starts a real Postgres server via Termux's own package (aarch64-native,
#      no workaround needed - only the *Prisma CLI's* schema-engine has the platform problem).
#   2. Creates the databases backend/.env expects.
#   3. Downloads the correct linux-arm64 schema-engine build and runs it through Termux's
#      glibc-runner (`grun`), since the engine is a glibc-linked ARM64 Linux binary and
#      Termux's userland is Bionic (Android) libc, not glibc.
#   4. Pushes prisma/schema.prisma to the database using that engine.
#
# Safe to re-run: each step checks whether it already applies before acting.
# Requires network access (installs the `postgresql` Termux package, downloads the engine
# binary from Prisma's CDN) and `glibc-runner`/`glibc` Termux packages (installs them if
# missing).
set -euo pipefail

cd "$(dirname "$0")/.."   # backend/

DB_ADMIN_USER="admin"
DB_ADMIN_PASSWORD="adminpassword"
DB_NAMES=("taysrpos_dev" "taysroptic_platform")
PG_DATA_DIR="$PREFIX/var/lib/postgresql"
ENGINE_CACHE_DIR="$PREFIX/tmp/prisma-arm64"

echo "==> Checking Termux packages (postgresql, glibc, glibc-runner)..."
for p in postgresql glibc glibc-runner; do
  if ! pkg list-installed 2>/dev/null | grep -q "^$p/"; then
    echo "    installing $p..."
    pkg install -y "$p"
  fi
done

echo "==> Initializing Postgres data directory (if needed)..."
if [ ! -d "$PG_DATA_DIR" ] || [ -z "$(ls -A "$PG_DATA_DIR" 2>/dev/null)" ]; then
  mkdir -p "$PG_DATA_DIR"
  initdb -D "$PG_DATA_DIR" -U "$DB_ADMIN_USER" --pwfile=<(echo "$DB_ADMIN_PASSWORD")
else
  echo "    already initialized."
fi

echo "==> Starting Postgres server (if not already running)..."
if ! pg_ctl -D "$PG_DATA_DIR" status >/dev/null 2>&1; then
  pg_ctl -D "$PG_DATA_DIR" -l "$PG_DATA_DIR/logfile" start
else
  echo "    already running."
fi

echo "==> Creating databases (if needed)..."
for db in "${DB_NAMES[@]}"; do
  exists=$(psql -U "$DB_ADMIN_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'")
  if [ "$exists" != "1" ]; then
    psql -U "$DB_ADMIN_USER" -d postgres -c "CREATE DATABASE $db OWNER $DB_ADMIN_USER;"
  else
    echo "    $db already exists."
  fi
done

echo "==> Fetching aarch64 schema-engine (if needed)..."
mkdir -p "$ENGINE_CACHE_DIR"
ENGINE_BIN="$ENGINE_CACHE_DIR/schema-engine"
WRAPPER="$ENGINE_CACHE_DIR/schema-engine-wrapper.sh"

if [ ! -x "$ENGINE_BIN" ]; then
  ENGINES_HASH=$(node ../node_modules/prisma/build/index.js -v 2>&1 | grep "Default Engines Hash" | awk '{print $NF}')
  if [ -z "$ENGINES_HASH" ]; then
    echo "Could not determine Prisma engines hash from 'prisma -v' output. Aborting." >&2
    exit 1
  fi
  echo "    engines hash: $ENGINES_HASH"
  curl -sL "https://binaries.prisma.sh/all_commits/${ENGINES_HASH}/linux-arm64-openssl-3.0.x/schema-engine.gz" \
    -o "$ENGINE_BIN.gz"
  gunzip -f "$ENGINE_BIN.gz"
  chmod +x "$ENGINE_BIN"
else
  echo "    already downloaded."
fi

if [ ! -f "$WRAPPER" ]; then
  cat > "$WRAPPER" <<EOF
#!$PREFIX/bin/bash
exec grun "$ENGINE_BIN" "\$@"
EOF
  chmod +x "$WRAPPER"
  grun --configure "$ENGINE_BIN"
fi

echo "==> Verifying the wrapped engine runs..."
"$WRAPPER" --version

echo "==> Pushing prisma/schema.prisma to taysrpos_dev..."
PRISMA_SCHEMA_ENGINE_BINARY="$WRAPPER" \
  node ../node_modules/prisma/build/index.js db push --schema prisma/schema.prisma

echo ""
echo "Done. Postgres is running on localhost:5432 (admin/adminpassword)."
echo "To re-push schema changes later:"
echo "  PRISMA_SCHEMA_ENGINE_BINARY=$WRAPPER npx prisma db push --schema prisma/schema.prisma"
echo "To stop the server: pg_ctl -D $PG_DATA_DIR stop"
echo "To start it again:  pg_ctl -D $PG_DATA_DIR -l $PG_DATA_DIR/logfile start"
