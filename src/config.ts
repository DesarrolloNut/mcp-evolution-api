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

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  defaultInstance?: string;
  timeoutMs: number;
  /** Raw allowlist string from EVOLUTION_TOOLS (parsed by the registry). */
  toolsAllowlist?: string;
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

/**
 * Legacy configuration loader for direct Evolution API mode (stdio or backward compat).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): EvolutionConfig {
  const baseUrl = env.EVOLUTION_BASE_URL?.trim();
  const apiKey = env.EVOLUTION_API_KEY?.trim();

  const missing: string[] = [];
  if (!baseUrl) missing.push("EVOLUTION_BASE_URL");
  if (!apiKey) missing.push("EVOLUTION_API_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `See .env.example for setup.`,
    );
  }

  const timeoutRaw = env.EVOLUTION_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : 30000;
  if (Number.isNaN(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`EVOLUTION_TIMEOUT_MS must be a positive integer, got: ${timeoutRaw}`);
  }

  return {
    // Strip a single trailing slash so we can join paths predictably.
    baseUrl: baseUrl!.replace(/\/+$/, ""),
    apiKey: apiKey!,
    defaultInstance: env.EVOLUTION_DEFAULT_INSTANCE?.trim() || undefined,
    timeoutMs,
    toolsAllowlist: env.EVOLUTION_TOOLS?.trim() || undefined,
  };
}
