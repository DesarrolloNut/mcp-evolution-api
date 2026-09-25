/**
 * Smoke test for mcp-whatsapp.
 * Supports both HTTP Gateway mode (SQLite, channels, provider resolution)
 * and legacy stdio Evolution API checks.
 */

import { loadGatewayConfig } from './config.js';
import { getDatabase, closeDatabase } from './infrastructure/database/connection.js';
import { runMigrations } from './infrastructure/database/migrations.js';
import { SqliteProviderRepository } from './infrastructure/database/repositories/providerRepo.js';
import { SqliteChannelRepository } from './infrastructure/database/repositories/channelRepo.js';
import { ProviderFactory } from './application/services/providerFactory.js';
import { ChannelResolver } from './application/services/channelResolver.js';
import { buildUnifiedRegistry } from './interfaces/mcp/registry.js';
import { EvolutionClient } from './client.js';

async function runGatewaySmoke(): Promise<void> {
  console.log('--- Testing MCP WhatsApp Gateway Mode ---');
  const config = loadGatewayConfig();

  // 1. Verify Database & Migrations
  const db = getDatabase(config.sqlitePath);
  runMigrations(db);
  console.log('✅ SQLite database initialized with WAL mode and migrations applied.');

  // 2. Verify Repositories & Resolver
  const providerRepo = new SqliteProviderRepository(db, config.encryptionKey);
  const channelRepo = new SqliteChannelRepository(db);
  const providerFactory = new ProviderFactory(config.encryptionKey);
  const resolver = new ChannelResolver(channelRepo, providerRepo, providerFactory);

  const providers = await providerRepo.findAll();
  const channels = await channelRepo.findAll();
  console.log(`✅ Database accessible: ${providers.length} provider(s), ${channels.length} channel(s) registered.`);
  if (channels.length > 0) {
    const resolved = await resolver.resolve();
    console.log(`✅ Default channel resolved: ${resolved.channel.name} (${resolved.provider.name})`);
  }

  // 3. Verify MCP Tool Registry
  const registry = buildUnifiedRegistry();
  console.log(`✅ Unified MCP Tool Registry loaded: ${registry.tools.length} tools registered.`);

  closeDatabase();
  console.log('\nAll gateway smoke checks passed successfully.');
}

async function runLegacySmoke(): Promise<void> {
  console.log('--- Testing Legacy Evolution API Stdio Mode ---');
  const baseUrl = process.env.EVOLUTION_BASE_URL!;
  const apiKey = process.env.EVOLUTION_API_KEY!;
  const defaultInstance = process.env.EVOLUTION_DEFAULT_INSTANCE;

  const client = new EvolutionClient({
    baseUrl,
    apiKey,
    defaultInstance,
    timeoutMs: 30000,
  });

  const checks: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: 'fetchInstances', run: () => client.get('/instance/fetchInstances') },
  ];

  if (defaultInstance) {
    checks.push(
      { name: `connectionState/${defaultInstance}`, run: () => client.get(`/instance/connectionState/${defaultInstance}`) },
      { name: `settings/find/${defaultInstance}`, run: () => client.get(`/settings/find/${defaultInstance}`) }
    );
  }

  let failures = 0;
  for (const check of checks) {
    try {
      const result = await check.run();
      const preview = JSON.stringify(result).slice(0, 150);
      console.log(`✅ ${check.name}: ${preview}`);
    } catch (err) {
      failures += 1;
      console.error(`❌ ${check.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${checks.length - failures}/${checks.length} checks passed.`);
  if (failures > 0) process.exit(1);
}

async function main(): Promise<void> {
  if (process.env.WHATSAPP_MODE === 'stdio' && process.env.EVOLUTION_BASE_URL) {
    await runLegacySmoke();
  } else {
    await runGatewaySmoke();
  }
}

main().catch((err) => {
  console.error('Smoke test fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
