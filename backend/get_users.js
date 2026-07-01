import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev?schema=public'
});

async function main() {
  try {
    const res = await pool.query('SELECT email, username, "passwordHash" FROM "User"');
    console.log("TaysrPOS_v0 Users:");
    res.rows.forEach(r => console.log(`Email: ${r.email} | Username: ${r.username} | Hash: ${r.passwordHash?.substring(0, 10)}...`));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
