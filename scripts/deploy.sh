#!/usr/bin/env bash
set -e

echo "==============================================================="
echo "        TaysrPOS v0 Deployment Script (Docker / Coolify)        "
echo "==============================================================="

# 1. Environment Verification
ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  echo "==> Loading environment configuration from ${ENV_FILE}..."
  export $(grep -v '^#' "$ENV_FILE" | xargs)
else
  echo "==> Warning: No ${ENV_FILE} file found! Creating template from .env.example..."
  if [ -f "backend/.env.example" ]; then
    cp backend/.env.example .env
    echo "==> Please review and edit .env with your production secrets before deploying!"
  fi
fi

# 2. Check Docker & Docker Compose availability
if ! command -v docker &> /dev/null; then
  echo "==> Error: 'docker' command is not installed or not in PATH!"
  exit 1
fi

COMPOSE_CMD=""
if docker compose version &> /dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "==> Error: Neither 'docker compose' nor 'docker-compose' plugin found!"
  exit 1
fi

echo "==> Using Docker Compose command: ${COMPOSE_CMD}"

# 3. Build & Deploy Services (db, api, web)
echo "==> Building and launching services (db, api, web)..."
${COMPOSE_CMD} up -d --build

# 4. Healthcheck Verification
echo "==> Waiting for services to pass healthchecks..."
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  API_STATUS=$(${COMPOSE_CMD} ps api --format "{{.Health}}" 2>/dev/null || echo "starting")
  WEB_STATUS=$(${COMPOSE_CMD} ps web --format "{{.Health}}" 2>/dev/null || echo "starting")

  if [[ "$API_STATUS" == "healthy" ]] && [[ "$WEB_STATUS" == "healthy" ]]; then
    HEALTHY=true
    break
  fi

  echo "    Waiting for services healthchecks (API: ${API_STATUS:-starting}, WEB: ${WEB_STATUS:-starting})... retry $((RETRY_COUNT+1))/${MAX_RETRIES}"
  sleep 3
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$HEALTHY" = true ]; then
  echo "==============================================================="
  echo "  ✅ TaysrPOS v0 Deployed Successfully!"
  echo "==============================================================="
  echo "  • Web Frontend: http://localhost:${WEB_PORT:-80}"
  echo "  • API Backend:  http://localhost:4400/api/health"
  echo "  • Database:     PostgreSQL (service 'db', port 5432)"
  echo "==============================================================="
else
  echo "==> Warning: Services launched, but healthchecks did not report healthy within 90 seconds."
  echo "==> Inspecting logs:"
  ${COMPOSE_CMD} logs --tail=30
  exit 1
fi
