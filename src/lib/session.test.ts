import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/errors';
import type { AuthenticatedUser } from '@/types/domain';

import { resolveSessionStatus } from './session';

const user = { id: 'u1' } as AuthenticatedUser;

describe('resolveSessionStatus', () => {
  it('is authenticated whenever a user resolved, even if the refetch failed', () => {
    expect(resolveSessionStatus(user, new Error('offline'))).toBe('authenticated');
  });

  it('treats a settled check with no user as signed out', () => {
    expect(resolveSessionStatus(null, undefined)).toBe('signed-out');
  });

  it('reads a 401 as the server refusing the session', () => {
    const err = new ApiError({ statusCode: 401, code: 'AUTH_TOKEN_EXPIRED', message: 'x' });
    expect(resolveSessionStatus(null, err)).toBe('signed-out');
  });

  /**
   * The case a hosted user feels as "refreshing logs me out": the tab reloads
   * while the network or the API hiccups, and that must not be reported as a
   * sign-out, because the refresh cookie is still there to restore the session.
   */
  it('keeps the session when the server simply could not be reached', () => {
    expect(resolveSessionStatus(null, new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'x' }))).toBe(
      'unresolved',
    );
    expect(
      resolveSessionStatus(
        null,
        new ApiError({ statusCode: 503, code: 'UNKNOWN_ERROR', message: 'x' }),
      ),
    ).toBe('unresolved');
    expect(resolveSessionStatus(null, new TypeError('Failed to fetch'))).toBe('unresolved');
  });

  it('accepts a non-auth 4xx as an answer about the request', () => {
    expect(
      resolveSessionStatus(null, new ApiError({ statusCode: 403, code: 'BUSINESS_ACCESS_DENIED', message: 'x' })),
    ).toBe('signed-out');
  });
});
