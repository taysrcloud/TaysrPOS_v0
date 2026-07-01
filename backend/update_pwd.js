import pg from 'pg';
import bcrypt from 'bcrypt';

const pool = new pg.Pool({
  connectionString: 'postgresql://admin:adminpassword@localhost:5432/taysrpos_dev?schema=public'
});

async function main() {
  try {
    const password = 'password123';
    const hash = await bcrypt.hash(password, 10);
    const res = await pool.query('UPDATE "User" SET "passwordHash" = $1 WHERE username = $2 RETURNING *', [hash, 'admin']);
    console.log("Updated admin password to 'password123'. Rows affected:", res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
