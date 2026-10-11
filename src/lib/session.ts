/**
 * What the app may conclude about the session after the `me` check settles.
 *
 * The session is restored on a page load by the httpOnly refresh cookie, so the
 * only evidence that somebody is signed out is the server actually saying so.
 * A failed connection says nothing about the cookie — and treating it as a
 * sign-out is what threw a reloaded tab back to the login screen over one blip.
 */
import { isApiError } from '@/api/errors';
import type { AuthenticatedUser } from '@/types/domain';

export type SessionStatus = 'authenticated' | 'signed-out' | 'unresolved';

export function resolveSessionStatus(
  user: AuthenticatedUser | null,
  error: unknown,
): SessionStatus {
  if (user) return 'authenticated';
  if (!error) return 'signed-out';
  if (!isApiError(error)) return 'unresolved';
  // A 4xx means the request reached the API and was refused on the merits — a
  // 401 on `/auth/me` after the refresh already failed is a real sign-out.
  // Anything else (network failure, 5xx, gateway problem) is no answer at all.
  return error.statusCode >= 400 && error.statusCode < 500 ? 'signed-out' : 'unresolved';
}
