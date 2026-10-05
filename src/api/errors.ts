/**
 * Normalized error handling.
 *
 * doc 04 §7 defines the error body:
 *   { statusCode, code, message, errors: [{ field, message }], timestamp, path }
 *
 * doc 02 §37 defines a conflicting shape: { success, message, error }.
 * We normalise both into a single `ApiError`.
 */

import type { ApiFieldError } from '@/types/domain';

/** doc 04 §9 — application error codes. */
export const API_ERROR_CODES = [
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_REFRESH_TOKEN_INVALID',
  'AUTH_ACCOUNT_INACTIVE',
  'VALIDATION_ERROR',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_ALREADY_EXISTS',
  'BUSINESS_ACCESS_DENIED',
  'BRANCH_ACCESS_DENIED',
  'INSUFFICIENT_INVENTORY',
  'INVALID_FUEL_PRICE',
  'INVALID_DELIVERY_QUANTITY',
  'INVALID_ORDER_STATUS',
  'INVALID_DELIVERY_STATUS',
  'INVALID_REPORT_STATUS',
  'REPORT_ALREADY_EXISTS',
  'REPORT_NOT_SUBMITTABLE',
  'REPORT_NOT_APPROVABLE',
  'DUPLICATE_REQUEST',
  'INVALID_OPERATION',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: ApiFieldError[];
  readonly path: string | undefined;
  /** Set when the failure was an aborted request. */
  readonly isCanceled: boolean;

  constructor(init: {
    statusCode: number;
    code: ApiErrorCode;
    message: string;
    fieldErrors?: ApiFieldError[];
    path?: string;
    isCanceled?: boolean;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.statusCode = init.statusCode;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? [];
    this.path = init.path;
    this.isCanceled = init.isCanceled ?? false;
  }

  /** doc 04 §8 — 401 means authentication failed. */
  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /**
   * doc 06 §41 — tenant-isolated resources may return 404 instead of 403 to
   * avoid revealing another tenant's records. So a 404 does not imply "missing".
   */
  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /** doc 04 §103 — duplicate submissions are rejected with this code. */
  get isConflict(): boolean {
    return this.code === 'DUPLICATE_REQUEST' || this.statusCode === 409;
  }

  get isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR' || this.statusCode === 422;
  }

  /** Field-level message lookup, for form integration. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors.find((e) => e.field === field)?.message;
  }
}

/**
 * Human-facing fallbacks, used when the server sends no usable message.
 * doc 06 §40 prescribes avoiding messages that leak account existence.
 */
const CODE_FALLBACKS: Partial<Record<ApiErrorCode, string>> = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_REFRESH_TOKEN_INVALID: 'Your session has expired. Please sign in again.',
  AUTH_ACCOUNT_INACTIVE: 'This account is not active. Contact your administrator.',
  RESOURCE_NOT_FOUND: 'We could not find what you were looking for.',
  RESOURCE_ALREADY_EXISTS: 'That record already exists.',
  BUSINESS_ACCESS_DENIED: 'You do not have access to this business.',
  BRANCH_ACCESS_DENIED: 'You do not have access to this branch.',
  INSUFFICIENT_INVENTORY: 'There is not enough inventory available.',
  INVALID_FUEL_PRICE: 'This price overlaps an existing price period.',
  INVALID_DELIVERY_QUANTITY: 'The delivery quantity is not valid.',
  INVALID_ORDER_STATUS: 'This order cannot move to that status.',
  INVALID_DELIVERY_STATUS: 'This delivery cannot move to that status.',
  INVALID_REPORT_STATUS: 'This report cannot move to that status.',
  REPORT_ALREADY_EXISTS: 'A report already exists for this branch and date.',
  REPORT_NOT_SUBMITTABLE: 'This report cannot be submitted in its current state.',
  REPORT_NOT_APPROVABLE: 'This report cannot be approved in its current state.',
  DUPLICATE_REQUEST: 'That request was already processed.',
  INVALID_OPERATION: 'That operation is not allowed right now.',
  NETWORK_ERROR: 'Unable to reach the server. Check your connection and try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

/** doc 06 §41 — copy for common statuses when no code/message is supplied. */
function statusFallback(statusCode: number): string {
  if (statusCode === 401) return 'Please sign in to continue.';
  if (statusCode === 403) return 'You do not have permission to do that.';
  if (statusCode === 404) return 'We could not find what you were looking for.';
  if (statusCode === 409) return 'That record already exists.';
  if (statusCode === 429) return 'Too many requests. Please wait and try again.';
  if (statusCode >= 500) return 'The server is having trouble. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

function isFieldErrors(value: unknown): value is ApiFieldError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (e) => typeof e === 'object' && e !== null && typeof (e as ApiFieldError).field === 'string',
    )
  );
}

/**
 * Build an `ApiError` from an arbitrary parsed response body.
 * Tolerates both the doc 04 and doc 02 shapes.
 */
export function normalizeApiError(statusCode: number, body: unknown, path?: string): ApiError {
  if (typeof body !== 'object' || body === null) {
    return new ApiError({
      statusCode,
      code: 'UNKNOWN_ERROR',
      message: statusFallback(statusCode),
      path,
    });
  }

  const raw = body as Record<string, unknown>;

  // `code` per doc 04 §7, `error` per doc 02 §37.
  const rawCode =
    typeof raw.code === 'string' ? raw.code : typeof raw.error === 'string' ? raw.error : '';
  const isKnownCode = (API_ERROR_CODES as readonly string[]).includes(rawCode);
  const code = isKnownCode ? (rawCode as ApiErrorCode) : 'UNKNOWN_ERROR';

  // Never surface a stack trace (PROMPT.md §20).
  const rawMessage = typeof raw.message === 'string' ? raw.message.trim() : '';
  const looksLikeStackTrace = /^\s*at\s/m.test(rawMessage);
  const message =
    rawMessage && !looksLikeStackTrace
      ? rawMessage
      : // A documented code has specific copy; otherwise the HTTP status is the
        // better guide than a generic "something went wrong".
        ((isKnownCode ? CODE_FALLBACKS[rawCode as ApiErrorCode] : undefined) ??
        statusFallback(statusCode));

  return new ApiError({
    statusCode: typeof raw.statusCode === 'number' ? raw.statusCode : statusCode,
    code,
    message,
    fieldErrors: isFieldErrors(raw.errors) ? raw.errors : [],
    path: typeof raw.path === 'string' ? raw.path : path,
  });
}

/** Convert a thrown value (TypeError from fetch, AbortError, etc.) into ApiError. */
export function toApiError(err: unknown, path?: string): ApiError {
  if (err instanceof ApiError) return err;

  if (typeof err === 'object' && err !== null && 'name' in err) {
    const name = (err as { name?: unknown }).name;
    if (name === 'AbortError') {
      return new ApiError({
        statusCode: 0,
        code: 'UNKNOWN_ERROR',
        message: 'Request cancelled.',
        path,
        isCanceled: true,
      });
    }
  }

  return new ApiError({
    statusCode: 0,
    code: 'NETWORK_ERROR',
    message: CODE_FALLBACKS.NETWORK_ERROR!,
    path,
  });
}

/** Narrow an unknown value to ApiError (useful in catch blocks and tests). */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
