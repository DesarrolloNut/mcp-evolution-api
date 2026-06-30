/**
 * Loads and validates configuration from environment variables.
 */

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  defaultInstance?: string;
  timeoutMs: number;
  /** Raw allowlist string from EVOLUTION_TOOLS (parsed by the registry). */
  toolsAllowlist?: string;
}

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
