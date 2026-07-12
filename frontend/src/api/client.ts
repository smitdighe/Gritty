import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { GrittyApiError, CLIENT_ERROR_CODES } from './GrittyApiError';
import { isGrittyApiErrorBody } from './schemas/error.schema';
import { API_BASE_URL, API_KEY } from '@/lib/env';

const DEFAULT_TIMEOUT_MS = 10_000;

/** Marker so the retry interceptor doesn't loop forever. */
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/**
 * True when an axios error is a transport failure (no HTTP response received):
 * network down, DNS/CORS block, or timeout. A 4xx/5xx has `err.response` and is
 * NOT retried.
 */
function isNetworkFailure(err: AxiosError): boolean {
  return !err.response;
}

function isTimeout(err: AxiosError): boolean {
  return err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
}

/** Convert an axios error into a typed GrittyApiError. */
function toGrittyApiError(err: AxiosError): GrittyApiError {
  // Transport failure: no response body to validate.
  if (isNetworkFailure(err)) {
    if (isTimeout(err)) {
      return new GrittyApiError(
        `request timed out after ${err.config?.timeout ?? DEFAULT_TIMEOUT_MS}ms`,
        CLIENT_ERROR_CODES.Timeout,
        { isNetworkError: true, cause: err },
      );
    }
    return new GrittyApiError(
      err.message || 'network request failed (connection refused, DNS, or CORS)',
      CLIENT_ERROR_CODES.Network,
      { isNetworkError: true, cause: err },
    );
  }

  const response = err.response!;
  const body: unknown = response.data;

  // Recognized typed backend error → surface code + message verbatim.
  if (isGrittyApiErrorBody(body)) {
    return new GrittyApiError(body.error.message, body.error.code, {
      status: response.status,
      cause: err,
    });
  }

  // A 4xx/5xx with an unexpected body shape: keep the status, don't fabricate a code.
  const message =
    typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string'
      ? body.message
      : `request failed with status ${response.status}`;
  return new GrittyApiError(message, CLIENT_ERROR_CODES.Unknown, {
    status: response.status,
    cause: err,
  });
}

/** Build a configured axios instance with the Gritty interceptors installed. */
export function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    },
  });

  instance.interceptors.response.use(
    (res: AxiosResponse) => res,
    async (err: unknown) => {
      if (!axios.isAxiosError(err)) {
        return Promise.reject(
          new GrittyApiError(
            err instanceof Error ? err.message : 'unknown error',
            CLIENT_ERROR_CODES.Unknown,
            { cause: err },
          ),
        );
      }

      // Single retry, network failures only (never on a 4xx/5xx).
      const config = err.config as RetryableConfig | undefined;
      if (config && !config._retried && isNetworkFailure(err) && !isTimeout(err)) {
        config._retried = true;
        return instance.request(config);
      }

      return Promise.reject(toGrittyApiError(err));
    },
  );

  return instance;
}

/** Shared singleton client. */
export const apiClient = createClient();
