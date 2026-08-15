import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev?schema=public'
});

async function main() {
  try {
    const res = await pool.query('SELECT * FROM "CashRegisterSession"');
    console.log("Sessions:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
