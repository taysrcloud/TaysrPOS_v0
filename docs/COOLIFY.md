# TaysrPOS v0 — Deployment Guide (Docker & Coolify)

This guide details how to deploy **TaysrPOS v0** as 3 separate services (`web`, `api`, `db`) using Docker Compose or [Coolify](https://coolify.io).

---

## Service Architecture

```mermaid
graph TD
    User[Client Browser / Device] -->|Port 80 / 443| Web[web: Nginx SPA Frontend]
    Web -->|Proxy /api, /sync, /device| API[api: Node.js Express API]
    API -->|Port 5432| DB[(db: PostgreSQL 16)]
```

| Service | Technology | Description | Exposed Port |
|---|---|---|---|
| **`web`** | Nginx 1.27 + Vite React | Static SPA frontend with reverse proxy to `api` | `80` (or `5400`) |
| **`api`** | Node.js 22 + Express 5 + Prisma | Backend REST API & device sync server | `4400` |
| **`db`** | PostgreSQL 16 Alpine | Relational database with persistent volume | `5432` (internal) |

---

## Option 1: Coolify Docker Compose Deployment (Recommended)

1. In your Coolify dashboard, select **+ New Resource** → **Docker Compose**.
2. Connect your Git repository (`https://github.com/taysrcloud/TaysrPOS_v0.git`).
3. Set the **Compose File Location** to `/docker-compose.yml`.
4. Configure Environment Variables in Coolify:
   ```env
   NODE_ENV=production
   JWT_SECRET=your-secure-jwt-secret-minimum-32-characters-long
   POSTGRES_USER=taysr_admin
   POSTGRES_PASSWORD=your-secure-db-password
   POSTGRES_DB=taysrpos_prod
   CORS_ORIGINS=https://app.yourdomain.com
   TAYSRPOS_PROVISIONING_SECRET=your-provisioning-secret
   ```
5. Click **Deploy**. Coolify will build and start `db`, `api`, and `web` automatically with healthcheck tracking.

---

## Option 2: Coolify Separate Services Deployment

If you prefer to manage database, backend, and frontend as standalone Coolify resources:

### 1. Database (`db`)
- Create a **PostgreSQL Database** resource in Coolify.
- Note the internal connection string: `postgresql://taysr_admin:PASSWORD@db-host:5432/taysrpos_prod`.

### 2. Backend API (`api`)
- Create a **Public/Private Repository** application resource in Coolify.
- Build Pack: **Dockerfile**.
- Dockerfile Location: `/backend/Dockerfile`.
- Port: `4400`.
- Healthcheck Path: `/api/health`.
- Environment Variables:
  - `NODE_ENV=production`
  - `DATABASE_URL=postgresql://...`
  - `JWT_SECRET=your-secure-32-char-secret`
  - `CORS_ORIGINS=https://app.yourdomain.com`

### 3. Frontend Web (`web`)
- Create a **Public/Private Repository** application resource in Coolify.
- Build Pack: **Dockerfile**.
- Dockerfile Location: `/frontend/Dockerfile`.
- Port: `80`.
- Healthcheck Path: `/`.
- Custom Domain: Set your FQDN (e.g. `app.yourdomain.com`) with Automatic SSL/HTTPS.

---

## Option 3: Local or Self-Hosted Docker Compose

To deploy directly on a Linux server or local Docker host:

```bash
# 1. Clone repo
git clone https://github.com/taysrcloud/TaysrPOS_v0.git
cd TaysrPOS_v0

# 2. Copy and customize secrets in .env
cp backend/.env.example .env
nano .env

# 3. Run automated deployment script
./scripts/deploy.sh
```

Or manually with Docker Compose:

```bash
# Build and start services in background
docker compose up -d --build

# View real-time logs
docker compose logs -f

# Check health status of all 3 services
docker compose ps
```

---

## Environment Variables Reference

| Variable | Required in Prod | Default Value | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` | Enables strict production security checks |
| `JWT_SECRET` | **Yes (min 32 chars)** | None | Signs and verifies authentication tokens |
| `POSTGRES_USER` | Yes | `postgres` | PostgreSQL superuser username |
| `POSTGRES_PASSWORD` | Yes | `postgrespassword` | PostgreSQL superuser password |
| `POSTGRES_DB` | Yes | `taysrpos_v0` | PostgreSQL database name |
| `DATABASE_URL` | Yes | Auto-constructed | Connection string for Prisma ORM |
| `CORS_ORIGINS` | Yes | `http://localhost` | Allowed CORS origins for browser security |
| `TAYSRPOS_PROVISIONING_SECRET` | Yes | None | Secret for multi-tenant provisioning API |
| `WEB_PORT` | No | `80` | Host port mapping for `web` service |

---

## Automatic Database Migrations

The `api` container includes a smart `docker-entrypoint.sh` script that:
1. Waits for PostgreSQL readiness on host `db:5432` using `pg_isready`.
2. Automatically applies database schema updates via `npx prisma db push`.
3. Starts the API server once the database is fully initialized.

No manual migration step is required upon deployment.
