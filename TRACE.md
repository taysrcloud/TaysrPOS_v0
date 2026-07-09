# TaysrPOS v0 Trace

This file tracks the new POS rebuild under `C:\xampp\htdocs\TaysrSuite\apps\TaysrPOS_v0`.

Check this file before editing POS v0 code.

## Purpose

TaysrPOS v0 is the active modern POS direction for the suite.

It is inspired by:

- UltimatePOS workflows and useful business logic
- TaysrOptic shell/style quality

It should not blindly copy legacy clutter.

## Current Local Runtime

- Backend port: `4400`
- Frontend dev port: `5400`

## Important Files

- `backend/.env`
- `frontend/src/`
- `PROGRESS.md`
- `../..\\MASTER.md`
- `../..\\MAP.md`

## Known Risks

- Frontend port collides with Platform frontend if both use `5400`
- Register opening logic is critical and easy to regress
- Product creation must stay fast and practical
- UI can drift away from the Taysr shell if legacy POS styling leaks back in
- Encoding corruption has already hit POS work before

## Before-Edit Checks

1. Confirm whether the task belongs to POS v0 and not legacy `apps/TaysrPOS`
2. Check `PROGRESS.md` and suite `MASTER.md` first
3. Verify which runtime is active before debugging:
   - backend
   - frontend dev
   - Docker/Coolify
4. If touching styling, compare with TaysrOptic first
5. If touching workflows, prefer the useful UltimatePOS logic without keeping its clutter

## Product Rules

1. Base direction is ERP + POS
2. Restaurant is an activatable module, not the base app
3. Other products/modules should be controlled from Super Admin, not exposed as random user-facing settings
4. TVA behavior must be respected in tickets and invoices

## Recent Direction

- The app is being rebuilt as a real product, not a themed legacy wrapper
- Product flow, POS workflow, invoices, and settings still need hard implementation work
- Styling must stay consistent with the newer suite quality level

## Update Rule

When POS v0 changes, note:

- workflow added or fixed
- source inspiration used from UltimatePOS
- UI rules preserved
- platform/provisioning impact
