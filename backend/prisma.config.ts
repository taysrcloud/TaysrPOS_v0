import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL || process.env.TAYSRPOS_DATABASE_URL || 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});