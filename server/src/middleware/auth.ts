import { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { Role, verifyToken } from '../lib/token';

/** Identity attached to a request by `authenticateJwt` / `optionalAuth`. */
export interface AuthContext {
  /** Set for registered accounts. */
  userId?: string;
  /** Set for guest sessions. */
  guestId?: string;
  role: Role;
  isGuest: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Decodes the bearer token; returns null when absent, throws when invalid. */
function decode(req: Request): AuthContext | null {
  const token = bearerToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  const isGuest = payload.role === 'GUEST' || payload.guest === true;
  return isGuest
    ? { guestId: payload.sub, role: 'GUEST', isGuest: true }
    : { userId: payload.sub, role: payload.role, isGuest: false };
}

/** Requires a valid guest or registered token. */
export const authenticateJwt: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  let ctx: AuthContext | null;
  try {
    ctx = decode(req);
  } catch {
    return next(unauthorized('Invalid or expired token'));
  }
  if (!ctx) return next(unauthorized('Authentication required'));
  req.auth = ctx;
  next();
};

/** Attaches identity when a valid token is supplied; otherwise continues anonymously. */
export const optionalAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const ctx = decode(req);
    if (ctx) req.auth = ctx;
  } catch {
    // An invalid token on an optional route is treated as "not signed in".
  }
  next();
};

/** Use after `authenticateJwt`: rejects guest sessions. */
export const requireRegistered: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) return next(unauthorized());
  if (req.auth.isGuest || !req.auth.userId) {
    return next(forbidden('This action requires a registered account'));
  }
  next();
};

/** Typed accessor for handlers mounted behind `authenticateJwt`. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

/** Typed accessor for handlers mounted behind `authenticateJwt` + `requireRegistered`. */
export function getUserId(req: Request): string {
  const auth = getAuth(req);
  if (!auth.userId) throw forbidden('This action requires a registered account');
  return auth.userId;
}
