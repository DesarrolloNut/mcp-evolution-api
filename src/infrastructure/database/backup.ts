import path from 'node:path';
import fs from 'node:fs';
import { getDatabase, closeDatabase } from './connection.js';
import { loadGatewayConfig } from '../../config.js';

export async function createDatabaseBackup(customBackupPath?: string): Promise<string> {
  const config = loadGatewayConfig();
  const db = getDatabase(config.sqlitePath);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(path.dirname(config.sqlitePath), 'backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const destination = customBackupPath || path.join(backupDir, `mcp-whatsapp-${timestamp}.db`);

  console.log(`Starting SQLite hot backup from ${config.sqlitePath} to ${destination}...`);
  await db.backup(destination);
  console.log(`✓ Backup successfully created: ${destination}`);

  return destination;
}

// Allow direct CLI execution: node dist/infrastructure/database/backup.js
if (process.argv[1] && process.argv[1].endsWith('backup.js')) {
  createDatabaseBackup()
    .then(() => {
      closeDatabase();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}
