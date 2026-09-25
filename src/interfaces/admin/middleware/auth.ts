import { Request, Response, NextFunction } from 'express';
import { AdminAuthService } from '../../../application/services/adminAuth.js';
import { JwtPayload } from '../../../application/security/jwt.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      adminUser?: JwtPayload;
    }
  }
}

export function createAdminAuthMiddleware(authService: AdminAuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7).trim();
    const payload = authService.verifyToken(token);

    if (!payload || payload.role !== 'admin') {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
      return;
    }

    req.adminUser = payload;
    next();
  };
}
