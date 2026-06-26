# TaysrPOS v0 - Development Roadmap & Progress

This document tracks all completed improvements and outlines the planned features. You can edit this file directly to adjust priorities or add new requirements.

## 🟢 Completed Improvements

### Phase A: Foundation & Login UI Restyling
- [x] Restyled the `TaysrPOS_v0` login page to feature a modern, split-screen design with glassmorphism.
- [x] Implemented a Quick PIN unlock UI for fast cashier switching.

### Phase B: Super Admin Platform Integration (The "Bridge")
- [x] Refactored `platform.service.ts` in `platform/backend` to natively support provisioning PostgreSQL databases for `POS` accounts.
- [x] Wired TaysrPOS_v0 to the Platform database using `platformPrisma.ts`.
- [x] Replaced the hardcoded single-database Prisma client with an `AsyncLocalStorage`-based dynamic tenant resolver.
- [x] Updated the POS auth flow to hit the platform control plane, intercept 409 multi-account conflicts, and display a modern Account Selector UI.
- [x] Pushed all bridge integrations to GitHub.

---

## 🟡 In Progress: Advanced Product Variations

**Goal:** Replicate UltimatePOS's robust product variation features, allowing products to have multiple variants (e.g., Size, Color) with specific SKUs, barcodes, pricing, and stock levels.

- [ ] **Schema Update:** Update `ProductVariation` model to handle structured attributes (e.g., Size, Color).
- [ ] **Backend Routes:** Update `POST /products` and `PUT /products/:id` to handle variation arrays.
- [ ] **Frontend Product Form:** Create a dynamic UI to add and configure variations when `isVariable` is toggled.
- [ ] **POS Register UI:** When adding a variable product to the cart, prompt the cashier to select the specific variation.

---

## 🔴 Planned Improvements (Upcoming)

### Invoices from Multiple Tickets (Factures)
- [ ] Allow creating a single consolidated invoice (Facture) from multiple POS tickets.
- [ ] Provide configuration options on the Facture template to either:
  - Show just the summarized ticket references.
  - Show the expanded details of each ticket with quantity sums and line items.

### Restaurant & Kitchen Display System (KDS)
- [ ] Table management and floor plan UI.
- [ ] Send orders directly to the kitchen display.
- [ ] Split bills and merge tables.

### Advanced Inventory Management
- [ ] Stock transfers between multiple warehouses.
- [ ] Purchase orders and supplier management.
- [ ] Stock adjustment logs.

---

*Note: Edit this file as needed to track our shared progress!*
