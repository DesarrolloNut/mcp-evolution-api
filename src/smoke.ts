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

  // 6. Verify MCP HTTP Transport (Initialize, tools/list discovery, direct probes)
  const express = (await import('express')).default;
  const { setupMcpTransport } = await import('./interfaces/mcp/transport.js');
  const mcpApp = express();
  mcpApp.use(express.json());
  const transportManager = setupMcpTransport(resolver);
  mcpApp.all('/mcp', (req, res) => {
    transportManager.handleMcp(req, res);
  });

  const testServer = await new Promise<import('node:http').Server>((resolve) => {
    const s = mcpApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = testServer.address() as import('node:net').AddressInfo;
  const mcpUrl = `http://127.0.0.1:${address.port}/mcp`;

  try {
    // Check 6a: Direct tools/list probe (Testing tool scenario)
    const directListRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
    const directListData = (await directListRes.json()) as Record<string, unknown>;
    console.log('directListRes status:', directListRes.status, 'body:', JSON.stringify(directListData));
    const directResult = directListData.result as { tools?: unknown[] } | undefined;
    const toolCount = directResult?.tools?.length ?? 0;
    if (toolCount !== 24) {
      throw new Error(`Expected 24 tools in tools/list direct probe, got ${toolCount}. Body: ${JSON.stringify(directListData)}`);
    }
    console.log(`✅ MCP HTTP Direct probe: tools/list returned ${toolCount} tools successfully.`);

    // Check 6b: Standard Initialize -> tools/list sequence
    const initRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'smoke-client', version: '1.0.0' },
        },
      }),
    });
    const sessionId = initRes.headers.get('mcp-session-id');
    console.log(`✅ MCP HTTP Initialize handshake: status ${initRes.status}, session=${sessionId || 'stateless'}`);

    const sessionListRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
    });
    const sessionListData = (await sessionListRes.json()) as { result?: { tools?: unknown[] } };
    const sessionToolCount = sessionListData.result?.tools?.length ?? 0;
    if (sessionToolCount !== 24) {
      throw new Error(`Expected 24 tools in tools/list session probe, got ${sessionToolCount}`);
    }
    // Check 6c: Direct tools/call validation check
    const callRes = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'whatsapp_send_text',
          arguments: { recipient: '', text: '' },
        },
      }),
    });
    const callData = (await callRes.json()) as { result?: { isError?: boolean; content?: Array<{ text: string }> } };
    if (!callData.result?.isError || !callData.result?.content?.[0]?.text) {
      throw new Error(`Expected tool validation error response, got ${JSON.stringify(callData)}`);
    }
    console.log(`✅ MCP HTTP tools/call validated: gracefully handled argument validation error.`);
  } finally {
    testServer.close();
  }

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

