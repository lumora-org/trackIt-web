/**
 * Mock API implementing the documented contract (doc 04).
 *
 * This exists so the frontend is runnable and demoable before the backend is
 * available. It is intentionally *not* a reimplementation of business logic —
 * it fabricates plausible responses. When the real backend exists, set
 * NEXT_PUBLIC_API_BASE_URL and disable this via NEXT_PUBLIC_USE_MOCK_API=false.
 *
 * Note: every handler below enforces the documented authorization rules so the
 * frontend cannot accidentally appear to work where the backend would 403.
 */

import { http, HttpResponse } from 'msw';

import type {
  ApiFieldError,
  AuthenticatedUser,
  Branch,
  DailyReport,
  DailySalesSummaryRow,
  Delivery,
  FuelOrder,
  FuelOrderStatus,
  IncidentReport,
  Sale,
  User,
} from '@/types/domain';
import { FUEL_ORDER_TRANSITIONS } from '@/types/domain';

import {
  AUDIT_LOGS,
  BRANCHES,
  BUSINESS,
  BUSINESS_ID,
  DAILY_REPORTS,
  DELIVERIES,
  FUEL_ORDERS,
  FUEL_PRICES,
  FUEL_TYPES,
  INCIDENT_REPORTS,
  INVENTORY_STOCK,
  INVENTORY_TRANSACTIONS,
  MOCK_SESSION,
  MOCK_VAPID_PUBLIC_KEY,
  NOTIFICATIONS,
  PUSH_SUBSCRIPTIONS,
  SALES,
  SUPPLIERS,
  TANKERS,
  USERS,
  buildAdminDashboard,
  buildManagerDashboard,
} from './data';

const API = '/api/v1';

const DEMO_PASSWORD = 'Password123!';

/* ------------------------------------------------------------------ helpers */

/** doc 04 §7 */
function error(statusCode: number, code: string, message: string, errors?: ApiFieldError[]) {
  return HttpResponse.json(
    {
      statusCode,
      code,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: API,
    },
    { status: statusCode },
  );
}

/** doc 04 §6 */
function ok<T>(data: T, meta?: { page: number; limit: number; total: number; totalPages: number }) {
  return HttpResponse.json(meta ? { data, meta } : { data });
}

const MOCK_ACCESS_TOKEN = 'mock-access-token';
const MOCK_REFRESH_TOKEN = 'mock-refresh-token';
const REFRESH_COOKIE_NAME = 'kby_refresh_token';

function currentUser(request: Request): AuthenticatedUser | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const email = decodeURIComponent(header.slice(7).replace(/^mock-access-token\./, ''));
  const user = USERS.find((u) => u.email === email || u.id === email);
  if (!user || user.status !== 'ACTIVE') return null;
  return toAuthenticatedUser(user);
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    businessId: user.businessId,
    branchId: user.branchId,
  };
}

function requireAuth(request: Request) {
  const user = currentUser(request);
  if (!user) return null;
  return user;
}

/** doc 06 §28 */
function requireRole(user: AuthenticatedUser | null, roles: AuthenticatedUser['role'][]) {
  if (!user) return false;
  return roles.includes(user.role);
}

/*
 * Profile photos (PROMPT.md §56). The mock store resets on every page load
 * while the refresh cookie keeps the session alive, so an uploaded photo would
 * otherwise vanish between reloads. Avatars are mirrored into localStorage
 * (browser only) and re-applied to the seed users when this module boots.
 */
const AVATAR_STORAGE_PREFIX = 'trackit-avatar:';
/** A ~2 MB file is ~2.7 MB of base64 text; the cap leaves headroom. */
const AVATAR_MAX_CHARS = 3_500_000;
const AVATAR_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,/;

function persistAvatar(userId: string, avatarUrl: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (avatarUrl) window.localStorage.setItem(`${AVATAR_STORAGE_PREFIX}${userId}`, avatarUrl);
    else window.localStorage.removeItem(`${AVATAR_STORAGE_PREFIX}${userId}`);
  } catch {
    // Storage may be unavailable or full; the in-memory copy still applies.
  }
}

if (typeof window !== 'undefined') {
  for (const seeded of USERS) {
    const stored = window.localStorage.getItem(`${AVATAR_STORAGE_PREFIX}${seeded.id}`);
    if (stored) seeded.avatarUrl = stored;
  }
}

/*
 * The demo session, mirrored into localStorage for the same reason avatars are:
 * the mock store is rebuilt on every page load. MSW cannot hand the browser a
 * real httpOnly cookie, so without this the demo would log itself out on every
 * refresh — the exact bug the real API's refresh cookie fixes, and the reason
 * the avatar comment above could promise that a reload keeps you signed in.
 */
const SESSION_STORAGE_KEY = 'trackit-mock-session';

function persistSession(email: string | null): void {
  MOCK_SESSION.email = email;
  if (typeof window === 'undefined') return;
  try {
    if (email) window.localStorage.setItem(SESSION_STORAGE_KEY, email);
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; the in-memory session still applies.
  }
}

if (typeof window !== 'undefined') {
  MOCK_SESSION.email = window.localStorage.getItem(SESSION_STORAGE_KEY);
}

/** doc 04 §89 */
function paginate<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    slice: items.slice(start, start + limit),
    meta: { page, limit, total, totalPages },
  };
}

const search = (url: URL) => url.searchParams.get('search')?.toLowerCase().trim() ?? '';

/** doc 04 §93 — a manager must never see another branch's data. */
function scopeBranch(user: AuthenticatedUser, requested: string | null): string | null {
  if (user.role === 'MANAGER') return user.branchId;
  return requested ?? null;
}

let saleCounter = SALES.length;
let orderCounter = FUEL_ORDERS.length;
let deliveryCounter = DELIVERIES.length;

/**
 * doc 08 §31 — resolve the price whose [effectiveFrom, effectiveTo) interval
 * contains `at`, ordered by effectiveFrom DESC.
 */
function resolvePrice(businessId: string, fuelTypeId: string, at: Date) {
  const candidates = FUEL_PRICES.filter(
    (p) =>
      p.fuelTypeId === fuelTypeId &&
      new Date(p.effectiveFrom) <= at &&
      (p.effectiveTo === null || new Date(p.effectiveTo) > at),
  ).sort((a, b) => +new Date(b.effectiveFrom) - +new Date(a.effectiveFrom));
  return candidates[0] ?? null;
}

function currentStock(branchId: string, fuelTypeId: string): number {
  return (
    INVENTORY_STOCK.find((s) => s.branchId === branchId && s.fuelTypeId === fuelTypeId)
      ?.currentQuantityLitres ?? 0
  );
}

/*
 * Product decision (2026-10) — every recorded sale fans a SALE_RECORDED
 * notification out to the business's admins. The mock feed is recipient-free
 * (every signed-in user reads the same list), so one row models the fan-out.
 */
