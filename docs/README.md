# Taysr Core v1 Documentation (TaysrPOS_v1)

Welcome to the documentation for **Taysr Core v1** — horizontal commercial engine and enterprise ERP/POS platform built with TypeScript, Node.js/Express, React 19, Prisma ORM, and PostgreSQL.

---

## 📚 Documentation Index

### 1. Architecture & Domain Contracts
- **[Core Architecture Specification](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/CORE_ARCHITECTURE.md)**: Architectural principles, service boundaries, and system components.
- **[Core Domain Boundaries](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/CORE_DOMAIN_BOUNDARIES.md)**: Formal boundary definition separating Core commercial primitives from vertical domain extensions (Taysr Optic).
- **[Core API Contract (v1)](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/CORE_API_CONTRACT.md)**: Standardized REST API contract across all 27 Core modules.
- **[System Blueprint](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/BLUEPRINT.md)**: Clean generic ERP & POS domain models and operational workflows.
- **[Product Decisions](file:///data/data/com.termux/files/home/TaysrERP/TaysrPOS_v1/docs/PRODUCT_DECISIONS.md)**: Moroccan fiscal compliance, TVA rates, multi-currency FX snapshots, and multi-tenant isolation.
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
