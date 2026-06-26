import 'dotenv/config';
import { AsyncLocalStorage } from 'async_hooks';
import { PrismaClient } from '../generated/client/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

type TenantStore = {
  databaseUrl?: string | null;
};

const tenantContext = new AsyncLocalStorage<TenantStore>();
const tenantClients = new Map<string, PrismaClient>();

const defaultConnectionString = process.env.TAYSRPOS_DATABASE_URL || 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev';
const defaultPool = new pg.Pool({ connectionString: defaultConnectionString });
const defaultAdapter = new PrismaPg(defaultPool);
const defaultPrisma = new PrismaClient({ adapter: defaultAdapter });

export const getDefaultPrisma = () => defaultPrisma;

export const getCurrentTenantDatabaseUrl = () => tenantContext.getStore()?.databaseUrl || null;

export const getTenantPrisma = (databaseUrl?: string | null) => {
  if (!databaseUrl) return defaultPrisma;
  const existing = tenantClients.get(databaseUrl);
  if (existing) return existing;

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  
  tenantClients.set(databaseUrl, client);
  return client;
};

export const runWithTenantDatabase = <T>(databaseUrl: string | null | undefined, callback: () => T) =>
  tenantContext.run({ databaseUrl }, callback);

export const prisma = new Proxy(defaultPrisma, {
  get(target, prop, receiver) {
    const client = getTenantPrisma(getCurrentTenantDatabaseUrl());
    const value = Reflect.get(client || target, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as PrismaClient;

export default prisma;