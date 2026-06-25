import { defineConfig } from 'prisma/config';

const localDatabaseUrl = 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.TAYSRPOS_DATABASE_URL || localDatabaseUrl,
  },
});