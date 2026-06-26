import pg from 'pg';
import 'dotenv/config';

// Connect to the Platform Database to read Account and PlatformUser tables
const platformDatabaseUrl = process.env.DATABASE_URL || 'postgresql://admin:adminpassword@localhost:5432/gestoptical';
const pool = new pg.Pool({ connectionString: platformDatabaseUrl });

export const platformDb = {
  async query<T = any>(text: string, params?: any[]) {
    const { rows } = await pool.query(text, params);
    return rows as T[];
  },
  async findAccountByDatabaseUrl(databaseUrl: string) {
    const rows = await this.query(`SELECT * FROM "Account" WHERE "databaseUrl" = $1 LIMIT 1`, [databaseUrl]);
    return rows[0] || null;
  },
  async findPlatformUserByEmailOrUsername(identifier: string) {
    const rows = await this.query(`
      SELECT * FROM "PlatformUser" 
      WHERE "email" = $1 OR "username" = $1 
      LIMIT 1
    `, [identifier.trim().toLowerCase()]);
    return rows[0] || null;
  },
  async getMemberships(platformUserId: number) {
    return this.query(`
      SELECT au.*, a.status, a.code, a."databaseUrl", a.name as "accountName"
      FROM "AccountUser" au
      JOIN "Account" a ON au."accountId" = a.id
      WHERE au."platformUserId" = $1
    `, [platformUserId]);
  }
};

export default platformDb;
