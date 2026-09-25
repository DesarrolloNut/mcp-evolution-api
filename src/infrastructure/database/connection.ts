import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: Database.Database | null = null;

export function getDatabase(sqlitePath: string = './data/mcp-whatsapp.db'): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure the directory exists before opening SQLite file (vital for Docker mounts and local run)
  const dir = path.dirname(path.resolve(sqlitePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(sqlitePath);

  // WAL mode for superior concurrency & resilience against crashes
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('foreign_keys = ON');

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
