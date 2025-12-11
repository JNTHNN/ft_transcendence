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

    const has2FAColumns = columns.some(col => col.name === 'totp_secret');
    if (!has2FAColumns) {
      db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT");
      db.exec("ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE");
      db.exec("ALTER TABLE users ADD COLUMN backup_codes TEXT");
      db.exec("ALTER TABLE users ADD COLUMN totp_setup_at DATETIME");
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS temp_login_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec("CREATE INDEX IF NOT EXISTS idx_temp_tokens_user_id ON temp_login_tokens(user_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_temp_tokens_expires ON temp_login_tokens(expires_at)");
    } catch (e) {

    }

    try {
      const indexes = db.pragma("index_list(users)") as any[];
      const hasDisplayNameIndex = indexes.some(idx => idx.name.includes('display_name'));
      
      if (!hasDisplayNameIndex) {

        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique ON users(display_name)");
      }
    } catch (indexError) {

    }

    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
      const hasFriendships = tables.some(table => table.name === 'friendships');
      const hasMatchHistory = tables.some(table => table.name === 'match_history');

      if (!hasFriendships) {
        db.exec(`
          CREATE TABLE friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(requester_id, receiver_id)
          );
        `);
        
        db.exec("CREATE INDEX idx_friendships_requester ON friendships(requester_id)");
        db.exec("CREATE INDEX idx_friendships_receiver ON friendships(receiver_id)");
        db.exec("CREATE INDEX idx_friendships_status ON friendships(status)");
      }

      if (!hasMatchHistory) {
        db.exec(`
          CREATE TABLE match_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id INTEGER NOT NULL,
            player2_id INTEGER NOT NULL,
            player1_score INTEGER NOT NULL DEFAULT 0,
            player2_score INTEGER NOT NULL DEFAULT 0,
            winner_id INTEGER,
            match_type TEXT NOT NULL DEFAULT 'solo' CHECK (match_type IN ('solo', 'local', 'online', 'tournament')),
            duration INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
          );
        `);
        
        db.exec("CREATE INDEX idx_match_history_player1 ON match_history(player1_id)");
        db.exec("CREATE INDEX idx_match_history_player2 ON match_history(player2_id)");
      }

      const hasUserSessions = tables.some(table => table.name === 'user_sessions');
      if (!hasUserSessions) {
        db.exec(`
          CREATE TABLE user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_online INTEGER DEFAULT 1,
            user_agent TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);
        
        db.exec("CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id)");
        db.exec("CREATE INDEX idx_user_sessions_token ON user_sessions(session_token)");
        db.exec("CREATE INDEX idx_user_sessions_online ON user_sessions(is_online)");
      }
      
      // Migration pour les colonnes blockchain dans tournament_matches
      try {
        const tournamentMatchesColumns = db.pragma("table_info(tournament_matches)") as any[];
        const hasBlockchainTxHash = tournamentMatchesColumns.some(col => col.name === 'blockchain_tx_hash');
        const hasBlockchainMatchId = tournamentMatchesColumns.some(col => col.name === 'blockchain_match_id');
        
        if (!hasBlockchainTxHash) {
          db.exec("ALTER TABLE tournament_matches ADD COLUMN blockchain_tx_hash TEXT");
        }
        
        if (!hasBlockchainMatchId) {
          db.exec("ALTER TABLE tournament_matches ADD COLUMN blockchain_match_id TEXT");
        }
      } catch (blockchainError) {
        console.warn("Blockchain columns migration failed:", blockchainError);
      }
      
    } catch (friendsError) {
    }
    
  } catch (e) {
  }
}

export default db;