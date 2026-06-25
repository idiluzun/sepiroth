import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, query } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "schema.sql");

export async function runMigration() {
  const schema = await fs.readFile(schemaPath, "utf8");
  await query(schema);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await runMigration();
    console.log("Database schema is ready.");
  } catch (error) {
    console.error("Migration failed.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
