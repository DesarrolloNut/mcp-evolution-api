import Database from 'better-sqlite3';

interface Migration {
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    name: '001_initial',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL,
          base_url TEXT NOT NULL,
          api_key_encrypted TEXT NOT NULL,
          config_json TEXT NOT NULL DEFAULT '{}',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS channels (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
          name TEXT NOT NULL UNIQUE,
          phone_number TEXT,
          instance_id TEXT,
          config_json TEXT NOT NULL DEFAULT '{}',
          is_default INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          details_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_channels_provider ON channels(provider_id);
        CREATE INDEX IF NOT EXISTS idx_channels_default ON channels(is_default);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  // Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
  const appliedSet = new Set(appliedRows.map((r) => r.name));

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)'
  );

  for (const m of migrations) {
    if (!appliedSet.has(m.name)) {
      db.transaction(() => {
        m.up(db);
        insertMigration.run(m.name, new Date().toISOString());
      })();
    }
  }
}
