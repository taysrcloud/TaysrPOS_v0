#!/usr/bin/env bash
set -e

# ==============================================================================
# TaysrPOS_v1 - Master Test Verification Suite Orchestrator
# Executes full test matrix: Static Typecheck -> Security -> RBAC Matrix -> Business Flows -> E2E
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
export NODE_ENV=test

echo -e "${BLUE}${BOLD}======================================================================${NC}"
echo -e "${BLUE}${BOLD}     TAYSRPOS_v1 MASTER TEST SUITE - FULL REPOSITORY VERIFICATION     ${NC}"
echo -e "${BLUE}${BOLD}======================================================================${NC}\n"

# Ensure local PostgreSQL is running
if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
  echo "Starting PostgreSQL database server..."
  pg_ctl -D /data/data/com.termux/files/usr/var/lib/postgresql start
  sleep 2
fi

START_TIME=$(date +%s)

run_step() {
  local step_num="$1"
  local step_title="$2"
  local step_cmd="$3"

  echo -e "${YELLOW}[${step_num}/5]${NC} ${BOLD}${step_title}...${NC}"
  if eval "$step_cmd"; then
    echo -e "${GREEN}✔ PASSED: ${step_title}${NC}\n"
  else
    echo -e "${RED}✖ FAILED: ${step_title}${NC}\n"
    exit 1
  fi
}

# 1. Typecheck (Backend + Frontend)
run_step "1" "TypeScript Static Typecheck (Backend & Frontend)" "npm run typecheck"

# 2. Security Suite
run_step "2" "Security Hardening & Vulnerability Suite" "npm run test:security --workspace backend"

# 3. Integration & RBAC Matrix Suite
run_step "3" "27-Route RBAC Matrix, Tenant Isolation & Fiscal Compliance" "npm run test:api --workspace backend"

# 4. Core Business Flows
run_step "4" "End-to-End Core Transactional Business Flows" "npm run test:flows --workspace backend"

# 5. Frontend E2E Smoke Tests
run_step "5" "Frontend Headless Browser E2E Smoke Tests" "npm run test:e2e --workspace frontend"

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}     ALL SUITES PASSED CLEANLY (Total duration: ${TOTAL_TIME}s)                   ${NC}"
echo -e "${GREEN}${BOLD}======================================================================${NC}"
