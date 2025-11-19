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
  
  try {
    const columns = db.pragma("table_info(users)") as any[];
    const hasAvatarUrl = columns.some(col => col.name === 'avatar_url');
    const hasAccountType = columns.some(col => col.name === 'account_type');
    const hasOAuth42Id = columns.some(col => col.name === 'oauth42_id');
    const hasOAuth42Login = columns.some(col => col.name === 'oauth42_login');
    
    if (!hasAvatarUrl) {
      db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
    }
    
    if (!hasAccountType) {
      db.exec("ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'local'");
      db.exec("ALTER TABLE users ADD COLUMN oauth42_data TEXT");
      db.exec("ALTER TABLE users ADD COLUMN last_42_sync DATETIME");
      db.exec("ALTER TABLE users ADD COLUMN updated_at DATETIME");
      
      db.exec("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL");
    }
    
    if (!hasOAuth42Id) {
      db.exec("ALTER TABLE users ADD COLUMN oauth42_id INTEGER UNIQUE");
    }
    
    if (!hasOAuth42Login) {
      db.exec("ALTER TABLE users ADD COLUMN oauth42_login TEXT UNIQUE");
    }
    
    if (hasOAuth42Id && hasAccountType) {
      db.exec("UPDATE users SET account_type = 'oauth42' WHERE oauth42_id IS NOT NULL AND account_type = 'local'");
    }

    try {
      const indexes = db.pragma("index_list(users)") as any[];
      const hasDisplayNameIndex = indexes.some(idx => idx.name.includes('display_name'));
      
      if (!hasDisplayNameIndex) {

        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique ON users(display_name)");
      }
    } catch (indexError) {
      console.warn("Display name unique index warning:", indexError);
    }
    
  } catch (e) {
    console.warn("Migration warning:", e);
  }
}

export default db;