import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { configureApiClient, getAccessToken, resetApiClientForTests, setAccessToken } from './client';
import { getCurrentUser, login, loginSchema } from './auth.api';
import { BUSINESS_ID, BRANCHES, USERS } from '@/mocks/data';
import { server } from '@/mocks/server';

const API = '/api/v1';

describe('loginSchema', () => {
  it('lowercases and trims the email (doc 03 §23)', () => {
    const parsed = loginSchema.parse({ email: '  Admin@KBYGlobal.com ', password: 'x' });
    expect(parsed.email).toBe('admin@kbyglobal.com');
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('login', () => {
  it('returns the session for valid credentials', async () => {
    resetApiClientForTests();
    const session = await login({
      email: 'admin@kbyglobal.com',
      password: 'Password123!',
    });

    expect(session.accessToken).toContain('mock-access-token');
    expect(session.expiresIn).toBe(900);
    expect(session.user.role).toBe('ADMIN');
    expect(session.user.businessId).toBe(BUSINESS_ID);
    // doc 06 §5 — an ADMIN must not be scoped to a branch.
    expect(session.user.branchId).toBeNull();
  });

  it('surfaces the documented neutral message for bad credentials (doc 06 §40)', async () => {
    resetApiClientForTests();
    await expect(login({ email: 'admin@kbyglobal.com', password: 'wrong' })).rejects.toThrow(
      'Invalid email or password.',
    );
  });

  it('refuses an inactive or suspended account (doc 06 §21)', async () => {
    resetApiClientForTests();
    await expect(
      login({ email: 'manager.lekki@kbyglobal.com', password: 'Password123!' }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_ACCOUNT_INACTIVE' });
  });

  it('gives a manager their branchId from the JWT', async () => {
    resetApiClientForTests();
    const session = await login({
      email: 'manager@kbyglobal.com',
      password: 'Password123!',
    });
    expect(session.user.role).toBe('MANAGER');
    expect(session.user.branchId).toBe(BRANCHES[0]!.id);
  });
});

describe('normalizeAuthSession', () => {
  it('accepts the bare doc 06 §12 shape', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          accessToken: 'bare-token',
          refreshToken: 'r1',
          user: { ...USERS[0] },
        }),
      ),
    );

    const result = await login({ email: 'superadmin@kbyglobal.com', password: 'Password123!' });
    expect(result.accessToken).toBe('bare-token');
    // `expiresIn` is absent in doc 06, so the documented 900 default applies.
    expect(result.expiresIn).toBe(900);
  });

  it('rejects a response with no access token', async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json({ data: { user: {} } })));
    await expect(login({ email: 'admin@kbyglobal.com', password: 'Password123!' })).rejects.toThrow(
      /did not include an access token/i,
    );
  });
});

describe('authenticated requests', () => {
  it('sends the Bearer token issued at login', async () => {
    resetApiClientForTests();
    configureApiClient({ baseUrl: '' });
    const session = await login({ email: 'manager@kbyglobal.com', password: 'Password123!' });
    setAccessToken(session.accessToken);

    const me = await getCurrentUser();

    expect(me.email).toBe('manager@kbyglobal.com');
    expect(me.role).toBe('MANAGER');
  });

  it('rejects an unauthenticated /auth/me with 401', async () => {
    resetApiClientForTests();
    setAccessToken(null);
    await expect(getCurrentUser()).rejects.toMatchObject({ statusCode: 401 });
  });

  /**
   * The complaint this whole flow exists to answer: reloading the page must not
   * sign anybody out. The access token only lives in memory, so a reload starts
   * with none and `/auth/me` has to be rescued by the refresh session.
   */
  it('restores the session on a reload through the refresh endpoint', async () => {
    resetApiClientForTests();
    configureApiClient({ baseUrl: '' });
    const session = await login({ email: 'admin@kbyglobal.com', password: 'Password123!' });
    setAccessToken(session.accessToken);
    expect((await getCurrentUser()).email).toBe('admin@kbyglobal.com');

    // The reload itself: memory is cleared, the cookie session is not.
    setAccessToken(null);

    const restored = await getCurrentUser();
    expect(restored.email).toBe('admin@kbyglobal.com');
    expect(restored.role).toBe('ADMIN');
    // And the recovered token stays in memory for every later request.
    expect(getAccessToken()).toContain(encodeURIComponent('admin@kbyglobal.com'));
  });
});
