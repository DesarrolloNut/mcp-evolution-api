#!/usr/bin/env node
/**
 * MCP WhatsApp Gateway Server.
 * Supports unified HTTP server mode (MCP SSE, Admin REST API, Web Panel)
 * and legacy stdio mode for backward compatibility.
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { loadGatewayConfig, loadConfig } from './config.js';
import { getDatabase } from './infrastructure/database/connection.js';
import { runMigrations } from './infrastructure/database/migrations.js';
import { SqliteProviderRepository } from './infrastructure/database/repositories/providerRepo.js';
import { SqliteChannelRepository } from './infrastructure/database/repositories/channelRepo.js';
import { ProviderFactory } from './application/services/providerFactory.js';
import { ChannelResolver } from './application/services/channelResolver.js';
import { AdminAuthService } from './application/services/adminAuth.js';
import { createUnifiedMcpServer } from './interfaces/mcp/server.js';
import { createMcpAuthMiddleware, setupMcpTransport } from './interfaces/mcp/transport.js';
import { createAdminRouter } from './interfaces/admin/router.js';
import { wrapUntrustedContent } from './application/security/promptInjection.js';

// Legacy direct client & registry imports for stdio mode
import { EvolutionClient } from './client.js';
import { buildRegistry } from './registry.js';

const PKG_NAME = 'mcp-whatsapp';
const PKG_VERSION = '2.0.0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServerMode(): Promise<void> {
  const config = loadGatewayConfig();

  // Warn if using default administrative credentials
  if (config.adminUsername === 'admin' && config.adminPassword === 'admin') {
    console.error(
      `[SECURITY WARNING] Using default administrative credentials (admin:admin). ` +
        `Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables for production security.`
    );
  }

  // 1. Initialize SQLite Database & execute migrations
  const db = getDatabase(config.sqlitePath);
  runMigrations(db);

  // 2. Initialize Repositories and Domain Services
  const providerRepo = new SqliteProviderRepository(db, config.encryptionKey);
  const channelRepo = new SqliteChannelRepository(db);
  const providerFactory = new ProviderFactory(config.encryptionKey);
  const channelResolver = new ChannelResolver(channelRepo, providerRepo, providerFactory);
  const adminAuthService = new AdminAuthService(config);

  // 3. Initialize MCP Server
  const mcpServer = createUnifiedMcpServer(channelResolver);
  const mcpTransportHandler = setupMcpTransport(mcpServer);
  const mcpAuthMiddleware = createMcpAuthMiddleware(config.mcpApiToken);

  // 4. Initialize Express HTTP Application
  const app = express();

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.use(express.json());

  // Static Admin Panel
  // When running compiled from dist/, panel files are in src/ or dist/
  const panelPath = path.resolve(__dirname, 'interfaces/web/panel');
  app.use('/panel', express.static(panelPath));

  // Root redirect to panel
  app.get('/', (_req, res) => {
    res.redirect('/panel');
  });

  // Admin REST API
  app.use(
    '/api/admin',
    createAdminRouter({
      authService: adminAuthService,
      providerRepo,
      channelRepo,
      providerFactory,
    })
  );

  // MCP Protocol Endpoints (Streamable HTTP / SSE)
  app.all('/mcp', mcpAuthMiddleware, (req, res) => {
    mcpTransportHandler(req, res);
  });

  // Start HTTP Server
  app.listen(config.httpPort, config.httpHost, () => {
    console.error(`[${PKG_NAME} v${PKG_VERSION}] HTTP gateway active on http://${config.httpHost}:${config.httpPort}`);
    console.error(`  - MCP Endpoint:  http://${config.httpHost}:${config.httpPort}/mcp`);
    console.error(`  - Admin Panel:   http://${config.httpHost}:${config.httpPort}/panel`);
    console.error(`  - Database:      ${config.sqlitePath} (WAL mode)`);
  });
}

async function startStdioLegacyMode(): Promise<void> {
  const config = loadConfig();
  const client = new EvolutionClient(config);
  const registry = buildRegistry(config);

  console.error(
    `[${PKG_NAME} v${PKG_VERSION}] stdio legacy mode: ${registry.tools.length} tools from groups: ${registry.enabledGroups.join(', ')}`
  );

  const server = new Server(
    { name: PKG_NAME, version: PKG_VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = registry.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Tool['inputSchema'],
    }));
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const tool = registry.byName.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const args = tool.inputSchema.parse(rawArgs ?? {});
      const data = await tool.handler(client, args as Record<string, unknown>);
      return {
        content: [{ type: 'text', text: wrapUntrustedContent(data, name) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${PKG_NAME}] ready (stdio)`);
}

async function main(): Promise<void> {
  const mode = process.env.WHATSAPP_MODE?.trim().toLowerCase();
  if (mode === 'stdio') {
    await startStdioLegacyMode();
  } else {
    await startServerMode();
  }
}

main().catch((err) => {
  console.error(`[${PKG_NAME}] fatal:`, err instanceof Error ? err.message : err);
  process.exit(1);
});
