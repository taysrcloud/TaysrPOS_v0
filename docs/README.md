# TaysrPOS_v1 Documentation

Welcome to the documentation for **TaysrPOS_v1** — modern enterprise POS and retail ERP built with TypeScript, Node.js/Express, React 19, Prisma ORM, and PostgreSQL.

---

## 📚 Documentation Index

### 1. Architecture & Design
- **[System Architecture & Blueprint](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/BLUEPRINT.md)**: Architectural overview, domain models, database schema, and technical stack.
- **[Product Decisions](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/PRODUCT_DECISIONS.md)**: Core design and business logic decisions (Moroccan fiscal compliance, TVA rates, multi-currency FX snapshots, multi-tenant isolation).
- **[Coolify & Self-Hosting Deployment](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/COOLIFY.md)**: Containerization, Nixpacks, and self-hosted deployment guides.

### 2. Testing & Quality Assurance
- **[Master Testing Guide](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/TESTING.md)**: Master testing guide explaining the 5-tier testing architecture, fixture lifecycle, test helpers, local execution, and CI pipeline.
- **[Complete Test Matrix](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/TEST_MATRIX.md)**: Detailed test matrix mapping the 27 backend routes across 4 RBAC roles, tenant isolation assertions, and transactional business flows.
- **[Security Hardening & Vulnerability Remediation](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/SECURITY_HARDENING.md)**: Documentation of security hardening measures (OAuth backdoor elimination, provisioning secret enforcement, JWT payload hygiene).

### 3. Testing Plan & Implementation Reports
- **[Full App Testing Plan](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/PLAN.md)**: The comprehensive implementation plan for the automated test suite.
- **[Test Scripts & Helpers Reference](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/SCRIPTS.md)**: Reference guide for all testing scripts, database helpers, and HTTP clients.
- **[Task 1: Test Infrastructure & Helper Scaffolding](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/reports/task-1-report.md)**
- **[Task 2: Security & Hardening Verification Suite](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/reports/task-2-report.md)**
- **[Task 3: 27-Route RBAC Matrix & Isolation Suite](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/reports/task-3-report.md)**
- **[Task 4: Core Transactional End-to-End Flows](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/reports/task-4-report.md)**
- **[Task 5: Frontend Headless Browser Smoke Tests](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/reports/task-5-report.md)**
- **[Task 6: Master Test Orchestrator & CI Automation](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/reports/task-6-report.md)**
- **[Final Master Verification Report](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/testing-plan/reports/FINAL_VERIFICATION_REPORT.md)**

---

## ⚡ Quick Test Commands

```bash
# Run all 5 testing tiers (Static Typecheck -> Security -> RBAC Matrix -> Business Flows -> E2E)
npm run test:full

# Run backend test suites only (Security + Integration + Flows)
npm run test --workspace backend

# Run headless browser E2E smoke tests
npm run test:e2e --workspace frontend

# Static TypeScript typecheck across backend and frontend
npm run typecheck
```
