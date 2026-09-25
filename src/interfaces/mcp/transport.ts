import { Request, Response, NextFunction } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import crypto from 'node:crypto';

export function createMcpAuthMiddleware(requiredToken?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!requiredToken || !requiredToken.trim()) {
      // In development mode, allow unauthenticated access if no token is configured
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: Missing or invalid Authorization Bearer header' },
        id: null,
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    const tokenBuffer = Buffer.from(token);
    const requiredBuffer = Buffer.from(requiredToken);

    if (
      tokenBuffer.length !== requiredBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, requiredBuffer)
    ) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized: Invalid MCP_API_TOKEN' },
        id: null,
      });
      return;
    }

    next();
  };
}

export function setupMcpTransport(mcpServer: Server) {
  // Use stateless Streamable HTTP transport for maximum concurrency & clean reconnects
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  let isConnected = false;

  return async (req: Request, res: Response): Promise<void> => {
    if (!isConnected) {
      await mcpServer.connect(transport);
      isConnected = true;
    }

    await transport.handleRequest(req, res, req.body);
  };
}
