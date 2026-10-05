/**
 * Authentication endpoints (doc 04 §10–16, doc 06 §11–20).
 *
 * Doc 04 and doc 06 disagree on the login response shape (wrapped vs bare) — see
 * `docs/ASSUMPTIONS.md` §2.2. `normalizeAuthSession` tolerates both.
 */

import { z } from 'zod';

import { apiClient } from './client';
import type { AuthenticatedUser } from '@/types/domain';

/** doc 06 §8 — seconds; 900 = 15 minutes. */
const DEFAULT_EXPIRES_IN = 900;

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string | null;
  /** Seconds until the access token expires. */
  expiresIn: number;
  user: AuthenticatedUser;
}

/** Accepts `data.accessToken` (doc 04) and bare `accessToken` (doc 06). */
function normalizeAuthSession(raw: unknown): AuthSession {
  const root = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const inner = (typeof root.data === 'object' && root.data !== null ? root.data : root) as Record<
    string,
    unknown
  >;

  const accessToken = inner.accessToken ?? inner.access_token;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('Authentication response did not include an access token.');
  }

  const expiresIn =
    typeof inner.expiresIn === 'number' && inner.expiresIn > 0
      ? inner.expiresIn
      : DEFAULT_EXPIRES_IN;

  return {
    accessToken,
    refreshToken: typeof inner.refreshToken === 'string' ? inner.refreshToken : null,
    expiresIn,
    user: inner.user as AuthenticatedUser,
  };
}

/** doc 04 §11 */
export async function login(input: LoginInput): Promise<AuthSession> {
  // doc 03 §23 — the backend normalises email to lowercase.
  const session = normalizeAuthSession(
    await apiClient.post<unknown>('/auth/login', {
      email: input.email.trim().toLowerCase(),
      password: input.password,
    }),
  );
  return session;
}

/** doc 04 §16 — `data` IS the user object. */
export async function getCurrentUser(): Promise<AuthenticatedUser> {
  return apiClient.get<AuthenticatedUser>('/auth/me');
}

/**
 * doc 04 §13 — logout returns 204. The refresh token travels in the cookie, so
 * nothing sensitive is placed in the request body here.
 */
export async function logout(): Promise<void> {
  await apiClient.post<void>('/auth/logout');
}

/** doc 06 §14 — revoke every active refresh-token session. */
export async function logoutAll(): Promise<void> {
  await apiClient.post<void>('/auth/logout-all');
}

/** doc 04 §14 / doc 06 §18 — always returns the same neutral message. */
export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post<void>('/auth/forgot-password', {
    email: email.trim().toLowerCase(),
  });
}

/**
 * doc 04 §15 — note the field is `password`, not `newPassword`.
 * The token must be unexpired, unused, and is invalidated on success.
 */
export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  await apiClient.post<void>('/auth/reset-password', {
    token: input.token,
    password: input.password,
  });
}

/** doc 06 §20 — uses `currentPassword` / `newPassword`, unlike reset. */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post<void>('/auth/change-password', {
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });
}

/**
 * doc 06 §44 — "Minimum: 8 characters". The stricter 12+ variant is noted as
 * optional; 8 is the documented minimum, enforced identically client and server side.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Shared by login, reset and change-password forms. */
export const passwordSchema = (label = 'Password') =>
  z
    .string()
    .min(1, `${label} is required`)
    .min(PASSWORD_MIN_LENGTH, `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`);

/**
 * doc 03 §23 — the application normalises email addresses to lowercase, and the
 * database uniqueness constraint is on `LOWER(email)`.
 *
 * Zod 4 runs `.email()` against the raw string, so the trim/lower-case must be
 * applied by a transform *before* validation, not after it.
 */
const emailField = z
  .string()
  .min(1, 'Email is required')
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema('New password'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema('New password'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
