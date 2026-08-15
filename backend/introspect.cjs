const pg = require('pg');

const platformDatabaseUrl = process.env.DATABASE_URL || 'postgresql://admin:adminpassword@localhost:5432/gestoptical';
const pool = new pg.Pool({ connectionString: platformDatabaseUrl });

async function introspect() {
  try {
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables:");
    console.log(tables.map(t => t.table_name));

    const { rows: accountCols } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Account'
    `);
    console.log("\nAccount Columns:");
    console.log(accountCols);

    const { rows: planCols } = await pool.query(`
      SELECT column_name, data_type, table_name 
      FROM information_schema.columns 
      WHERE table_name = 'Plan' OR table_name = 'Subscription'
    `);
    console.log("\nPlan/Subscription Columns:");
    console.log(planCols);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

introspect();
