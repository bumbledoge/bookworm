import { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../lib/errors';

/** Express 4 does not catch rejected promises; this forwards them to the error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

// Express identifies error middleware by its 4-argument signature.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.details ? { error: err.message, details: err.details } : { error: err.message });
    return;
  }
  // body-parser: malformed JSON / oversized payload
  const e = err as { type?: string; status?: number } | null;
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
