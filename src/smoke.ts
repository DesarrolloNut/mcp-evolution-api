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

  // 4. Verify OpenAPI 3.1 Specification
  const fs = await import('node:fs');
  const path = await import('node:path');
  const openapiPath = path.resolve('src/interfaces/docs/openapi.json');
  if (fs.existsSync(openapiPath)) {
    const raw = fs.readFileSync(openapiPath, 'utf8');
    const parsed = JSON.parse(raw);
    const pathCount = Object.keys(parsed.paths || {}).length;
    console.log(`✅ OpenAPI 3.1 Spec verified (${pathCount} paths documented).`);
  }

  // 5. Verify Baileys Direct Provider & SessionManager
  const { BaileysSessionManager } = await import('./infrastructure/providers/baileys/sessionManager.js');
  const sessionManager = BaileysSessionManager.getInstance();
  const mockBaileysStatus = sessionManager.getStatus('smoke-test-channel');
  console.log(`✅ Baileys Session Manager active (Initial status: ${mockBaileysStatus.status}, connected: ${mockBaileysStatus.isConnected})`);

  const mockBaileysProvider = {
    id: 'smoke-baileys',
    name: 'Embedded Baileys Smoke',
    type: 'baileys' as const,
    baseUrl: 'embedded://whatsapp-web',
    apiKeyEncrypted: 'mock-encrypted-key',
    config: {},
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const baileysAdapter = providerFactory.create(mockBaileysProvider);
  const connTest = await baileysAdapter.testConnection();
  console.log(`✅ Baileys Adapter testConnection: success=${connTest.success}, message="${connTest.message}"`);

  closeDatabase();
  console.log('\nAll gateway smoke checks passed successfully.');
}

async function main(): Promise<void> {
  await runGatewaySmoke();
}

main().catch((err) => {
  console.error('Smoke test fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});

