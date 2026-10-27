import { RequestHandler } from 'express';
import { badRequest } from '../lib/errors';
import { asObject, Errors } from '../lib/validation';

/**
 * Validates and normalises `req.body`.
 *
 * `parse` receives the body as a plain object (never undefined) and pushes any
 * problems onto `errors`. On success `req.body` is replaced by the parsed value,
 * so controllers only ever see validated, trimmed data.
 */
export function validateBody<T>(parse: (body: Record<string, unknown>, errors: Errors) => T): RequestHandler {
  return (req, _res, next) => {
    const errors: Errors = [];
    const parsed = parse(asObject(req.body), errors);
    if (errors.length > 0) return next(badRequest('Validation failed', errors));
    req.body = parsed;
    next();
  };
}
