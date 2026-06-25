# ─────────────────────────────────────────────────────────────
# TaysrPOS v0 — Multi-stage Dockerfile
# Backend API (Express/Prisma) + Frontend (Vite/React) static
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ──────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy workspace root + both sub-package manifests
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --workspace backend --workspace frontend

# ── Stage 2: Build frontend + generate Prisma ─────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY . .

# Generate Prisma client
RUN cd backend && npx prisma generate --schema prisma/schema.prisma

# Build frontend
RUN cd frontend && npm run build

# ── Stage 3: Production runtime ───────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy backend source + deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend ./backend

# Copy built frontend
COPY --from=build /app/frontend/dist ./frontend/dist

EXPOSE 4400

CMD ["node", "--import", "tsx", "backend/src/index.ts"]
