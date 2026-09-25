import { Request, Response, NextFunction } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import crypto from 'node:crypto';
import { ChannelResolver } from '../../application/services/channelResolver.js';
import { buildUnifiedRegistry } from './registry.js';
import { createUnifiedMcpServer, toInputSchema } from './server.js';
import { ZodError } from 'zod';
import { wrapUntrustedContent } from '../../application/security/promptInjection.js';

export function createMcpAuthMiddleware(requiredToken?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!requiredToken || !requiredToken.trim()) {
      // In development mode, allow unauthenticated access if no token is configured
      return next();
    }

    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (typeof req.query.token === 'string') {
      token = req.query.token.trim();
    } else if (typeof req.headers['x-api-key'] === 'string') {
      token = req.headers['x-api-key'].trim();
    }

    if (!token) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: Missing or invalid Authorization Bearer header or API token' },
        id: null,
      });
      return;
    }

    const tokenBuffer = Buffer.from(token);
    const requiredBuffer = Buffer.from(requiredToken.trim());

    if (
      tokenBuffer.length !== requiredBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, requiredBuffer)
    ) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: Invalid MCP API token' },
        id: null,
      });
      return;
    }

    next();
  };
}

export interface McpTransportManager {
  handleMcp: (req: Request, res: Response) => Promise<void>;
  handleSse: (req: Request, res: Response) => Promise<void>;
  handleMessages: (req: Request, res: Response) => Promise<void>;
}

