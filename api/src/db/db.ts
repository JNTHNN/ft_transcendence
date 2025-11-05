import Database from "better-sqlite3";
import { readFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DATA_DIR = "/data";
mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE =
  process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.replace("file:", "")
    : `${DATA_DIR}/app.sqlite`;

const db = new Database(DB_FILE);
db.pragma("foreign_keys = ON");

export function migrate(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "schema.sql"),
    "/app/src/db/schema.sql"
  ];
  const schemaPath = candidates.find((p) => existsSync(p));
  if (!schemaPath) {
    throw new Error(`schema.sql introuvable. Cherché: ${candidates.join(", ")}`);
  }
  const sql = readFileSync(schemaPath, "utf8");
  db.exec(sql);
}

export default db;