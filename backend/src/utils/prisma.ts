import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/client/index.js';

// Prisma 7 requires a driver adapter at runtime.
// The datasource URL in prisma.config.ts is for CLI only (migrate/push).
const connectionString = process.env.TAYSRPOS_DATABASE_URL
  || 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev';

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { taysrPosPrisma?: PrismaClient };

export const prisma = globalForPrisma.taysrPosPrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.taysrPosPrisma = prisma;
}