function notifyAdminsOfSale(sale: Sale, title: string, message: string) {
  NOTIFICATIONS.unshift({
    id: crypto.randomUUID(),
    type: 'SALE_RECORDED',
    title,
    message,
    status: 'UNREAD',
    resourceType: 'SALE',
    resourceId: sale.id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

/*
 * Product decision (2026-10) — a manager's recording awaits confirmation;
 * an admin's is confirmed by definition (mirrors the API).
 */
function approvalStamp(user: AuthenticatedUser) {
  if (user.role === 'MANAGER') {
    return { approvalStatus: 'PENDING' as const, approvedAt: null };
  }
  return { approvalStatus: 'APPROVED' as const, approvedAt: new Date().toISOString() };
}

/*
 * Product decision (2026-10) — the manager who recorded a figure is told how
 * the review ended. The mock feed is recipient-free, so one row models it.
 */
function notifyRecorderOfDecision(
  sale: Sale,
  type: 'SALE_APPROVED' | 'SALE_REJECTED',
  title: string,
  message: string,
) {
  NOTIFICATIONS.unshift({
    id: crypto.randomUUID(),
    type,
    title,
    message,
    status: 'UNREAD',
    resourceType: 'SALE',
    resourceId: sale.id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

/* ------------------------------------------------------------------ handlers */

export const handlers = [
  /* ------------------------------------------------------------- auth */

  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    const user = USERS.find((u) => u.email.toLowerCase() === email);

    // doc 06 §40 — do not reveal whether the account exists.
    if (!user || body.password !== DEMO_PASSWORD) {
      return error(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    // doc 06 §21 — only ACTIVE users may authenticate.
    if (user.status !== 'ACTIVE') {
      return error(403, 'AUTH_ACCOUNT_INACTIVE', 'This account is not active.');
    }

    const token = `${MOCK_ACCESS_TOKEN}.${encodeURIComponent(user.email)}`;
    // Remember the session the way the real backend remembers it in the
    // httpOnly cookie, so a reload can be re-authenticated (see MOCK_SESSION).
    persistSession(user.email);
    // The refresh token is set as an httpOnly cookie so the browser's JS can
    // never read it (PROMPT.md §21).
    return HttpResponse.json(
      {
        data: {
          accessToken: token,
          refreshToken: MOCK_REFRESH_TOKEN,
          expiresIn: 900,
          user: toAuthenticatedUser(user),
        },
      },
      {
        headers: {
          'Set-Cookie': `${REFRESH_COOKIE_NAME}=${MOCK_REFRESH_TOKEN}; HttpOnly; SameSite=Lax; Path=/`,
        },
      },
    );
  }),

  http.post(`${API}/auth/refresh`, () => {
    // The mock has no session table, so MOCK_SESSION stands in for the refresh
    // cookie: with no live session the refresh is refused exactly as the real
    // API refuses an unknown or revoked token, and the caller must sign in.
    if (!MOCK_SESSION.email) {
      return error(401, 'AUTH_REFRESH_TOKEN_INVALID', 'The refresh token is not valid.');
    }
    // The replacement token has to carry the same identity the login token did,
    // or the request retried after the refresh would still be anonymous.
    return HttpResponse.json({
      data: {
        accessToken: `${MOCK_ACCESS_TOKEN}.${encodeURIComponent(MOCK_SESSION.email)}`,
        refreshToken: MOCK_REFRESH_TOKEN,
        expiresIn: 900,
      },
    });
  }),

  http.post(`${API}/auth/logout`, () => {
    persistSession(null);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/auth/logout-all`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${API}/auth/forgot-password`, async () => {
    // doc 04 §14 — always the same neutral response.
    return ok({ message: 'If the account exists, password reset instructions have been sent.' });
  }),

  http.post(`${API}/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as { token?: string; password?: string };
    if (!body.token) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'token', message: 'token is required' },
      ]);
    }
    if (!body.password || body.password.length < 8) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'password', message: 'password must be at least 8 characters' },
      ]);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/auth/change-password`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    if (body.currentPassword !== DEMO_PASSWORD) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'currentPassword', message: 'Current password is incorrect' },
      ]);
    }
    if (!body.newPassword || body.newPassword.length < 8) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'newPassword', message: 'password must be at least 8 characters' },
      ]);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/auth/me`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    // doc 04 §16 — `data` IS the user, not `data.user`.
    return ok(user);
  }),

  /* -------------------------------------------------------- businesses */

  http.get(`${API}/businesses`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (user.role !== 'SUPER_ADMIN') return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    const { slice, meta } = paginate([BUSINESS], new URL(request.url));
    return ok(slice, meta);
  }),

  // The AppShell reads the business name for the header. ADMIN/MANAGER may read
  // their own business even though the collection is SUPER_ADMIN-only.
  http.get(`${API}/businesses/:id`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (params.id !== BUSINESS.id) {
      return error(404, 'RESOURCE_NOT_FOUND', 'Business not found.');
    }
    return ok({ ...BUSINESS });
  }),

  // doc 04 §20 — SUPER_ADMIN only.
  http.post(`${API}/businesses`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (user.role !== 'SUPER_ADMIN') return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as Record<string, string>;
    if (!body.name) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'name', message: 'name is required' },
      ]);
    }

    BUSINESS.name = body.name;
    BUSINESS.registrationNumber = body.registrationNumber ?? BUSINESS.registrationNumber;
    BUSINESS.email = body.email ?? BUSINESS.email;
    BUSINESS.phone = body.phone ?? BUSINESS.phone;
    BUSINESS.address = body.address ?? BUSINESS.address;
    return HttpResponse.json({ data: { ...BUSINESS } }, { status: 201 });
  }),

  // doc 04 §23 — there is no /branches/:id/status, so status goes through PATCH.
  http.patch(`${API}/branches/:id`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    const branch = BRANCHES.find((b) => b.id === params.id);
    if (!branch) return error(404, 'RESOURCE_NOT_FOUND', 'Branch not found.');

    const body = (await request.json()) as Partial<Branch>;
    if (body.name) branch.name = body.name;
    if (body.code) branch.code = body.code;
    if (body.address) branch.address = body.address;
    if (body.phone !== undefined) branch.phone = body.phone;
    // doc 03 §14 — branch_status has only ACTIVE / INACTIVE.
    if (body.status) branch.status = body.status;
    return ok(branch);
  }),

  /* ----------------------------------------------------------- branches */

  http.get(`${API}/branches`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');

    // doc 04 §21.1 — a manager sees only their own branch.
    let rows = BRANCHES.filter((b) => b.businessId === user.businessId);
    if (user.role === 'SUPER_ADMIN') rows = BRANCHES;
    if (user.role === 'MANAGER') rows = rows.filter((b) => b.id === user.branchId);

    const status = new URL(request.url).searchParams.get('status');
    if (status) rows = rows.filter((b) => b.status === status);
    const q = search(new URL(request.url));
    if (q) {
      rows = rows.filter(
        (b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q),
      );
    }

    const { slice, meta } = paginate(rows, new URL(request.url));
    return ok(slice, meta);
  }),

  http.post(`${API}/branches`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    // doc 04 §22 — ADMIN, SUPER_ADMIN.
    if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    const body = (await request.json()) as { name?: string; code?: string; address?: string };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.name) fieldErrors.push({ field: 'name', message: 'name is required' });
    if (!body.code) fieldErrors.push({ field: 'code', message: 'code is required' });
    if (!body.address) fieldErrors.push({ field: 'address', message: 'address is required' });
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    // doc 03 §27 — UNIQUE (business_id, code)
    if (BRANCHES.some((b) => b.code === body.code)) {
      return error(409, 'RESOURCE_ALREADY_EXISTS', 'A branch with this code already exists.');
    }

    const branch = {
      id: crypto.randomUUID(),
      businessId: user.businessId ?? BUSINESS_ID,
      name: body.name!,
      code: body.code!,
      address: body.address!,
      phone: null,
      status: 'ACTIVE' as const,
    };
    BRANCHES.push(branch);
    return HttpResponse.json({ data: branch }, { status: 201 });
  }),

  /* -------------------------------------------------------------- users */

  http.get(`${API}/users`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    // doc 04 §17 — SUPER_ADMIN, ADMIN.
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const url = new URL(request.url);
    let rows =
      user.role === 'SUPER_ADMIN'
        ? [...USERS]
        : USERS.filter((u) => u.businessId === user.businessId);
    const role = url.searchParams.get('role');
    if (role) rows = rows.filter((u) => u.role === role);
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((u) => u.status === status);
    const branchId = url.searchParams.get('branchId');
    if (branchId) rows = rows.filter((u) => u.branchId === branchId);
    const q = search(url);
    if (q) {
      rows = rows.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }

    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.post(`${API}/users`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as Record<string, string>;
    const fieldErrors: ApiFieldError[] = [];
    for (const f of ['firstName', 'lastName', 'email', 'password', 'role']) {
      if (!body[f]) fieldErrors.push({ field: f, message: `${f} is required` });
    }
    // doc 03 §22 — a MANAGER must have a branchId.
    if (body.role === 'MANAGER' && !body.branchId) {
      fieldErrors.push({ field: 'branchId', message: 'branchId is required for a manager' });
    }
    if (body.role === 'ADMIN' && body.branchId) {
      fieldErrors.push({
        field: 'branchId',
        message: 'an administrator cannot be assigned to a branch',
      });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    if (USERS.some((u) => u.email.toLowerCase() === body.email!.toLowerCase())) {
      return error(409, 'RESOURCE_ALREADY_EXISTS', 'A user with this email already exists.');
    }

    const created: User = {
      id: crypto.randomUUID(),
      businessId: user.role === 'SUPER_ADMIN' ? (body.businessId ?? null) : user.businessId,
      branchId: body.branchId ?? null,
      firstName: body.firstName!,
      lastName: body.lastName!,
      email: body.email!.toLowerCase(),
      phone: body.phone ?? null,
      avatarUrl: null,
      role: body.role as User['role'],
      status: 'ACTIVE',
      lastLoginAt: null,
    };
    USERS.push(created);
    return HttpResponse.json({ data: created }, { status: 201 });
  }),

  // doc 04 §18 — profile updates. Email and role are immutable here.
  http.patch(`${API}/users/:id`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const target = USERS.find((u) => u.id === params.id);
    if (!target) return error(404, 'RESOURCE_NOT_FOUND', 'User not found.');
    if (target.id === user.id) {
      return error(422, 'INVALID_OPERATION', 'Use your profile page to edit your own details.');
    }
    if (target.role === 'SUPER_ADMIN') {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'The platform owner cannot be edited here.');
    }
    // doc 07 §57 — an admin manages managers, not other admins.
    if (
      user.role === 'ADMIN' &&
      (target.businessId !== user.businessId || target.role !== 'MANAGER')
    ) {
      return error(
        403,
        'BUSINESS_ACCESS_DENIED',
        'Administrators can only edit managers in their own business.',
      );
    }

    const body = (await request.json()) as Record<string, string | undefined>;
    if (body.firstName !== undefined && !body.firstName.trim()) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'firstName', message: 'firstName cannot be empty' },
      ]);
    }
    if (body.lastName !== undefined && !body.lastName.trim()) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'lastName', message: 'lastName cannot be empty' },
      ]);
    }
    // doc 03 §22 — a manager stays pinned to a branch; an admin never has one.
    if (target.role === 'MANAGER' && body.branchId !== undefined) {
      const branch = BRANCHES.find((b) => b.id === body.branchId);
      if (!branch || branch.businessId !== target.businessId) {
        return error(400, 'VALIDATION_ERROR', 'Validation failed', [
          { field: 'branchId', message: 'branchId must be a branch of the same business' },
        ]);
      }
      target.branchId = branch.id;
    }
    if (target.role === 'ADMIN' && body.branchId) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'branchId', message: 'an administrator cannot be assigned to a branch' },
      ]);
    }

    if (body.firstName !== undefined) target.firstName = body.firstName.trim();
    if (body.lastName !== undefined) target.lastName = body.lastName.trim();
    if (body.phone !== undefined) target.phone = body.phone ? body.phone : null;
    return ok(target);
  }),

  // Not part of the documented contract (doc 04 §19 prefers deactivation), but
  // an admin may remove a manager outright. Destructive, so it is guarded like
  // the other user mutations above.
  http.delete(`${API}/users/:id`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const index = USERS.findIndex((u) => u.id === params.id);
    if (index === -1) return error(404, 'RESOURCE_NOT_FOUND', 'User not found.');
    const target = USERS[index]!;
    if (target.id === user.id) {
      return error(422, 'INVALID_OPERATION', 'You cannot delete your own account.');
    }
    if (target.role === 'SUPER_ADMIN') {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'The platform owner cannot be deleted.');
    }
    // doc 07 §57 — an admin manages managers, not other admins.
    if (
      user.role === 'ADMIN' &&
      (target.businessId !== user.businessId || target.role !== 'MANAGER')
    ) {
      return error(
        403,
        'BUSINESS_ACCESS_DENIED',
        'Administrators can only delete managers in their own business.',
      );
    }

    USERS.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // doc 04 §19 — status lives on its own route so suspension never doubles as
  // an edit. Only ACTIVE / INACTIVE / SUSPENDED are accepted (doc 03 §12).
  http.patch(`${API}/users/:id/status`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as { status?: string };
    if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE' && body.status !== 'SUSPENDED') {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'status', message: 'status must be ACTIVE, INACTIVE or SUSPENDED' },
      ]);
    }

    const target = USERS.find((u) => u.id === params.id);
    if (!target) return error(404, 'RESOURCE_NOT_FOUND', 'User not found.');
    if (target.id === user.id) {
      return error(422, 'INVALID_OPERATION', 'You cannot change the status of your own account.');
    }
    if (target.role === 'SUPER_ADMIN') {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'The platform owner cannot be suspended.');
    }
    // doc 07 §57 — an admin manages managers, not other admins.
    if (
      user.role === 'ADMIN' &&
      (target.businessId !== user.businessId || target.role !== 'MANAGER')
    ) {
      return error(
        403,
        'BUSINESS_ACCESS_DENIED',
        'Administrators can only manage managers in their own business.',
      );
    }

    target.status = body.status;
    return ok(target);
  }),

  /*
   * Profile photo (PROMPT.md §56). There is no blob storage behind the mock,
   * so the client reads the picked file as a data URL and the body carries the
   * string; `null` clears it. A real backend would accept multipart/form-data
   * and hand back a CDN URL instead. Available to every signed-in role.
   */
  http.post(`${API}/users/me/avatar`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');

    const body = (await request.json()) as { avatarUrl?: unknown };
    if (
      body.avatarUrl !== null &&
      (typeof body.avatarUrl !== 'string' ||
        !AVATAR_DATA_URL.test(body.avatarUrl) ||
        body.avatarUrl.length > AVATAR_MAX_CHARS)
    ) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        {
          field: 'avatarUrl',
          message: 'avatarUrl must be a base64 PNG, JPG or WebP data URL (2 MB max) or null',
        },
      ]);
    }

    const target = USERS.find((u) => u.id === user.id);
    if (!target) return error(404, 'RESOURCE_NOT_FOUND', 'User not found.');

    target.avatarUrl = body.avatarUrl;
    persistAvatar(target.id, target.avatarUrl);
    return ok(toAuthenticatedUser(target));
  }),

  /* --------------------------------------------------------- fuel types */

  http.get(`${API}/fuel-types`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...FUEL_TYPES];
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((f) => f.status === status);
    const q = search(url);
    if (q)
      rows = rows.filter(
        (f) => f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q),
      );
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.post(`${API}/fuel-types`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    // doc 08 §11 — only SUPER_ADMIN / ADMIN.
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as { name?: string; code?: string; description?: string };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.name) fieldErrors.push({ field: 'name', message: 'name is required' });
    // doc 08 §70 — @Matches(/^[A-Z0-9_-]+$/)
    if (!body.code) fieldErrors.push({ field: 'code', message: 'code is required' });
    else if (!/^[A-Z0-9_-]+$/.test(body.code)) {
      fieldErrors.push({
        field: 'code',
        message: 'code may only contain uppercase letters, numbers, - and _',
      });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    // doc 03 §30 — UNIQUE (business_id, code)
    if (FUEL_TYPES.some((f) => f.code === body.code)) {
      return error(409, 'RESOURCE_ALREADY_EXISTS', 'A fuel type with this code already exists.');
    }

    const created = {
      id: crypto.randomUUID(),
      name: body.name!,
      code: body.code!,
      description: body.description ?? null,
      status: 'ACTIVE' as const,
    };
    FUEL_TYPES.push(created);
    return HttpResponse.json({ data: created }, { status: 201 });
  }),

  // doc 08 §13 — `code` is immutable after creation; only name/description.
  http.patch(`${API}/fuel-types/:id`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const target = FUEL_TYPES.find((f) => f.id === params.id);
    if (!target) return error(404, 'RESOURCE_NOT_FOUND', 'Fuel type not found.');

    const body = (await request.json()) as { name?: string; description?: string | null };
    if (body.name !== undefined && !body.name.trim()) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'name', message: 'name cannot be empty' },
      ]);
    }
    if (body.name !== undefined) target.name = body.name.trim();
    if (body.description !== undefined) target.description = body.description || null;
    return ok(target);
  }),

  /* --------------------------------------------------------- fuel prices */

  http.get(`${API}/fuel-prices`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...FUEL_PRICES];
    const fuelTypeId = url.searchParams.get('fuelTypeId');
    if (fuelTypeId) rows = rows.filter((p) => p.fuelTypeId === fuelTypeId);
    const active = url.searchParams.get('active');
    if (active === 'true') {
      const now = Date.now();
      rows = rows.filter(
        (p) =>
          new Date(p.effectiveFrom).getTime() <= now &&
          (p.effectiveTo === null || new Date(p.effectiveTo).getTime() > now),
      );
    }
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from) rows = rows.filter((p) => new Date(p.effectiveFrom) >= new Date(from));
    if (to) rows = rows.filter((p) => new Date(p.effectiveFrom) <= new Date(to));

    rows.sort((a, b) => +new Date(b.effectiveFrom) - +new Date(a.effectiveFrom));
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  // doc 04 §30 — single object keyed by fuelTypeId.
  http.get(`${API}/fuel-prices/current/:fuelTypeId`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const price = resolvePrice(
      user.businessId ?? BUSINESS_ID,
      String(params.fuelTypeId),
      new Date(),
    );
    if (!price) {
      return error(404, 'RESOURCE_NOT_FOUND', 'No current price is configured for this fuel type.');
    }
    return ok({
      fuelTypeId: price.fuelTypeId,
      pricePerLitre: price.pricePerLitre,
      effectiveFrom: price.effectiveFrom,
      effectiveTo: price.effectiveTo,
    });
  }),

  http.post(`${API}/fuel-prices`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as Record<string, unknown>;
    const fieldErrors: ApiFieldError[] = [];
    // Mirrors the API's forbidNonWhitelisted pipe: there is no effective date
    // anymore — a price change always starts immediately (product decision).
    const allowedKeys = new Set(['fuelTypeId', 'pricePerLitre']);
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        fieldErrors.push({ field: key, message: `property ${key} should not exist` });
      }
    }
    const fuelTypeId = typeof body.fuelTypeId === 'string' ? body.fuelTypeId : undefined;
    if (!fuelTypeId) fieldErrors.push({ field: 'fuelTypeId', message: 'fuelTypeId is required' });
    // doc 08 §71 — @IsPositive()
    const pricePerLitre = typeof body.pricePerLitre === 'number' ? body.pricePerLitre : undefined;
    if (pricePerLitre === undefined || pricePerLitre <= 0) {
      fieldErrors.push({ field: 'pricePerLitre', message: 'pricePerLitre must be greater than 0' });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    const now = new Date();

    // No scheduling: retire any future-dated period (legacy data) first so the
    // new open-ended interval cannot clash with it.
    for (let index = FUEL_PRICES.length - 1; index >= 0; index -= 1) {
      const price = FUEL_PRICES[index]!;
      if (
        price.fuelTypeId === fuelTypeId &&
        new Date(price.effectiveFrom).getTime() > now.getTime()
      ) {
        FUEL_PRICES.splice(index, 1);
      }
    }

    // doc 08 §24 — the interval in force right now is closed exactly at
    // `now`, then the new one opens at the same instant.
    const current = FUEL_PRICES.find(
      (p) =>
        p.fuelTypeId === fuelTypeId &&
        new Date(p.effectiveFrom).getTime() <= now.getTime() &&
        (p.effectiveTo === null || new Date(p.effectiveTo).getTime() > now.getTime()),
    );
    if (current) current.effectiveTo = now.toISOString();

    const created = {
      id: crypto.randomUUID(),
      fuelTypeId: fuelTypeId!,
      pricePerLitre: pricePerLitre!,
      effectiveFrom: now.toISOString(),
      effectiveTo: null,
    };
    FUEL_PRICES.push(created);
    return HttpResponse.json({ data: created }, { status: 201 });
  }),

  /* ----------------------------------------------------------- suppliers */

  http.get(`${API}/suppliers`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = SUPPLIERS.filter((s) => s.businessId === user.businessId);
    if (user.role === 'SUPER_ADMIN') rows = [...SUPPLIERS];
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((s) => s.status === status);
    const q = search(url);
    if (q) {
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.email ?? '').toLowerCase().includes(q),
      );
    }
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.post(`${API}/suppliers`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as Record<string, string>;
    const fieldErrors: ApiFieldError[] = [];
    if (!body.name) fieldErrors.push({ field: 'name', message: 'name is required' });
    if (!body.code) fieldErrors.push({ field: 'code', message: 'code is required' });
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      fieldErrors.push({ field: 'email', message: 'email must be a valid email address' });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    // doc 03 §34 — UNIQUE (business_id, code)
    if (SUPPLIERS.some((s) => s.code === body.code)) {
      return error(409, 'RESOURCE_ALREADY_EXISTS', 'A supplier with this code already exists.');
    }

    const created = {
      id: crypto.randomUUID(),
      businessId: user.businessId ?? BUSINESS_ID,
      name: body.name!,
      code: body.code!,
      contactPerson: body.contactPerson ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      address: body.address ?? null,
      status: 'ACTIVE' as const,
    };
    SUPPLIERS.push(created);
    return HttpResponse.json({ data: created }, { status: 201 });
  }),

  // doc 03 §34 — `code` stays unique per business after an update.
  http.patch(`${API}/suppliers/:id`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const target = SUPPLIERS.find((s) => s.id === params.id);
    if (!target) return error(404, 'RESOURCE_NOT_FOUND', 'Supplier not found.');

    const body = (await request.json()) as Record<string, string | undefined>;
    if (body.name !== undefined && !body.name.trim()) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'name', message: 'name cannot be empty' },
      ]);
    }
    if (
      body.code !== undefined &&
      body.code !== target.code &&
      SUPPLIERS.some((s) => s.code === body.code)
    ) {
      return error(409, 'RESOURCE_ALREADY_EXISTS', 'A supplier with this code already exists.');
    }

    if (body.name !== undefined) target.name = body.name.trim();
    if (body.code !== undefined) target.code = body.code;
    if (body.contactPerson !== undefined) target.contactPerson = body.contactPerson || null;
    if (body.phone !== undefined) target.phone = body.phone || null;
    if (body.email !== undefined) target.email = body.email || null;
    if (body.address !== undefined) target.address = body.address || null;
    return ok(target);
  }),

  /* -------------------------------------------------------------- tankers */

  http.get(`${API}/tankers`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = TANKERS.filter((t) => t.businessId === user.businessId);
    if (user.role === 'SUPER_ADMIN') rows = [...TANKERS];
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((t) => t.status === status);
    const q = search(url);
    if (q) {
      rows = rows.filter(
        (t) =>
          t.registrationNumber.toLowerCase().includes(q) ||
          (t.tankerCode ?? '').toLowerCase().includes(q) ||
          (t.driverName ?? '').toLowerCase().includes(q),
      );
    }
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.post(`${API}/tankers`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as Record<string, string | number>;
    const fieldErrors: ApiFieldError[] = [];
    if (!body.registrationNumber) {
      fieldErrors.push({ field: 'registrationNumber', message: 'registrationNumber is required' });
    }
    // doc 03 §36 — CHECK (capacity_litres > 0)
    if (!body.capacityLitres || Number(body.capacityLitres) <= 0) {
      fieldErrors.push({
        field: 'capacityLitres',
        message: 'capacityLitres must be greater than 0',
      });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    // doc 03 §36 — UNIQUE (business_id, registration_number)
    if (TANKERS.some((t) => t.registrationNumber === body.registrationNumber)) {
      return error(
        409,
        'RESOURCE_ALREADY_EXISTS',
        'A tanker with this registration number already exists.',
      );
    }

    const created = {
      id: crypto.randomUUID(),
      businessId: user.businessId ?? BUSINESS_ID,
      registrationNumber: String(body.registrationNumber),
      tankerCode: (body.tankerCode as string) ?? null,
      capacityLitres: Number(body.capacityLitres),
      driverName: (body.driverName as string) ?? null,
      driverPhone: (body.driverPhone as string) ?? null,
      status: 'ACTIVE' as const,
    };
    TANKERS.push(created);
    return HttpResponse.json({ data: created }, { status: 201 });
  }),

  // doc 03 §36 — the registration stays unique per business after an update.
  http.patch(`${API}/tankers/:id`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const target = TANKERS.find((t) => t.id === params.id);
    if (!target) return error(404, 'RESOURCE_NOT_FOUND', 'Tanker not found.');

    const body = (await request.json()) as Record<string, string | number | undefined>;
    if (
      body.registrationNumber !== undefined &&
      body.registrationNumber !== target.registrationNumber &&
      TANKERS.some((t) => t.registrationNumber === body.registrationNumber)
    ) {
      return error(
        409,
        'RESOURCE_ALREADY_EXISTS',
        'A tanker with this registration number already exists.',
      );
    }
    // doc 03 §36 — CHECK (capacity_litres > 0).
    if (body.capacityLitres !== undefined && Number(body.capacityLitres) <= 0) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'capacityLitres', message: 'capacityLitres must be greater than 0' },
      ]);
    }

    if (body.registrationNumber !== undefined) {
      target.registrationNumber = String(body.registrationNumber).toUpperCase();
    }
    if (body.tankerCode !== undefined) target.tankerCode = (body.tankerCode as string) || null;
    if (body.capacityLitres !== undefined) target.capacityLitres = Number(body.capacityLitres);
    if (body.driverName !== undefined) target.driverName = (body.driverName as string) || null;
    if (body.driverPhone !== undefined) target.driverPhone = (body.driverPhone as string) || null;
    return ok(target);
  }),

  /* ---------------------------------------------------------- fuel orders */

  http.get(`${API}/fuel-orders`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...FUEL_ORDERS];

    const branchId = scopeBranch(user, url.searchParams.get('branchId'));
    if (branchId) rows = rows.filter((o) => o.destinationBranch.id === branchId);
    if (user.role === 'SUPER_ADMIN')
      rows = FUEL_ORDERS.filter((o) => o.destinationBranch.id === branchId || !branchId);

    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((o) => o.status === status);
    const supplierId = url.searchParams.get('supplierId');
    if (supplierId) rows = rows.filter((o) => o.supplier.id === supplierId);

    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.get(`${API}/fuel-orders/:id`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const order = FUEL_ORDERS.find((o) => o.id === params.id);
    if (!order) return error(404, 'RESOURCE_NOT_FOUND', 'Fuel order not found.');
    if (user.role === 'MANAGER' && order.destinationBranch.id !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    return ok(order);
  }),

  http.post(`${API}/fuel-orders`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN']))
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');

    const body = (await request.json()) as {
      supplierId?: string;
      destinationBranchId?: string;
      expectedDeliveryAt?: string;
      notes?: string;
      items?: Array<{ fuelTypeId: string; expectedQuantityLitres: number; unitCost: number }>;
    };

    const fieldErrors: ApiFieldError[] = [];
    if (!body.supplierId)
      fieldErrors.push({ field: 'supplierId', message: 'supplierId is required' });
    if (!body.destinationBranchId) {
      fieldErrors.push({
        field: 'destinationBranchId',
        message: 'destinationBranchId is required',
      });
    }
    // doc 09 §13 — expected quantities must be > 0.
    const items = (body.items ?? []).filter(
      (i) => i.expectedQuantityLitres === undefined || i.expectedQuantityLitres <= 0,
    );
    if (items.length > 0) {
      fieldErrors.push({
        field: 'items',
        message: 'expectedQuantityLitres must be greater than 0',
      });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    const supplier = SUPPLIERS.find((s) => s.id === body.supplierId);
    const branch = BRANCHES.find((b) => b.id === body.destinationBranchId);
    if (!supplier) return error(404, 'RESOURCE_NOT_FOUND', 'Supplier not found.');
    if (!branch) return error(404, 'RESOURCE_NOT_FOUND', 'Destination branch not found.');

    orderCounter += 1;
    const year = new Date().getFullYear();
    const created: FuelOrder = {
      id: crypto.randomUUID(),
      // doc 09 §8 — the server generates the authoritative number.
      orderNumber: `ORD-${year}-${String(orderCounter).padStart(6, '0')}`,
      status: 'DRAFT',
      supplier: { id: supplier.id, name: supplier.name },
      destinationBranch: { id: branch.id, name: branch.name },
      expectedDeliveryAt: body.expectedDeliveryAt!,
      orderedAt: new Date().toISOString(),
      notes: body.notes ?? null,
      items: (body.items ?? []).map((i) => ({
        ...i,
        fuelTypeName: FUEL_TYPES.find((f) => f.id === i.fuelTypeId)?.code ?? '—',
      })),
    };
    FUEL_ORDERS.unshift(created);
    return HttpResponse.json({ data: created }, { status: 201 });
  }),

  /** Shared transition handler for submit / confirm / in-transit / cancel. */
  ...(
    [
      ['submit', 'SUBMITTED'],
      ['confirm', 'CONFIRMED'],
      ['in-transit', 'IN_TRANSIT'],
      ['cancel', 'CANCELLED'],
    ] as const
  ).map(([segment, target]) =>
    http.post(`${API}/fuel-orders/:id/${segment}`, async ({ request, params }) => {
      const user = requireAuth(request);
      if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
      // doc 04 §43–46 — all four are ADMIN / SUPER_ADMIN only.
      if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
        return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
      }

      const order = FUEL_ORDERS.find((o) => o.id === params.id);
      if (!order) return error(404, 'RESOURCE_NOT_FOUND', 'Fuel order not found.');

      // doc 04 §9 — INVALID_ORDER_STATUS.
      const allowed: FuelOrderStatus[] = FUEL_ORDER_TRANSITIONS[order.status];
      if (!allowed.includes(target)) {
        return error(
          422,
          'INVALID_ORDER_STATUS',
          `A ${order.status.replace(/_/g, ' ').toLowerCase()} order cannot become ${target.replace(/_/g, ' ').toLowerCase()}.`,
        );
      }

      if (target === 'CANCELLED') {
        const body = (await request.json().catch(() => ({}))) as { reason?: string };
        // doc 04 §46 — a reason is mandatory, and whitespace is not a reason.
        if (!body.reason || body.reason.trim().length === 0) {
          return error(400, 'VALIDATION_ERROR', 'Validation failed', [
            { field: 'reason', message: 'reason is required' },
          ]);
        }
        order.notes = body.reason.trim();
      }

      order.status = target;
      return ok(order);
    }),
  ),

  /* ----------------------------------------------------------- deliveries */

  http.get(`${API}/deliveries`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...DELIVERIES];
    const branchId = scopeBranch(user, url.searchParams.get('branchId'));
    if (branchId) rows = rows.filter((d) => d.destinationBranchId === branchId);
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((d) => d.status === status);
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.get(`${API}/deliveries/:id`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const delivery = DELIVERIES.find((d) => d.id === params.id);
    if (!delivery) return error(404, 'RESOURCE_NOT_FOUND', 'Delivery not found.');
    if (user.role === 'MANAGER' && delivery.destinationBranchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    return ok(delivery);
  }),

  http.post(`${API}/deliveries/:id/receive`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }

    const delivery = DELIVERIES.find((d) => d.id === params.id);
    if (!delivery) return error(404, 'RESOURCE_NOT_FOUND', 'Delivery not found.');
    if (user.role === 'MANAGER' && delivery.destinationBranchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    if (delivery.status !== 'PENDING') {
      return error(
        422,
        'INVALID_DELIVERY_STATUS',
        `A ${delivery.status.toLowerCase()} delivery cannot be received.`,
      );
    }

    const body = (await request.json()) as {
      items?: Array<{
        fuelTypeId: string;
        actualQuantityLitres: number;
        discrepancyReason?: string;
      }>;
    };
    if (!body.items || body.items.length === 0) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'items', message: 'at least one item is required' },
      ]);
    }

    for (const input of body.items) {
      const item = delivery.items.find((i) => i.fuelTypeId === input.fuelTypeId);
      if (!item) {
        return error(400, 'VALIDATION_ERROR', 'Validation failed', [
          { field: 'items', message: 'unknown fuel type on this delivery' },
        ]);
      }
      // doc 09 §13 — delivery quantities must be >= 0.
      if (input.actualQuantityLitres === undefined || input.actualQuantityLitres < 0) {
        return error(400, 'VALIDATION_ERROR', 'Validation failed', [
          { field: 'actualQuantityLitres', message: 'must be zero or greater' },
        ]);
      }

      // doc 03 §42 — difference = actual - expected (negative means shortage).
      item.actualQuantityLitres = input.actualQuantityLitres;
      item.differenceLitres = input.actualQuantityLitres - item.expectedQuantityLitres;
      item.discrepancyReason = input.discrepancyReason ?? null;

      const stock = INVENTORY_STOCK.find(
        (s) => s.branchId === delivery.destinationBranchId && s.fuelTypeId === item.fuelTypeId,
      );
      if (stock) {
        stock.currentQuantityLitres += input.actualQuantityLitres;
        INVENTORY_TRANSACTIONS.unshift({
          id: crypto.randomUUID(),
          branchId: delivery.destinationBranchId,
          fuelTypeId: item.fuelTypeId,
          transactionType: 'DELIVERY',
          quantityLitres: input.actualQuantityLitres,
          balanceAfter: stock.currentQuantityLitres,
          referenceType: 'DELIVERY',
          referenceId: delivery.id,
          occurredAt: new Date().toISOString(),
        });
      }
    }

    delivery.status = 'RECEIVED';

    // doc 09 §10 / doc 04 — a received order may become PARTIALLY_DELIVERED or DELIVERED.
    const order = FUEL_ORDERS.find((o) => o.id === delivery.fuelOrderId);
    if (order && (order.status === 'IN_TRANSIT' || order.status === 'PARTIALLY_DELIVERED')) {
      const fullyReceived = order.items.every((item) => {
        const received = DELIVERIES.filter(
          (d) => d.fuelOrderId === order.id && d.status === 'RECEIVED',
        )
          .flatMap((d) => d.items)
          .filter((i) => i.fuelTypeId === item.fuelTypeId)
          .reduce((sum, i) => sum + (i.actualQuantityLitres ?? 0), 0);
        return received >= item.expectedQuantityLitres;
      });
      order.status = fullyReceived ? 'DELIVERED' : 'PARTIALLY_DELIVERED';
    }

    return ok(delivery);
  }),

  /* ----------------------------------------------------------- inventory */

  http.get(`${API}/inventory`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }
    const url = new URL(request.url);
    // doc 04 §53 — managers are restricted to their assigned branch.
    const branchId = scopeBranch(user, url.searchParams.get('branchId'));
    let rows = INVENTORY_STOCK.filter((s) => s.branchId !== undefined);
    if (branchId) rows = rows.filter((s) => s.branchId === branchId);
    const fuelTypeId = url.searchParams.get('fuelTypeId');
    if (fuelTypeId) rows = rows.filter((s) => s.fuelTypeId === fuelTypeId);
    // doc 04 §54 — this route returns a bare array, not a paginated envelope.
    return ok(rows);
  }),

  http.get(`${API}/inventory/summary`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    const branchId = scopeBranch(user, url.searchParams.get('branchId')) ?? BRANCHES[0]!.id;
    return ok({
      branchId,
      asOf: new Date().toISOString(),
      fuel: INVENTORY_STOCK.filter((s) => s.branchId === branchId).map((s) => ({
        fuelTypeId: s.fuelTypeId,
        fuelType: s.fuelTypeName,
        currentQuantityLitres: s.currentQuantityLitres,
      })),
    });
  }),

  http.get(`${API}/inventory/transactions`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...INVENTORY_TRANSACTIONS];
    const branchId = scopeBranch(user, url.searchParams.get('branchId'));
    if (branchId) rows = rows.filter((t) => t.branchId === branchId);
    const fuelTypeId = url.searchParams.get('fuelTypeId');
    if (fuelTypeId) rows = rows.filter((t) => t.fuelTypeId === fuelTypeId);
    const type = url.searchParams.get('type');
    if (type) rows = rows.filter((t) => t.transactionType === type);
    const from = url.searchParams.get('from');
    if (from) rows = rows.filter((t) => t.occurredAt >= from);
    const to = url.searchParams.get('to');
    if (to) rows = rows.filter((t) => t.occurredAt <= to);

    rows.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.post(`${API}/inventory/adjustments`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    // doc 04 §57 — ADMIN, SUPER_ADMIN only.
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    const body = (await request.json()) as {
      branchId?: string;
      fuelTypeId?: string;
      quantityLitres?: number;
      reason?: string;
    };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.branchId) fieldErrors.push({ field: 'branchId', message: 'branchId is required' });
    if (!body.fuelTypeId)
      fieldErrors.push({ field: 'fuelTypeId', message: 'fuelTypeId is required' });
    if (body.quantityLitres === undefined || body.quantityLitres === 0) {
      fieldErrors.push({ field: 'quantityLitres', message: 'quantityLitres is required' });
    }
    // PRD rule 10 — an adjustment must carry an explanation.
    if (!body.reason) fieldErrors.push({ field: 'reason', message: 'reason is required' });
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    const stock = INVENTORY_STOCK.find(
      (s) => s.branchId === body.branchId && s.fuelTypeId === body.fuelTypeId,
    );
    if (!stock)
      return error(404, 'RESOURCE_NOT_FOUND', 'No inventory record for that branch and fuel type.');
    if (stock.currentQuantityLitres + body.quantityLitres! < 0) {
      return error(422, 'INSUFFICIENT_INVENTORY', 'This adjustment would drive stock below zero.');
    }

    stock.currentQuantityLitres += body.quantityLitres!;
    const tx = {
      id: crypto.randomUUID(),
      branchId: body.branchId!,
      fuelTypeId: body.fuelTypeId!,
      transactionType: 'ADJUSTMENT' as const,
      quantityLitres: body.quantityLitres!,
      balanceAfter: stock.currentQuantityLitres,
      referenceType: 'ADJUSTMENT',
      referenceId: null,
      occurredAt: new Date().toISOString(),
      reason: body.reason!,
    };
    INVENTORY_TRANSACTIONS.unshift(tx);
    return HttpResponse.json({ data: tx }, { status: 201 });
  }),

  /* --------------------------------------------------------------- sales */

  http.get(`${API}/sales`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...SALES];
    const branchId = scopeBranch(user, url.searchParams.get('branchId'));
    if (branchId) rows = rows.filter((s) => s.branchId === branchId);
    const fuelTypeId = url.searchParams.get('fuelTypeId');
    if (fuelTypeId) rows = rows.filter((s) => s.fuelTypeId === fuelTypeId);
    const recordMode = url.searchParams.get('recordMode');
    if (recordMode) rows = rows.filter((s) => (s.recordMode ?? 'SINGLE') === recordMode);
    // The admin confirmation gate (product decision 2026-10); legacy rows
    // read APPROVED, matching the migration backfill.
    const approvalStatus = url.searchParams.get('approvalStatus');
    if (approvalStatus) {
      rows = rows.filter((s) => (s.approvalStatus ?? 'APPROVED') === approvalStatus);
    }
    // from/to are bare business days, so only the date part participates.
    const from = url.searchParams.get('from');
    if (from) rows = rows.filter((s) => s.soldAt.slice(0, 10) >= from);
    const to = url.searchParams.get('to');
    if (to) rows = rows.filter((s) => s.soldAt.slice(0, 10) <= to);

    rows.sort((a, b) => +new Date(b.soldAt) - +new Date(a.soldAt));
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.post(`${API}/sales`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    // doc 04 §59 — MANAGER, ADMIN, SUPER_ADMIN.
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }

    const body = (await request.json()) as {
      branchId?: string;
      fuelTypeId?: string;
      litresSold?: number;
      soldAt?: string;
    };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.branchId) fieldErrors.push({ field: 'branchId', message: 'branchId is required' });
    if (!body.fuelTypeId)
      fieldErrors.push({ field: 'fuelTypeId', message: 'fuelTypeId is required' });
    if (!body.litresSold || body.litresSold <= 0) {
      fieldErrors.push({ field: 'litresSold', message: 'litresSold must be greater than 0' });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    // doc 04 §93 — a manager is pinned to their branch.
    if (user.role === 'MANAGER' && body.branchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }

    const soldAt = body.soldAt ? new Date(body.soldAt) : new Date();
    const fuel = FUEL_TYPES.find((f) => f.id === body.fuelTypeId);
    if (!fuel) return error(404, 'RESOURCE_NOT_FOUND', 'Fuel type not found.');
    // doc 08 §61 — the fuel type must be active.
    if (fuel.status !== 'ACTIVE') {
      return error(422, 'INVALID_OPERATION', 'This fuel type is not active.');
    }

    // doc 08 §33 — the client must never determine the authoritative price.
    const price = resolvePrice(user.businessId ?? BUSINESS_ID, fuel.id, soldAt);
    if (!price) {
      return error(
        422,
        'INVALID_FUEL_PRICE',
        'No price is configured for this fuel type at this time.',
      );
    }

    const available = currentStock(body.branchId!, fuel.id);
    if (body.litresSold! > available) {
      return error(
        422,
        'INSUFFICIENT_INVENTORY',
        `There is not enough ${fuel.code} inventory available.`,
      );
    }

    const stock = INVENTORY_STOCK.find(
      (s) => s.branchId === body.branchId && s.fuelTypeId === fuel.id,
    );
    if (stock) {
      stock.currentQuantityLitres -= body.litresSold!;
      INVENTORY_TRANSACTIONS.unshift({
        id: crypto.randomUUID(),
        branchId: body.branchId!,
        fuelTypeId: fuel.id,
        transactionType: 'SALE',
        quantityLitres: -body.litresSold!,
        balanceAfter: stock.currentQuantityLitres,
        referenceType: 'SALE',
        referenceId: null,
        occurredAt: soldAt.toISOString(),
      });
    }

    saleCounter += 1;
    const sale: Sale = {
      id: crypto.randomUUID(),
      // doc 03 §53 — SALE-2026-000001, unique per business.
      saleNumber: `SALE-${soldAt.getFullYear()}-${String(saleCounter).padStart(6, '0')}`,
      branchId: body.branchId!,
      fuelTypeId: fuel.id,
      fuelTypeName: fuel.code,
      litresSold: body.litresSold!,
      unitPrice: price.pricePerLitre,
      totalAmount: body.litresSold! * price.pricePerLitre,
      ...approvalStamp(user),
      rejectionReason: null,
      soldAt: soldAt.toISOString(),
      voidedAt: null,
      voidReason: null,
    };
    SALES.unshift(sale);
    notifyAdminsOfSale(
      sale,
      `Sale recorded: ${sale.saleNumber}`,
      `${user.firstName} ${user.lastName} recorded ${sale.litresSold} L of ${fuel.code} at ${BRANCHES.find((b) => b.id === sale.branchId)?.name ?? 'a branch'} for ${sale.totalAmount}.`,
    );
    return HttpResponse.json({ data: sale }, { status: 201 });
  }),

  /*
   * Product decision (2026-10) — the day-total upsert. The manager enters the
   * branch's running total for one fuel on one business day; only the delta
   * between the previous and the new figure moves stock. `0` clears the day
   * and restores its litres; an unchanged figure is a no-op returning the row.
   */
  http.post(`${API}/sales/day-total`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }

    const body = (await request.json()) as {
      branchId?: string;
      fuelTypeId?: string;
      totalLitres?: number;
      date?: string;
    };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.branchId) fieldErrors.push({ field: 'branchId', message: 'branchId is required' });
    if (!body.fuelTypeId)
      fieldErrors.push({ field: 'fuelTypeId', message: 'fuelTypeId is required' });
    if (body.totalLitres === undefined || body.totalLitres < 0) {
      fieldErrors.push({ field: 'totalLitres', message: 'totalLitres cannot be negative' });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    // doc 04 §93 — a manager is pinned to their branch.
    if (user.role === 'MANAGER' && body.branchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }

    const today = new Date().toISOString().slice(0, 10);
    const date = body.date ?? today;
    if (date > today) {
      return error(422, 'INVALID_OPERATION', 'A future day cannot be recorded.');
    }

    const fuel = FUEL_TYPES.find((f) => f.id === body.fuelTypeId);
    if (!fuel) return error(404, 'RESOURCE_NOT_FOUND', 'Fuel type not found.');
    if (fuel.status !== 'ACTIVE') {
      return error(422, 'INVALID_OPERATION', 'This fuel type is not active.');
    }

    const branchId = body.branchId!;
    const total = body.totalLitres!;
    const branchName = BRANCHES.find((b) => b.id === branchId)?.name ?? 'a branch';
    // sold_at is pinned to noon of the business day, matching the backend.
    const soldAt = new Date(`${date}T12:00:00.000Z`);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const stock = INVENTORY_STOCK.find((s) => s.branchId === branchId && s.fuelTypeId === fuel.id);

    const existing = SALES.find(
      (s) =>
        s.branchId === branchId &&
        s.fuelTypeId === fuel.id &&
        !s.voidedAt &&
        s.recordMode === 'DAY_TOTAL' &&
        s.soldAt.slice(0, 10) === date,
    );

    const moveStock = (deltaLitres: number, reason?: string) => {
      if (!stock || deltaLitres === 0) return;
      stock.currentQuantityLitres -= deltaLitres;
      INVENTORY_TRANSACTIONS.unshift({
        id: crypto.randomUUID(),
        branchId,
        fuelTypeId: fuel.id,
        transactionType: deltaLitres > 0 ? 'SALE' : 'CORRECTION',
        quantityLitres: -deltaLitres,
        balanceAfter: stock.currentQuantityLitres,
        referenceType: 'SALE',
        referenceId: existing?.id ?? null,
        occurredAt: new Date().toISOString(),
        ...(reason ? { reason } : {}),
      });
    };

    // No figure yet: create the day row (a zero total is a no-op).
    if (!existing) {
      if (total === 0) return ok(null);

      // Priced at the interval in force NOW, not the pinned noon instant, so
      // an admin's mid-day price change applies to everything recorded after
      // it (mirrors the API).
      const price = resolvePrice(user.businessId ?? BUSINESS_ID, fuel.id, new Date());
      if (!price) {
        return error(
          422,
          'INVALID_FUEL_PRICE',
          'No price is configured for this fuel type at this time.',
        );
      }
      if (total > currentStock(branchId, fuel.id)) {
        return error(
          422,
          'INSUFFICIENT_INVENTORY',
          `There is not enough ${fuel.code} inventory available.`,
        );
      }

      saleCounter += 1;
      const sale: Sale = {
        id: crypto.randomUUID(),
        saleNumber: `SALE-${soldAt.getUTCFullYear()}-${String(saleCounter).padStart(6, '0')}`,
        branchId,
        fuelTypeId: fuel.id,
        fuelTypeName: fuel.code,
        litresSold: total,
        unitPrice: price.pricePerLitre,
        totalAmount: round2(total * price.pricePerLitre),
        recordMode: 'DAY_TOTAL',
        ...approvalStamp(user),
        rejectionReason: null,
        soldAt: soldAt.toISOString(),
        voidedAt: null,
        voidReason: null,
      };
      SALES.unshift(sale);
      if (stock) {
        stock.currentQuantityLitres -= total;
        INVENTORY_TRANSACTIONS.unshift({
          id: crypto.randomUUID(),
          branchId,
          fuelTypeId: fuel.id,
          transactionType: 'SALE',
          quantityLitres: -total,
          balanceAfter: stock.currentQuantityLitres,
          referenceType: 'SALE',
          referenceId: sale.id,
          occurredAt: new Date().toISOString(),
        });
      }
      notifyAdminsOfSale(
        sale,
        `Day total recorded: ${sale.saleNumber}`,
        `${user.firstName} ${user.lastName} recorded ${total} L of ${fuel.code} at ${branchName} (${date}).`,
      );
      return ok(sale);
    }

    // An unchanged figure is a no-op that returns the current row.
    if (total === existing.litresSold) return ok(existing);

    const previous = existing.litresSold;

    // 0 clears the day and returns its litres to stock.
    if (total === 0) {
      existing.voidedAt = new Date().toISOString();
      existing.voidReason = 'Day total cleared';
      if (stock) {
        stock.currentQuantityLitres += previous;
        INVENTORY_TRANSACTIONS.unshift({
          id: crypto.randomUUID(),
          branchId,
          fuelTypeId: fuel.id,
          transactionType: 'CORRECTION',
          quantityLitres: previous,
          balanceAfter: stock.currentQuantityLitres,
          referenceType: 'SALE',
          referenceId: existing.id,
          occurredAt: new Date().toISOString(),
          reason: 'Day total cleared',
        });
      }
      notifyAdminsOfSale(
        existing,
        `Day total cleared: ${existing.saleNumber}`,
        `${user.firstName} ${user.lastName} cleared the ${fuel.code} day total at ${branchName} for ${date}; ${previous} L returned to stock.`,
      );
      return ok(null);
    }

    /*
     * The whole day figure is (re)valued at the price in force NOW — never a
     * weighted average of the day's intervals — so the row always balances
     * exactly as litres x the admin's current price. The ledger still moves
     * only the delta, and a revision re-opens the approval gate (mirrors the
     * API).
     */
    const price = resolvePrice(user.businessId ?? BUSINESS_ID, fuel.id, new Date());
    if (!price) {
      return error(
        422,
        'INVALID_FUEL_PRICE',
        'No price is configured for this fuel type at this time.',
      );
    }

    if (total > previous) {
      const delta = total - previous;
      if (delta > currentStock(branchId, fuel.id)) {
        return error(
          422,
          'INSUFFICIENT_INVENTORY',
          `There is not enough ${fuel.code} inventory available.`,
        );
      }
      moveStock(delta);
    } else {
      moveStock(-(previous - total), 'Day total revised downwards');
    }

    existing.litresSold = total;
    existing.unitPrice = price.pricePerLitre;
    existing.totalAmount = round2(total * price.pricePerLitre);
    Object.assign(existing, approvalStamp(user), { rejectionReason: null });
    notifyAdminsOfSale(
      existing,
      `Day total revised: ${existing.saleNumber}`,
      `${user.firstName} ${user.lastName} revised the ${fuel.code} day total at ${branchName} for ${date}: ${previous} L -> ${total} L.`,
    );
    return ok(existing);
  }),

  /*
   * Product decision (2026-10) — the admin confirmation gate. Approval is
   * workflow metadata: the figures count exactly the same whatever the
   * status, so nothing recomputes here. A REJECTED figure can be approved
   * too, reversing a refusal.
   */
  http.post(`${API}/sales/:id/approve`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }
    const sale = SALES.find((s) => s.id === params.id);
    if (!sale) return error(404, 'RESOURCE_NOT_FOUND', 'Sale not found.');
    if (sale.voidedAt) return error(422, 'INVALID_OPERATION', 'A voided sale cannot be approved.');
    if (sale.approvalStatus === 'APPROVED') {
      return error(422, 'INVALID_OPERATION', 'This sale has already been approved.');
    }

    sale.approvalStatus = 'APPROVED';
    sale.approvedAt = new Date().toISOString();
    sale.rejectionReason = null;
    notifyRecorderOfDecision(
      sale,
      'SALE_APPROVED',
      `Sale approved: ${sale.saleNumber}`,
      `${user.firstName} ${user.lastName} approved your figure of ${sale.litresSold} L of ${sale.fuelTypeName ?? 'fuel'} (${sale.totalAmount}).`,
    );
    return ok(sale);
  }),

  /*
   * Product decision (2026-10) — refuse a figure that is awaiting review,
   * with a mandatory reason. The figures stay on the books; the manager is
   * notified and their revision returns the row to PENDING.
   */
  http.post(`${API}/sales/:id/reject`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }
    const sale = SALES.find((s) => s.id === params.id);
    if (!sale) return error(404, 'RESOURCE_NOT_FOUND', 'Sale not found.');
    if (sale.voidedAt) return error(422, 'INVALID_OPERATION', 'A voided sale cannot be rejected.');
    if (sale.approvalStatus !== 'PENDING') {
      return error(422, 'INVALID_OPERATION', 'Only a sale awaiting review can be rejected.');
    }

    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim() ?? '';
    if (reason.length < 3) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'reason', message: 'a rejection reason is required and must be meaningful' },
      ]);
    }

    sale.approvalStatus = 'REJECTED';
    sale.approvedAt = null;
    sale.rejectionReason = reason;
    notifyRecorderOfDecision(
      sale,
      'SALE_REJECTED',
      `Sale rejected: ${sale.saleNumber}`,
      `Your figure of ${sale.litresSold} L of ${sale.fuelTypeName ?? 'fuel'} was rejected: ${reason}` +
        (sale.recordMode === 'DAY_TOTAL'
          ? ' Revise the day total to submit a corrected figure.'
          : ' Contact an admin to void the sale if it must be reversed.'),
    );
    return ok(sale);
  }),

  http.post(`${API}/sales/:id/void`, async ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    // doc 04 §63 — only ADMIN / SUPER_ADMIN may void.
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }
    const sale = SALES.find((s) => s.id === params.id);
    if (!sale) return error(404, 'RESOURCE_NOT_FOUND', 'Sale not found.');
    if (sale.voidedAt) return error(422, 'INVALID_OPERATION', 'This sale is already voided.');

    const body = (await request.json()) as { reason?: string };
    if (!body.reason) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', [
        { field: 'reason', message: 'reason is required' },
      ]);
    }

    sale.voidedAt = new Date().toISOString();
    sale.voidReason = body.reason!;

    // doc 04 §63 — voiding must generate an inventory correction, not delete history.
    const stock = INVENTORY_STOCK.find(
      (s) => s.branchId === sale.branchId && s.fuelTypeId === sale.fuelTypeId,
    );
    if (stock) {
      stock.currentQuantityLitres += sale.litresSold;
      INVENTORY_TRANSACTIONS.unshift({
        id: crypto.randomUUID(),
        branchId: sale.branchId,
        fuelTypeId: sale.fuelTypeId,
        transactionType: 'CORRECTION',
        quantityLitres: sale.litresSold,
        balanceAfter: stock.currentQuantityLitres,
        referenceType: 'SALE',
        referenceId: sale.id,
        occurredAt: new Date().toISOString(),
        reason: body.reason!,
      });
    }

    return ok(sale);
  }),

  /* -------------------------------------------------------- daily reports */

  http.get(`${API}/daily-reports`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...DAILY_REPORTS];
    const branchId = scopeBranch(user, url.searchParams.get('branchId'));
    if (branchId) rows = rows.filter((r) => r.branchId === branchId);
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((r) => r.status === status);
    const from = url.searchParams.get('from');
    if (from) rows = rows.filter((r) => r.reportDate >= from);
    const to = url.searchParams.get('to');
    if (to) rows = rows.filter((r) => r.reportDate <= to);

    rows.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  /*
   * Product decision (2026-10) — the admin roll-up: every manager sale record
   * grouped by (business day, branch), with its per-fuel split and the
   * branch's incident counts. ADMIN / SUPER_ADMIN only.
   */
  http.get(`${API}/daily-reports/summary`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }

    const url = new URL(request.url);
    const branchId = url.searchParams.get('branchId');
    const businessId = url.searchParams.get('businessId');
    const defaultFrom = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return d.toISOString().slice(0, 10);
    })();
    const from = url.searchParams.get('from') ?? defaultFrom;
    const to = url.searchParams.get('to') ?? new Date().toISOString().slice(0, 10);

    const visible = (id: string) => {
      const branch = BRANCHES.find((b) => b.id === id);
      if (!branch) return false;
      if (branchId && branch.id !== branchId) return false;
      if (businessId && branch.businessId !== businessId) return false;
      return user.role === 'SUPER_ADMIN' || branch.businessId === user.businessId;
    };

    const groups = new Map<string, DailySalesSummaryRow>();
    for (const sale of SALES) {
      if (sale.voidedAt) continue;
      const date = sale.soldAt.slice(0, 10);
      if (date < from || date > to) continue;
      if (!visible(sale.branchId)) continue;

      const branch = BRANCHES.find((b) => b.id === sale.branchId)!;
      const key = `${sale.branchId}|${date}`;
      const row = groups.get(key) ?? {
        date,
        businessId: branch.businessId,
        businessName: BUSINESS.name,
        branchId: branch.id,
        branchName: branch.name,
        saleCount: 0,
        totalLitres: 0,
        totalRevenue: 0,
        incidentCount: 0,
        openIncidentCount: 0,
        fuels: [],
      };
      row.saleCount += 1;
      row.totalLitres += sale.litresSold;
      row.totalRevenue += sale.totalAmount;
      const fuel = row.fuels.find((f) => f.fuelTypeId === sale.fuelTypeId);
      if (fuel) {
        fuel.litresSold += sale.litresSold;
        fuel.revenue += sale.totalAmount;
      } else {
        row.fuels.push({
          fuelTypeId: sale.fuelTypeId,
          fuelTypeName: sale.fuelTypeName ?? FUEL_TYPES.find((f) => f.id === sale.fuelTypeId)?.code,
          litresSold: sale.litresSold,
          revenue: sale.totalAmount,
        });
      }
      groups.set(key, row);
    }

    // Incidents attach to an existing day row; a day with no sales records
    // does not produce a roll-up row.
    for (const incident of INCIDENT_REPORTS) {
      if (incident.incidentDate < from || incident.incidentDate > to) continue;
      if (!visible(incident.branchId)) continue;
      const row = groups.get(`${incident.branchId}|${incident.incidentDate}`);
      if (!row) continue;
      row.incidentCount += 1;
      if (incident.status === 'OPEN') row.openIncidentCount += 1;
    }

    const rows = [...groups.values()].sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (a.branchName ?? '').localeCompare(b.branchName ?? ''),
    );
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  // The drawer re-reads a single report so its actions act on fresh data.
  http.get(`${API}/daily-reports/:id`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const report = DAILY_REPORTS.find((r) => r.id === params.id);
    if (!report) return error(404, 'RESOURCE_NOT_FOUND', 'Daily report not found.');
    // doc 04 §93 — a manager must never see another branch's data.
    if (user.role === 'MANAGER' && report.branchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    return ok(report);
  }),

  http.post(`${API}/daily-reports`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }
    const body = (await request.json()) as {
      branchId?: string;
      reportDate?: string;
      managerNotes?: string;
    };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.branchId) fieldErrors.push({ field: 'branchId', message: 'branchId is required' });
    if (!body.reportDate)
      fieldErrors.push({ field: 'reportDate', message: 'reportDate is required' });
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    if (user.role === 'MANAGER' && body.branchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }

    // doc 03 §56 — UNIQUE (branch_id, report_date)
    if (
      DAILY_REPORTS.some((r) => r.branchId === body.branchId && r.reportDate === body.reportDate)
    ) {
      return error(
        409,
        'REPORT_ALREADY_EXISTS',
        'A report already exists for this branch and date.',
      );
    }

    // doc 04 §66 — every figure is backend-calculated from sales and deliveries.
    const branchId = body.branchId!;
    const date = body.reportDate!;
    const branchSales = SALES.filter(
      (s) => s.branchId === branchId && !s.voidedAt && s.soldAt.slice(0, 10) === date,
    );
    const received = DELIVERIES.filter(
      (d) =>
        d.destinationBranchId === branchId &&
        d.status === 'RECEIVED' &&
        d.deliveredAt.slice(0, 10) === date,
    ).reduce((sum, d) => sum + d.items.reduce((s, i) => s + (i.actualQuantityLitres ?? 0), 0), 0);

    const opening = INVENTORY_STOCK.filter((s) => s.branchId === branchId).reduce(
      (sum, s) => sum + s.currentQuantityLitres,
      0,
    );
    const sold = branchSales.reduce((sum, s) => sum + s.litresSold, 0);

    const report: DailyReport = {
      id: crypto.randomUUID(),
      branchId,
      reportDate: date,
      status: 'DRAFT',
      openingStockLitres: opening,
      totalReceivedLitres: received,
      totalSoldLitres: sold,
      closingStockLitres: opening + received - sold,
      totalRevenue: branchSales.reduce((sum, s) => sum + s.totalAmount, 0),
      managerNotes: body.managerNotes ?? null,
    };
    DAILY_REPORTS.unshift(report);
    return HttpResponse.json({ data: report }, { status: 201 });
  }),

  ...(
    [
      ['submit', 'SUBMITTED'],
      ['approve', 'APPROVED'],
      ['reject', 'REJECTED'],
      ['resubmit', 'DRAFT'],
    ] as const
  ).map(([segment, target]) =>
    http.post(`${API}/daily-reports/:id/${segment}`, async ({ request, params }) => {
      const user = requireAuth(request);
      if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');

      // doc 04 §68-71 — managers submit/resubmit; admins approve/reject.
      const needsReviewer = target === 'APPROVED' || target === 'REJECTED';
      if (needsReviewer && !requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
        return error(
          403,
          'BUSINESS_ACCESS_DENIED',
          'Only administrators can review daily reports.',
        );
      }
      if (!needsReviewer && user.role !== 'MANAGER') {
        return error(403, 'BUSINESS_ACCESS_DENIED', 'Only managers can submit daily reports.');
      }

      const report = DAILY_REPORTS.find((r) => r.id === params.id);
      if (!report) return error(404, 'RESOURCE_NOT_FOUND', 'Daily report not found.');
      if (user.role === 'MANAGER' && report.branchId !== user.branchId) {
        return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
      }

      if (target === 'SUBMITTED' && report.status !== 'DRAFT') {
        return error(422, 'REPORT_NOT_SUBMITTABLE', 'Only a draft report can be submitted.');
      }
      if (
        target === 'APPROVED' &&
        report.status !== 'SUBMITTED' &&
        report.status !== 'UNDER_REVIEW'
      ) {
        return error(422, 'REPORT_NOT_APPROVABLE', 'Only a submitted report can be approved.');
      }
      // doc 04 §71 — resubmit returns a REJECTED report to DRAFT.
      if (segment === 'resubmit' && report.status !== 'REJECTED') {
        return error(422, 'INVALID_REPORT_STATUS', 'Only a rejected report can be resubmitted.');
      }

      if (target === 'REJECTED') {
        const body = (await request.json().catch(() => ({}))) as { reason?: string };
        // doc 04 §70 — the reviewer must give a reason.
        if (!body.reason) {
          return error(400, 'VALIDATION_ERROR', 'Validation failed', [
            { field: 'reason', message: 'reason is required' },
          ]);
        }
        report.rejectionReason = body.reason!;
      }

      report.status = target;
      if (needsReviewer) {
        report.reviewedBy = user.id;
        report.reviewedAt = new Date().toISOString();
      }
      return ok(report);
    }),
  ),

  /* ---------------------------------------------------------- incidents */

  http.get(`${API}/incident-reports`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...INCIDENT_REPORTS];
    const branchId = scopeBranch(user, url.searchParams.get('branchId'));
    if (branchId) rows = rows.filter((r) => r.branchId === branchId);
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((r) => r.status === status);
    const from = url.searchParams.get('from');
    if (from) rows = rows.filter((r) => r.incidentDate >= from);
    const to = url.searchParams.get('to');
    if (to) rows = rows.filter((r) => r.incidentDate <= to);

    rows.sort(
      (a, b) =>
        b.incidentDate.localeCompare(a.incidentDate) || b.createdAt.localeCompare(a.createdAt),
    );
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  http.get(`${API}/incident-reports/:id`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const incident = INCIDENT_REPORTS.find((r) => r.id === params.id);
    if (!incident) return error(404, 'RESOURCE_NOT_FOUND', 'Incident report not found.');
    // doc 04 §93 — a manager must never see another branch's data.
    if (user.role === 'MANAGER' && incident.branchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }
    return ok(incident);
  }),

  http.post(`${API}/incident-reports`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }

    const body = (await request.json()) as {
      branchId?: string;
      incidentDate?: string;
      title?: string;
      description?: string;
    };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.branchId) fieldErrors.push({ field: 'branchId', message: 'branchId is required' });
    if (!body.title || body.title.trim().length < 3) {
      fieldErrors.push({ field: 'title', message: 'Give the incident a short title' });
    }
    if (!body.description || body.description.trim().length < 3) {
      fieldErrors.push({ field: 'description', message: 'Describe what happened' });
    }
    if (fieldErrors.length > 0)
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);

    if (user.role === 'MANAGER' && body.branchId !== user.branchId) {
      return error(403, 'BRANCH_ACCESS_DENIED', 'Access denied.');
    }

    const today = new Date().toISOString().slice(0, 10);
    const incidentDate = body.incidentDate ?? today;
    if (incidentDate > today) {
      return error(422, 'INVALID_OPERATION', 'An incident cannot be dated in the future.');
    }

    const branch = BRANCHES.find((b) => b.id === body.branchId);
    if (!branch) return error(404, 'RESOURCE_NOT_FOUND', 'Branch not found.');

    const incident: IncidentReport = {
      id: crypto.randomUUID(),
      branchId: branch.id,
      branchName: branch.name,
      incidentDate,
      title: body.title!.trim(),
      description: body.description!.trim(),
      status: 'OPEN',
      reportedBy: user.id,
      reportedByName: `${user.firstName} ${user.lastName}`.trim(),
      reviewedBy: null,
      reviewedByName: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };
    INCIDENT_REPORTS.unshift(incident);
    return HttpResponse.json({ data: incident }, { status: 201 });
  }),

  // Product decision (2026-10) — a single OPEN -> REVIEWED flip; no workflow.
  http.post(`${API}/incident-reports/:id/review`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Only administrators can review incidents.');
    }
    const incident = INCIDENT_REPORTS.find((r) => r.id === params.id);
    if (!incident) return error(404, 'RESOURCE_NOT_FOUND', 'Incident report not found.');
    if (incident.status === 'REVIEWED') {
      return error(422, 'INVALID_OPERATION', 'This incident has already been reviewed.');
    }
    incident.status = 'REVIEWED';
    incident.reviewedBy = user.id;
    incident.reviewedByName = `${user.firstName} ${user.lastName}`.trim();
    incident.reviewedAt = new Date().toISOString();
    return ok(incident);
  }),

  /* ------------------------------------------------------- notifications */

  http.get(`${API}/notifications`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const url = new URL(request.url);
    let rows = [...NOTIFICATIONS];
    const status = url.searchParams.get('status');
    if (status) rows = rows.filter((n) => n.status === status);
    const type = url.searchParams.get('type');
    if (type) rows = rows.filter((n) => n.type === type);
    rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  /* ---------------------------------------------------------------- push */
  /*
   * Simulated counterpart of the real push endpoints. Declared before
   * `notifications/:id/read` for the same static-vs-param reason as
   * `read-all`. Push itself cannot reach the MSW worker, so these only manage
   * the registry the toggle reads; `lib/push.ts` renders the alerts in-page.
   */

  http.get(`${API}/notifications/push`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    return ok({
      enabled: true,
      applicationServerKey: MOCK_VAPID_PUBLIC_KEY,
      subscriptions: PUSH_SUBSCRIPTIONS.filter((s) => s.userId === user.id).map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
      })),
    });
  }),

  http.post(`${API}/notifications/push/subscriptions`, async ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');

    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const fieldErrors: ApiFieldError[] = [];
    if (!body.endpoint) fieldErrors.push({ field: 'endpoint', message: 'endpoint is required' });
    if (!body.keys?.p256dh) {
      fieldErrors.push({ field: 'keys.p256dh', message: 'keys.p256dh is required' });
    }
    if (!body.keys?.auth) fieldErrors.push({ field: 'keys.auth', message: 'keys.auth is required' });
    if (fieldErrors.length > 0) {
      return error(400, 'VALIDATION_ERROR', 'Validation failed', fieldErrors);
    }

    // Idempotent on endpoint, exactly like the real upsert.
    const existing = PUSH_SUBSCRIPTIONS.find((s) => s.endpoint === body.endpoint);
    if (existing) {
      // The device now belongs to whoever registered it last (shared device).
      existing.userId = user.id;
      existing.createdAt = new Date().toISOString();
      return ok({ id: existing.id, created: false });
    }

    const created = {
      id: crypto.randomUUID(),
      userId: user.id,
      endpoint: body.endpoint!,
      createdAt: new Date().toISOString(),
    };
    PUSH_SUBSCRIPTIONS.unshift(created);
    return ok({ id: created.id, created: true });
  }),

  // Static sibling of the :id route — must stay ahead of it.
  http.delete(`${API}/notifications/push/subscriptions/all`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    for (let index = PUSH_SUBSCRIPTIONS.length - 1; index >= 0; index -= 1) {
      if (PUSH_SUBSCRIPTIONS[index]!.userId === user.id) PUSH_SUBSCRIPTIONS.splice(index, 1);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API}/notifications/push/subscriptions/:id`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const index = PUSH_SUBSCRIPTIONS.findIndex(
      (s) => s.id === params.id && s.userId === user.id,
    );
    // A foreign id deletes nothing and still answers 204, as the real API does.
    if (index >= 0) PUSH_SUBSCRIPTIONS.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/notifications/push/test`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    return ok({ sent: PUSH_SUBSCRIPTIONS.filter((s) => s.userId === user.id).length });
  }),

  http.patch(`${API}/notifications/:id/read`, ({ request, params }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    const n = NOTIFICATIONS.find((x) => x.id === params.id);
    if (!n) return error(404, 'RESOURCE_NOT_FOUND', 'Notification not found.');
    n.status = 'READ';
    n.readAt = new Date().toISOString();
    return ok(n);
  }),

  // doc 04 §73 — a static sibling path; must not be captured by :id.
  http.patch(`${API}/notifications/read-all`, () => {
    for (const n of NOTIFICATIONS) {
      n.status = 'READ';
      n.readAt ??= new Date().toISOString();
    }
    return ok({ updated: NOTIFICATIONS.length });
  }),

  /* ------------------------------------------------------------ dashboard */

  http.get(`${API}/dashboard/admin`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }
    // doc 04 §76 — the branch switcher narrows the overview to one branch.
    const branchId = scopeBranch(user, new URL(request.url).searchParams.get('branchId'));
    return ok(buildAdminDashboard(branchId));
  }),

  http.get(`${API}/dashboard/manager`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (user.role !== 'MANAGER') return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    return ok(buildManagerDashboard(user.branchId ?? BRANCHES[0]!.id));
  }),

  /* ----------------------------------------------------------- audit logs */

  http.get(`${API}/audit-logs`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (!requireRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return error(403, 'BUSINESS_ACCESS_DENIED', 'Access denied.');
    }
    const url = new URL(request.url);
    let rows = AUDIT_LOGS.filter(
      (l) => user.role === 'SUPER_ADMIN' || l.businessId === user.businessId,
    );
    const action = url.searchParams.get('action');
    if (action) rows = rows.filter((l) => l.action === action);
    const resourceType = url.searchParams.get('resourceType');
    if (resourceType) rows = rows.filter((l) => l.resourceType === resourceType);
    const userId = url.searchParams.get('userId');
    if (userId) rows = rows.filter((l) => l.userId === userId);
    const { slice, meta } = paginate(rows, url);
    return ok(slice, meta);
  }),

  /* ---------------------------------------------------------------- users */

  http.get(`${API}/me/branches`, ({ request }) => {
    const user = requireAuth(request);
    if (!user) return error(401, 'AUTH_TOKEN_EXPIRED', 'Authentication required.');
    if (user.role === 'MANAGER') {
      const b = BRANCHES.find((x) => x.id === user.branchId);
      return ok(b ? [b] : []);
    }
    const rows = BRANCHES.filter((b) => b.businessId === user.businessId);
    return ok(rows);
  }),
];

export { currentStock };
