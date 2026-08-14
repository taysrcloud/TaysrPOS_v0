# Frontend Web Dockerfile for TaysrPOS v0
# Stage 1: Build static React Vite SPA
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace package definitions
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Install dependencies
RUN npm ci --workspace frontend

# Copy frontend source code
COPY frontend frontend

WORKDIR /app/frontend

# Build frontend production bundle
RUN npm run build

# Stage 2: Serve static bundle via Nginx
FROM nginx:1.27-alpine AS runtime

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build output from Stage 1
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
