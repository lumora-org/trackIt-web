import { describe, expect, it } from 'vitest';

import { getCurrentUser, login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import { createBranch, listBranches } from '@/api/branches.api';
import { createBusiness, listBusinesses } from '@/api/businesses.api';
import {
  createUser,
  createUserSchema,
  deleteUser,
  listUsers,
  setUserStatus,
  updateMyAvatar,
  updateUser,
  updateUserSchema,
} from '@/api/users.api';
import { BRANCHES, USERS } from '@/mocks/data';

async function asAdmin() {
  resetApiClientForTests();
  const session = await login({ email: 'admin@kbyglobal.com', password: 'Password123!' });
  setAccessToken(session.accessToken);
}

async function asManager() {
  resetApiClientForTests();
  const session = await login({ email: 'manager@kbyglobal.com', password: 'Password123!' });
  setAccessToken(session.accessToken);
}

async function asSuperAdmin() {
  resetApiClientForTests();
  const session = await login({
    email: 'superadmin@kbyglobal.com',
    password: 'Password123!',
  });
  setAccessToken(session.accessToken);
}

describe('branches (doc 04 §21-24)', () => {
  it('lists the business branches for an admin', async () => {
    await asAdmin();
    const { data } = await listBranches({ limit: 100 });
    expect(data.length).toBe(BRANCHES.length);
  });

  it('returns only the assigned branch for a manager (doc 04 §21.1)', async () => {
    await asManager();
    const { data } = await listBranches({ limit: 100 });
    expect(data).toHaveLength(1);
  });

  it('creates a branch', async () => {
    await asAdmin();
    const created = await createBranch({
      name: 'KBY Apapa',
      code: 'KBY-APAPA',
      address: 'Apapa, Lagos',
    });
    expect(created.status).toBe('ACTIVE');
    expect(created.code).toBe('KBY-APAPA');
  });

  it('rejects a duplicate code (UNIQUE business_id + code, doc 03 §27)', async () => {
    await asAdmin();
    await expect(
      createBranch({ name: 'Duplicate', code: BRANCHES[0]!.code, address: 'Somewhere' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses a manager creating a branch (doc 04 §22)', async () => {
    await asManager();
    await expect(createBranch({ name: 'X', code: 'KBY-X', address: 'Y' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('businesses (doc 04 §20 — SUPER_ADMIN only)', () => {
  it('allows a super admin to list businesses', async () => {
    await asSuperAdmin();
    const { data } = await listBusinesses();
    expect(data.length).toBeGreaterThan(0);
  });

  it('refuses an admin', async () => {
    await asAdmin();
    await expect(listBusinesses()).rejects.toMatchObject({ statusCode: 403 });
  });

  it('creates a business as a super admin', async () => {
    await asSuperAdmin();
    const created = await createBusiness({ name: 'Test Fuels Ltd', registrationNumber: 'RC1' });
    expect(created.name).toBe('Test Fuels Ltd');
    expect(created.status).toBe('ACTIVE');
  });
});

describe('users (doc 04 §17-19, doc 07 §56-58)', () => {
  it('lists users in the admin business', async () => {
    await asAdmin();
    const { data } = await listUsers({ limit: 100 });
    expect(data.every((u) => u.businessId === USERS[1]!.businessId)).toBe(true);
  });

  it('filters by role', async () => {
    await asAdmin();
    const { data } = await listUsers({ role: 'MANAGER', limit: 100 });
    expect(data.every((u) => u.role === 'MANAGER')).toBe(true);
  });

  it('filters by search across name and email', async () => {
    await asAdmin();
    const { data } = await listUsers({ search: 'tunde', limit: 100 });
    expect(data).toHaveLength(1);
    expect(data[0]!.firstName).toBe('Tunde');
  });

  it('creates a manager scoped to a branch', async () => {
    await asAdmin();
    const created = await createUser({
      firstName: 'New',
      lastName: 'Manager',
      email: 'new.manager@kbyglobal.com',
      role: 'MANAGER',
      branchId: BRANCHES[0]!.id,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(created.role).toBe('MANAGER');
    // doc 04 §18 — businessId comes from the caller, never the form.
    expect(created.businessId).toBe(USERS[1]!.businessId);
    expect(created.branchId).toBe(BRANCHES[0]!.id);
  });

  it('lowercases the email (doc 03 §23)', async () => {
    await asAdmin();
    const created = await createUser({
      firstName: 'Mixed',
      lastName: 'Case',
      email: 'Mixed.Case@KBYGlobal.com',
      role: 'MANAGER',
      branchId: BRANCHES[0]!.id,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    expect(created.email).toBe('mixed.case@kbyglobal.com');
  });

  it('rejects a duplicate email with 409', async () => {
    await asAdmin();
    await expect(
      createUser({
        firstName: 'Dup',
        lastName: 'Licate',
        email: USERS[1]!.email,
        role: 'MANAGER',
        branchId: BRANCHES[0]!.id,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('deactivates rather than deletes a user', async () => {
    await asAdmin();
    const target = USERS.find((u) => u.role === 'MANAGER' && u.status === 'ACTIVE')!;
    const updated = await setUserStatus(target.id, 'INACTIVE');
    expect(updated.status).toBe('INACTIVE');
    expect(updated.id).toBe(target.id);
  });

  it('refuses a manager listing users (doc 04 §17)', async () => {
    await asManager();
    await expect(listUsers({ limit: 10 })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses a manager creating a user (doc 07 §58)', async () => {
    await asManager();
    await expect(
      createUser({
        firstName: 'X',
        lastName: 'Y',
        email: 'x@y.com',
        role: 'MANAGER',
        branchId: BRANCHES[0]!.id,
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('user creation schema (doc 03 §22, doc 06 §34)', () => {
  const base = {
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.com',
    role: 'MANAGER' as const,
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  it('requires a branch for a manager', () => {
    expect(createUserSchema.safeParse(base).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, branchId: BRANCHES[0]!.id }).success).toBe(true);
  });

  it('forbids a branch for an administrator', () => {
    expect(
      createUserSchema.safeParse({ ...base, role: 'ADMIN', branchId: BRANCHES[0]!.id }).success,
    ).toBe(false);
    expect(createUserSchema.safeParse({ ...base, role: 'ADMIN' }).success).toBe(true);
  });

  it('does not offer SUPER_ADMIN as a creatable role (doc 07 §57)', () => {
    expect(
      createUserSchema.safeParse({ ...base, role: 'SUPER_ADMIN', branchId: BRANCHES[0]!.id })
        .success,
    ).toBe(false);
  });

  it('enforces the 8-character minimum and matching confirmation', () => {
    expect(
      createUserSchema.safeParse({
        ...base,
        branchId: BRANCHES[0]!.id,
        password: 'short',
        confirmPassword: 'short',
      }).success,
    ).toBe(false);
    expect(
      createUserSchema.safeParse({
        ...base,
        branchId: BRANCHES[0]!.id,
        password: 'Password123!',
        confirmPassword: 'Different123!',
      }).success,
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      createUserSchema.safeParse({ ...base, email: 'nope', branchId: BRANCHES[0]!.id }).success,
    ).toBe(false);
  });
});

describe('manager administration (doc 04 §18-19, doc 07 §57)', () => {
  it('updates a manager profile and reassigns their branch', async () => {
    await asAdmin();
    const target = USERS.find((u) => u.role === 'MANAGER')!;
    // Capture before the call: the mock store holds the live row, so reading
    // `target` after the mutation would see the new values.
    const originalLastName = target.lastName;
    const updated = await updateUser(target.id, {
      firstName: target.firstName,
      lastName: `${originalLastName}-Edited`,
      phone: '+2348000000099',
      branchId: BRANCHES[1]!.id,
    });
    expect(updated.lastName).toBe(`${originalLastName}-Edited`);
    expect(updated.phone).toBe('+2348000000099');
    expect(updated.branchId).toBe(BRANCHES[1]!.id);
  });

  it('suspends and reactivates a manager (SUSPENDED blocks sign-in)', async () => {
    await asAdmin();
    const target = USERS.find((u) => u.role === 'MANAGER' && u.status === 'ACTIVE')!;
    const suspended = await setUserStatus(target.id, 'SUSPENDED');
    expect(suspended.status).toBe('SUSPENDED');
    const reactivated = await setUserStatus(target.id, 'ACTIVE');
    expect(reactivated.status).toBe('ACTIVE');
  });

  it('deletes a manager permanently', async () => {
    await asAdmin();
    const target = USERS.find((u) => u.role === 'MANAGER')!;
    await deleteUser(target.id);
    const { data } = await listUsers({ limit: 100 });
    expect(data.some((u) => u.id === target.id)).toBe(false);
  });

  it('refuses a manager updating users (doc 04 §18)', async () => {
    await asManager();
    const target = USERS.find((u) => u.role === 'MANAGER')!;
    await expect(
      updateUser(target.id, { firstName: 'Nope', lastName: 'Nope' }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('refuses touching the platform owner (doc 07 §57)', async () => {
    await asAdmin();
    const root = USERS.find((u) => u.role === 'SUPER_ADMIN')!;
    await expect(
      updateUser(root.id, { firstName: 'Nope', lastName: 'Nope' }),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(deleteUser(root.id)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses changing the status of your own account', async () => {
    await asSuperAdmin();
    const root = USERS.find((u) => u.role === 'SUPER_ADMIN')!;
    await expect(setUserStatus(root.id, 'SUSPENDED')).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('validates the update schema without allowing role changes', () => {
    expect(
      updateUserSchema.safeParse({
        firstName: 'A',
        lastName: 'B',
        phone: '+2348000000000',
        branchId: BRANCHES[0]!.id,
      }).success,
    ).toBe(true);
    expect(updateUserSchema.safeParse({ firstName: '', lastName: 'B' }).success).toBe(false);
    // There is deliberately no `role` field to mutate.
    expect('role' in updateUserSchema.shape).toBe(false);
  });
});

describe('profile avatar (own photo, any role)', () => {
  // A valid 1x1 PNG so the data URL shape check is exercised for real.
  const PNG_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('stores a photo for the signed-in user and serves it via /auth/me', async () => {
    await asManager();
    const updated = await updateMyAvatar(PNG_DATA_URL);
    expect(updated.avatarUrl).toBe(PNG_DATA_URL);

    const me = await getCurrentUser();
    expect(me.avatarUrl).toBe(PNG_DATA_URL);
  });

  it('clears the photo when sent null', async () => {
    await asManager();
    await updateMyAvatar(PNG_DATA_URL);
    const cleared = await updateMyAvatar(null);
    expect(cleared.avatarUrl).toBeNull();
  });

  it('rejects a payload that is not an image data URL', async () => {
    await asManager();
    await expect(updateMyAvatar('https://example.com/avatar.png')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('requires authentication', async () => {
    resetApiClientForTests();
    await expect(updateMyAvatar(PNG_DATA_URL)).rejects.toMatchObject({ statusCode: 401 });
  });
});
