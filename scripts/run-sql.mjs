// Corre un archivo .sql contra DATABASE_URL (del .env). Uso:
//   node scripts/run-sql.mjs supabase/migrations/0001_policies.sql
import { readFileSync } from "node:fs";
import { Client } from "pg";
import "dotenv/config";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/run-sql.mjs <archivo.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${file}`);
} catch (err) {
  console.error(`Error ejecutando ${file}:`, err.message);
  process.exit(1);
} finally {
  await client.end();
}
