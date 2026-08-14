# Backend API Dockerfile for TaysrPOS v0
FROM node:22-alpine AS builder

WORKDIR /app

# Install postgresql-client for pg_isready health checks & curl
RUN apk add --no-cache postgresql-client curl

# Copy root workspace package definitions
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Install dependencies
RUN npm ci --workspace backend --include=dev

# Copy backend source code and prisma schema
COPY backend backend

WORKDIR /app/backend

# Generate Prisma Client
RUN npx prisma generate --schema prisma/schema.prisma

RUN chmod +x docker-entrypoint.sh

EXPOSE 4400

ENTRYPOINT ["./docker-entrypoint.sh"]
