import { Router, Request, Response } from 'express';
import { AdminAuthService } from '../../../application/services/adminAuth.js';

export function createAuthRouter(authService: AdminAuthService): Router {
  const router = Router();

  router.post('/login', (req: Request, res: Response): void => {
    const { username, password } = req.body || {};

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const result = authService.login(username, password);
    if (!result) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    res.json(result);
  });

  return router;
}
