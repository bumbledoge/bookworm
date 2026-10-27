/** Error carrying an HTTP status; rendered as `{ error, details? }` by the error middleware. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[]
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: string[]) => new HttpError(400, message, details);
export const unauthorized = (message = 'Authentication required') => new HttpError(401, message);
export const paymentRequired = (message: string) => new HttpError(402, message);
export const forbidden = (message = 'You are not allowed to perform this action') => new HttpError(403, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
