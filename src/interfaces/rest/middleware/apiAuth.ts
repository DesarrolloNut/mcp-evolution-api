import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export function createApiAuthMiddleware(requiredToken?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!requiredToken || !requiredToken.trim()) {
      // In development mode, allow unauthenticated access if no token is configured
      return next();
    }

    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    let providedToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.slice(7).trim();
    } else if (typeof apiKeyHeader === 'string') {
      providedToken = apiKeyHeader.trim();
    }

    if (!providedToken) {
      res.status(401).json({
        error: 'Unauthorized: Missing Authorization Bearer header or x-api-key header',
      });
      return;
    }

    const tokenBuffer = Buffer.from(providedToken);
    const requiredBuffer = Buffer.from(requiredToken);

    if (
      tokenBuffer.length !== requiredBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, requiredBuffer)
    ) {
      res.status(401).json({ error: 'Unauthorized: Invalid API token' });
      return;
    }

    next();
  };
}
