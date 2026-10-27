import jwt, { SignOptions } from 'jsonwebtoken';

export type Role = 'GUEST' | 'CUSTOMER' | 'ADMIN';

export interface TokenPayload {
  /** User id for registered accounts, guest session id for guests. */
  sub: string;
  role: Role;
  guest?: boolean;
}

const ROLES: readonly string[] = ['GUEST', 'CUSTOMER', 'ADMIN'];

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  return 'dev-insecure-secret';
}

export function signToken(payload: TokenPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret(), { expiresIn });
}

/** Throws if the token is malformed, expired or has an unexpected shape. */
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, secret());
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.role !== 'string' ||
    !ROLES.includes(decoded.role)
  ) {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub, role: decoded.role as Role, guest: decoded.guest === true };
}
