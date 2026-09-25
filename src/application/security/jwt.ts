import crypto from 'node:crypto';

export interface JwtPayload {
  sub: string;
  role: 'admin';
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/**
 * Signs a JWT payload using HMAC-SHA256.
 */
export function signJwt(payload: Record<string, unknown>, secret: string, expiresInSeconds: number = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest();

  const encodedSignature = base64UrlEncode(signature);
  return `${data}.${encodedSignature}`;
}

/**
 * Verifies a JWT token and returns the payload, or null if invalid/expired.
 */
export function verifyJwt<T = JwtPayload>(token: string, secret: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest();

    const actualSignature = Buffer.from(encodedSignature, 'base64url');

    // Constant-time comparison to prevent timing attacks
    if (expectedSignature.length !== actualSignature.length) return null;
    if (!crypto.timingSafeEqual(expectedSignature, actualSignature)) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as T & { exp?: number };
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
