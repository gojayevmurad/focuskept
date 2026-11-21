import pg from "pg";
if (process.env.NODE_ENV === "production")
  throw new Error("Development inbox is disabled in production");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(
    "select kind, recipient, url from email_preview order by created_at desc limit 10",
  );
  console.table(result.rows);
} finally {
  await pool.end();
}
