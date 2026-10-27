// Tiny request-validation helpers. Each helper pushes a human-readable message
// onto `errors` instead of throwing, so a parser can report every problem at once.
// `validateBody` (middleware/validate.ts) turns a non-empty `errors` list into a 400.

export type Errors = string[];
type Source = Record<string, unknown>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function asObject(body: unknown): Source {
  return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Source) : {};
}

interface StringOpts {
  min?: number;
  max?: number;
}

function checkLength(value: string, key: string, errors: Errors, opts: StringOpts) {
  if (opts.min !== undefined && value.length < opts.min) {
    errors.push(`${key} must be at least ${opts.min} characters`);
  }
  if (opts.max !== undefined && value.length > opts.max) {
    errors.push(`${key} must be at most ${opts.max} characters`);
  }
}

export function reqString(src: Source, key: string, errors: Errors, opts: StringOpts = {}): string {
  const v = src[key];
  if (typeof v !== 'string' || v.trim() === '') {
    errors.push(`${key} is required`);
    return '';
  }
  const trimmed = v.trim();
  checkLength(trimmed, key, errors, opts);
  return trimmed;
}

/** Optional string: undefined / null / '' => undefined. Non-strings are rejected. */
export function optString(src: Source, key: string, errors: Errors, opts: StringOpts = {}): string | undefined {
  const v = src[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') {
    errors.push(`${key} must be a string`);
    return undefined;
  }
  const trimmed = v.trim();
  if (trimmed === '') return undefined;
  checkLength(trimmed, key, errors, opts);
  return trimmed;
}

export function reqEmail(src: Source, key: string, errors: Errors): string {
  const v = reqString(src, key, errors);
  if (v && !EMAIL_RE.test(v)) errors.push(`${key} must be a valid email address`);
  return v.toLowerCase();
}

interface IntOpts {
  min?: number;
  max?: number;
}

export function optInt(src: Source, key: string, errors: Errors, opts: IntOpts = {}): number | undefined {
  const v = src[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    errors.push(`${key} must be an integer`);
    return undefined;
  }
  if (opts.min !== undefined && v < opts.min) errors.push(`${key} must be at least ${opts.min}`);
  if (opts.max !== undefined && v > opts.max) errors.push(`${key} must be at most ${opts.max}`);
  return v;
}

export function reqInt(src: Source, key: string, errors: Errors, opts: IntOpts = {}): number {
  if (src[key] === undefined || src[key] === null) {
    errors.push(`${key} is required`);
    return 0;
  }
  return optInt(src, key, errors, opts) ?? 0;
}

export function optBool(src: Source, key: string, errors: Errors): boolean | undefined {
  const v = src[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') {
    errors.push(`${key} must be a boolean`);
    return undefined;
  }
  return v;
}

export function reqNumber(src: Source, key: string, errors: Errors, opts: { min?: number } = {}): number {
  const v = src[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${key} is required and must be a number`);
    return 0;
  }
  if (opts.min !== undefined && v < opts.min) errors.push(`${key} must be at least ${opts.min}`);
  return v;
}

export function oneOf<T extends string>(
  src: Source,
  key: string,
  allowed: readonly T[],
  errors: Errors,
  opts: { required?: boolean } = {}
): T | undefined {
  const v = src[key];
  if (v === undefined || v === null || v === '') {
    if (opts.required) errors.push(`${key} is required`);
    return undefined;
  }
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    errors.push(`${key} must be one of: ${allowed.join(', ')}`);
    return undefined;
  }
  return v as T;
}

// ------------------------------------------------------------------ query string

export function queryString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t === '' ? undefined : t;
}

export function queryNumber(v: unknown, key: string, errors: Errors): number | undefined {
  const s = queryString(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) {
    errors.push(`${key} must be a number`);
    return undefined;
  }
  return n;
}

export function queryBool(v: unknown): boolean | undefined {
  const s = queryString(v);
  if (s === undefined) return undefined;
  return s === 'true' || s === '1';
}

/** Lenient pagination: out-of-range values are clamped rather than rejected. */
export function queryInt(v: unknown, fallback: number, min: number, max: number): number {
  const s = queryString(v);
  const n = s === undefined ? NaN : Math.floor(Number(s));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parsePagination(q: { page?: unknown; pageSize?: unknown }, defaultSize = 12) {
  const page = queryInt(q.page, 1, 1, 1_000_000);
  const pageSize = queryInt(q.pageSize, defaultSize, 1, 50);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
