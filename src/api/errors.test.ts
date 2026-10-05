import { describe, expect, it } from 'vitest';

import { normalizeApiError, toApiError, ApiError } from './errors';

describe('normalizeApiError', () => {
  it('parses the doc 04 §7 error body', () => {
    const err = normalizeApiError(400, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors: [{ field: 'email', message: 'email must be a valid email address' }],
      timestamp: '2026-10-05T08:30:00.000Z',
      path: '/api/v1/auth/register',
    });

    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Validation failed');
    expect(err.isValidationError).toBe(true);
    expect(err.fieldError('email')).toBe('email must be a valid email address');
    expect(err.fieldError('missing')).toBeUndefined();
    expect(err.path).toBe('/api/v1/auth/register');
  });

  it('accepts the doc 02 §37 `error` key as the code', () => {
    const err = normalizeApiError(422, {
      success: false,
      message: 'Insufficient fuel inventory',
      error: 'INSUFFICIENT_INVENTORY',
    });

    expect(err.code).toBe('INSUFFICIENT_INVENTORY');
    expect(err.message).toBe('Insufficient fuel inventory');
  });

  it('falls back to a human message when the code is unknown', () => {
    const err = normalizeApiError(422, { code: 'SOMETHING_NEW', message: '' });
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.message).toBeTruthy();
  });

  it('never surfaces a stack trace to the user', () => {
    const err = normalizeApiError(500, {
      code: 'UNKNOWN_ERROR',
      message: 'Error: boom\n    at Object.<anonymous> (/app/src/x.ts:1:1)',
    });

    expect(err.message).not.toContain('at Object');
    expect(err.message).toBe('The server is having trouble. Please try again shortly.');
  });

  it('maps statuses to useful copy when there is no body', () => {
    expect(normalizeApiError(404, null).message).toMatch(/could not find/i);
    expect(normalizeApiError(403, null).message).toMatch(/permission/i);
    expect(normalizeApiError(429, null).message).toMatch(/too many requests/i);
  });

  it('keeps the documented INVALID_CREDENTIALS copy (doc 06 §40)', () => {
    const err = normalizeApiError(401, { code: 'AUTH_INVALID_CREDENTIALS' });
    expect(err.message).toBe('Invalid email or password.');
  });
});

describe('ApiError classification', () => {
  it('treats 401 as unauthorized', () => {
    expect(
      new ApiError({ statusCode: 401, code: 'AUTH_TOKEN_EXPIRED', message: 'x' }).isUnauthorized,
    ).toBe(true);
  });

  it('treats 404 as not found (doc 06 §41 — tenant isolation may mask 403)', () => {
    expect(new ApiError({ statusCode: 404, code: 'UNKNOWN_ERROR', message: 'x' }).isNotFound).toBe(
      true,
    );
  });

  it('recognises duplicates by code or 409', () => {
    expect(
      new ApiError({ statusCode: 422, code: 'DUPLICATE_REQUEST', message: 'x' }).isConflict,
    ).toBe(true);
    expect(new ApiError({ statusCode: 409, code: 'UNKNOWN_ERROR', message: 'x' }).isConflict).toBe(
      true,
    );
  });
});

describe('toApiError', () => {
  it('converts an AbortError into a cancelled ApiError', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const err = toApiError(abort);
    expect(err.isCanceled).toBe(true);
  });

  it('converts a network TypeError into NETWORK_ERROR', () => {
    const err = toApiError(new TypeError('Failed to fetch'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.message).toMatch(/unable to reach/i);
  });

  it('passes an existing ApiError through unchanged', () => {
    const original = new ApiError({ statusCode: 400, code: 'VALIDATION_ERROR', message: 'x' });
    expect(toApiError(original)).toBe(original);
  });
});
