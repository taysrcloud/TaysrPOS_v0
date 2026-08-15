# TaysrPOS v0 - Dockerfile
# Single-stage runtime to avoid slow cross-stage workspace node_modules copies on Windows

FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --workspace backend --workspace frontend

COPY . .

RUN cd backend && npx prisma generate --schema prisma/schema.prisma
RUN cd frontend && npm run build

EXPOSE 4400

CMD ["sh", "-c", "cd /app && node --import tsx backend/src/index.ts"]
