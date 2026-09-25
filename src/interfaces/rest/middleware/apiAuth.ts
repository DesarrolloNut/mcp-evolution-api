import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { AdminAuthService } from '../../../application/services/adminAuth.js';

export function createApiAuthMiddleware(requiredToken?: string, adminAuthService?: AdminAuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    let providedToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else if (typeof apiKeyHeader === 'string') {
      providedToken = apiKeyHeader.trim();
    }

    // 1. If an Admin JWT token is provided (e.g. from the Web Panel), verify it
    if (providedToken && adminAuthService) {
      const adminPayload = adminAuthService.verifyToken(providedToken);
      if (adminPayload && adminPayload.role === 'admin') {
        req.adminUser = adminPayload;
        return next();
      }
    }

    // 2. If no MCP API token is configured, allow in development mode
    if (!requiredToken || !requiredToken.trim()) {
      return next();
    }

    // 3. If no token was provided at all
    if (!providedToken) {
      res.status(401).json({
        error: 'Unauthorized: Missing Authorization Bearer header or x-api-key header',
      });
      return;
    }

    // 4. Verify against MCP API token using timing-safe comparison
    const tokenBuffer = Buffer.from(providedToken);
    const requiredBuffer = Buffer.from(requiredToken);

    if (
      tokenBuffer.length !== requiredBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, requiredBuffer)
    ) {
      res.status(401).json({ error: 'Unauthorized: Invalid API token or expired session' });
      return;
    }

    next();
  };
}
