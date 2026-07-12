import type { GrittyErrorCode } from '@/types/domain';

/**
 * Frontend mirror of the backend's typed GrittyError. Thrown by the axios
 * response interceptor for any 4xx/5xx whose body matches the
 * `{ error: { code, message } }` contract, so callers can branch on `.code`
 * (NotARepo / BadObject / RefNotFound / UsageError / …) instead of parsing
 * HTTP status or message text.
 */
export class GrittyApiError extends Error {
  readonly code: GrittyErrorCode;
  /** HTTP status, when the error came from a response (undefined for network/timeout). */
  readonly status?: number;
  /** True when there was no response at all (network down, timeout, CORS block). */
  readonly isNetworkError: boolean;

  constructor(
    message: string,
    code: GrittyErrorCode,
    opts: { status?: number; isNetworkError?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'GrittyApiError';
    this.code = code;
    this.status = opts.status;
    this.isNetworkError = opts.isNetworkError ?? false;
    if (opts.cause !== undefined) this.cause = opts.cause;
    Object.setPrototypeOf(this, GrittyApiError.prototype);
  }

  /** True for a recognized backend error code. */
  is(code: GrittyErrorCode): boolean {
    return this.code === code;
  }
}

/** Codes this layer synthesizes when the backend didn't supply one. */
export const CLIENT_ERROR_CODES = {
  Network: 'NetworkError',
  Timeout: 'TimeoutError',
  Unknown: 'UnknownError',
} as const;
