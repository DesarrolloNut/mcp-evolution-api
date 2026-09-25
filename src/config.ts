/**
 * Loads and validates configuration from environment variables.
 */
import crypto from 'node:crypto';

export type AppMode = 'server' | 'stdio';

export interface GatewayConfig {
  mode: AppMode;
  httpPort: number;
  httpHost: string;
  mcpApiToken?: string;
  adminUsername: string;
  adminPassword: string;
  adminJwtSecret: string;
  encryptionKey: string;
  sqlitePath: string;
}

// Fallback runtime generated secrets if not specified in env
let fallbackJwtSecret: string | null = null;
let fallbackEncryptionKey: string | null = null;

export function loadGatewayConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const mode = (env.WHATSAPP_MODE?.trim().toLowerCase() === 'stdio' ? 'stdio' : 'server') as AppMode;
  const httpPort = env.HTTP_PORT ? parseInt(env.HTTP_PORT, 10) : 3000;
  const httpHost = env.HTTP_HOST?.trim() || '0.0.0.0';
  const mcpApiToken = env.MCP_API_TOKEN?.trim() || undefined;

  const adminUsername = env.ADMIN_USERNAME?.trim() || 'admin';
  const adminPassword = env.ADMIN_PASSWORD?.trim() || 'admin';

  if (!fallbackJwtSecret) {
    fallbackJwtSecret = crypto.randomBytes(32).toString('hex');
  }
  const adminJwtSecret = env.ADMIN_JWT_SECRET?.trim() || fallbackJwtSecret;

  if (!fallbackEncryptionKey) {
    fallbackEncryptionKey = crypto.randomBytes(32).toString('hex');
  }
  const encryptionKey = env.ENCRYPTION_KEY?.trim() || fallbackEncryptionKey;

  const sqlitePath = env.SQLITE_PATH?.trim() || './data/mcp-whatsapp.db';

  return {
    mode,
    httpPort: Number.isNaN(httpPort) ? 3000 : httpPort,
    httpHost,
    mcpApiToken,
    adminUsername,
    adminPassword,
    adminJwtSecret,
    encryptionKey,
    sqlitePath,
  };
}

