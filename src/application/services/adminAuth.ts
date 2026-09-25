import crypto from 'node:crypto';
import { signJwt, verifyJwt, JwtPayload } from '../security/jwt.js';
import { GatewayConfig } from '../../config.js';

export interface AdminUser {
  username: string;
  role: 'admin';
}

export interface LoginResult {
  token: string;
  user: AdminUser;
}

export class AdminAuthService {
  constructor(private readonly config: GatewayConfig) {}

  login(username: string, password: string): LoginResult | null {
    const configUser = this.config.adminUsername;
    const configPass = this.config.adminPassword;

    const userBuf = Buffer.from(username);
    const passBuf = Buffer.from(password);
    const expectedUserBuf = Buffer.from(configUser);
    const expectedPassBuf = Buffer.from(configPass);

    const userMatches =
      userBuf.length === expectedUserBuf.length &&
      crypto.timingSafeEqual(userBuf, expectedUserBuf);

    const passMatches =
      passBuf.length === expectedPassBuf.length &&
      crypto.timingSafeEqual(passBuf, expectedPassBuf);

    if (!userMatches || !passMatches) {
      return null;
    }

    const payload = {
      sub: configUser,
      role: 'admin' as const,
    };

    const token = signJwt(payload, this.config.adminJwtSecret, 86400 * 7); // 7 days expiration

    return {
      token,
      user: {
        username: configUser,
        role: 'admin',
      },
    };
  }

  verifyToken(token: string): JwtPayload | null {
    return verifyJwt<JwtPayload>(token, this.config.adminJwtSecret);
  }
}