export function setupMcpTransport(resolver: ChannelResolver): McpTransportManager {
  const registry = buildUnifiedRegistry();
  const transports = new Map<string, StreamableHTTPServerTransport | SSEServerTransport>();

  // Helper for direct JSON-RPC handling as fallback or direct tool discovery
  const handleDirectJsonRpc = async (req: Request, res: Response): Promise<boolean> => {
    const body = req.body;
    if (!body || typeof body !== 'object') return false;

    const method = body.method;
    const id = body.id !== undefined ? body.id : null;

    if (method === 'initialize') {
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'mcp-whatsapp', version: '2.0.0' },
        },
      });
      return true;
    }

    if (method === 'notifications/initialized') {
      res.status(204).end();
      return true;
    }

    if (method === 'ping') {
      res.json({ jsonrpc: '2.0', id, result: {} });
      return true;
    }

    if (method === 'tools/list') {
      const tools = registry.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: toInputSchema(t.inputSchema),
      }));
      res.json({
        jsonrpc: '2.0',
        id,
        result: { tools },
      });
      return true;
    }

    if (method === 'tools/call') {
      const toolName = body.params?.name;
      const rawArgs = body.params?.arguments ?? {};
      const tool = registry.byName.get(toolName);
      if (!tool) {
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
          },
        });
        return true;
      }

      try {
        const parsedArgs = tool.inputSchema.parse(rawArgs);
        const data = await tool.handler(resolver, parsedArgs);
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: wrapUntrustedContent(data, toolName) }],
          },
        });
        return true;
      } catch (err) {
        let message: string;
        if (err instanceof ZodError) {
          message = `Invalid arguments: ${err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`;
        } else if (err instanceof Error) {
          message = err.message;
        } else {
          message = String(err);
        }

        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: message }],
            isError: true,
          },
        });
        return true;
      }
    }

    return false;
  };

  const handleMcp = async (req: Request, res: Response): Promise<void> => {
    const rawAccept = (req.headers.accept || '').toLowerCase();
    const isSseStreamClient = rawAccept.includes('text/event-stream');
    const sessionId = (req.headers['mcp-session-id'] as string) || (req.query.sessionId as string);

    // 1. If an active session exists, route to that transport
    if (sessionId && transports.has(sessionId)) {
      const existing = transports.get(sessionId);
      if (existing instanceof StreamableHTTPServerTransport) {
        try {
          await existing.handleRequest(req, res, req.body);
          return;
        } catch (err) {
          console.error('[MCP Transport] Active session transport error:', err);
        }
      }
    }

    // 2. Handle POST requests
    if (req.method === 'POST') {
      // If client is a standard JSON-RPC HTTP client (e.g. testing probe, curl, Web UI manager),
      // serve directly for instant response & 100% compatibility across all MCP platforms
      if (!isSseStreamClient) {
        const handled = await handleDirectJsonRpc(req, res);
        if (handled) return;
      }

      const isInit =
        req.body &&
        (req.body.method === 'initialize' ||
          (Array.isArray(req.body) && req.body.some((m: { method?: string }) => m?.method === 'initialize')));

      if (isInit && !sessionId && isSseStreamClient) {
        // Stateful initialization for Streamable HTTP
        try {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            enableJsonResponse: true,
            onsessioninitialized: (sid) => {
              transports.set(sid, transport);
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid) transports.delete(sid);
          };

          const server = createUnifiedMcpServer(resolver);
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
          return;
        } catch (err) {
          console.error('[MCP Transport] Stateful init error, falling back to direct JSON-RPC:', err);
          if (!res.headersSent) {
            const handled = await handleDirectJsonRpc(req, res);
            if (handled) return;
          }
        }
      }

      // Stateless request for Streamable HTTP clients
      try {
        const statelessTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        const server = createUnifiedMcpServer(resolver);
        await server.connect(statelessTransport);
        await statelessTransport.handleRequest(req, res, req.body);

        res.on('close', () => {
          statelessTransport.close().catch(() => {});
          server.close().catch(() => {});
        });
        return;
      } catch (err) {
        console.error('[MCP Transport] Stateless error, fallback to direct JSON-RPC:', err);
        if (!res.headersSent) {
          const handled = await handleDirectJsonRpc(req, res);
          if (handled) return;

          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: (err as Error).message || 'Internal server error' },
            id: req.body?.id ?? null,
          });
        }
        return;
      }
    }

    // 3. Handle GET request (SSE Stream)
    if (req.method === 'GET') {
      try {
        const sseTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          enableJsonResponse: true,
        });
        const server = createUnifiedMcpServer(resolver);
        await server.connect(sseTransport);
        await sseTransport.handleRequest(req, res);
        return;
      } catch (err) {
        console.error('[MCP Transport] GET SSE error:', err);
        if (!res.headersSent) {
          res.status(405).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed or SSE stream failed' },
            id: null,
          });
        }
        return;
      }
    }

    // 4. Handle DELETE request (Session termination)
    if (req.method === 'DELETE') {
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId);
        transports.delete(sessionId);
        if (transport) await transport.close();
      }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' },
      id: null,
    });
  };

  const handleSse = async (_req: Request, res: Response): Promise<void> => {
    try {
      const transport = new SSEServerTransport('/messages', res);
      transports.set(transport.sessionId, transport);
      res.on('close', () => {
        transports.delete(transport.sessionId);
      });
      const server = createUnifiedMcpServer(resolver);
      await server.connect(transport);
    } catch (err) {
      console.error('[MCP SSE] Error establishing SSE transport:', err);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE transport');
      }
    }
  };

  const handleMessages = async (req: Request, res: Response): Promise<void> => {
    const sessionId = (req.query.sessionId as string) || (req.headers['mcp-session-id'] as string);
    if (!sessionId) {
      const handled = await handleDirectJsonRpc(req, res);
      if (handled) return;
      res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Missing sessionId parameter' }, id: null });
      return;
    }

    const transport = transports.get(sessionId);
    if (transport instanceof SSEServerTransport) {
      await transport.handlePostMessage(req, res, req.body);
      return;
    }

    const handled = await handleDirectJsonRpc(req, res);
    if (handled) return;

    res.status(404).json({ jsonrpc: '2.0', error: { code: -32000, message: `Session not found: ${sessionId}` }, id: null });
  };

  return {
    handleMcp,
    handleSse,
    handleMessages,
  };
}
