import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import { createSupplier, listSuppliers, supplierSchema } from '@/api/suppliers.api';
import { createTanker, listTankers, tankerSchema } from '@/api/tankers.api';
import { SUPPLIERS, TANKERS } from '@/mocks/data';

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

describe('supplier validation (doc 09 documents no DTO — see ASSUMPTIONS §3.10)', () => {
  it('requires only a name and code', () => {
    expect(supplierSchema.safeParse({ name: 'Depot', code: 'SUP-9' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(supplierSchema.safeParse({ name: 'D', code: 'S', email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('allows an empty optional email', () => {
    expect(supplierSchema.safeParse({ name: 'D', code: 'S', email: '' }).success).toBe(true);
  });

  it('rejects an implausible phone number', () => {
    expect(supplierSchema.safeParse({ name: 'D', code: 'S', phone: 'abc' }).success).toBe(false);
    expect(
      supplierSchema.safeParse({ name: 'D', code: 'S', phone: '+234 801 111 1111' }).success,
    ).toBe(true);
  });

  it('uppercases the code', () => {
    expect(supplierSchema.parse({ name: 'D', code: 'sup-9' }).code).toBe('SUP-9');
  });
});

describe('supplier CRUD', () => {
  it('lists suppliers for the business', async () => {
    await asAdmin();
    const { data } = await listSuppliers({ limit: 100 });
    expect(data.length).toBe(SUPPLIERS.length);
  });

  it('filters by search term across name, code and email', async () => {
    await asAdmin();
    const { data } = await listSuppliers({ search: 'NNPC', limit: 100 });
    expect(data).toHaveLength(1);
    expect(data[0]!.name).toBe('NNPC Mega Depot');
  });

  it('filters by status', async () => {
    await asAdmin();
    const { data } = await listSuppliers({ status: 'INACTIVE', limit: 100 });
    expect(data.every((s) => s.status === 'INACTIVE')).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('rejects a duplicate code with 409 (doc 03 §34)', async () => {
    await asAdmin();
    await expect(
      createSupplier({ name: 'Duplicate', code: SUPPLIERS[0]!.code }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects supplier creation by a manager (doc 09 §15)', async () => {
    await asManager();
    await expect(createSupplier({ name: 'X', code: 'SUP-X' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('tanker validation (doc 03 §36)', () => {
  it('requires a registration number and a positive capacity', () => {
    expect(
      tankerSchema.safeParse({ registrationNumber: 'ABC-1', capacityLitres: 45000 }).success,
    ).toBe(true);
  });

  it('rejects zero capacity (CHECK capacity_litres > 0)', () => {
    expect(tankerSchema.safeParse({ registrationNumber: 'ABC-1', capacityLitres: 0 }).success).toBe(
      false,
    );
  });

  it('rejects a negative capacity', () => {
    expect(
      tankerSchema.safeParse({ registrationNumber: 'ABC-1', capacityLitres: -100 }).success,
    ).toBe(false);
  });

  it('requires a registration number', () => {
    expect(tankerSchema.safeParse({ capacityLitres: 100 }).success).toBe(false);
  });

  it('uppercases the registration number', () => {
    expect(
      tankerSchema.parse({ registrationNumber: ' abc-123-la ', capacityLitres: 1 })
        .registrationNumber,
    ).toBe('ABC-123-LA');
  });
});

describe('tanker CRUD', () => {
  it('lists tankers', async () => {
    await asAdmin();
    const { data } = await listTankers({ limit: 100 });
    expect(data.length).toBe(TANKERS.length);
  });

  it('searches by driver name', async () => {
    await asAdmin();
    const { data } = await listTankers({ search: 'Peter', limit: 100 });
    expect(data).toHaveLength(1);
    expect(data[0]!.driverName).toBe('Peter Okonkwo');
  });

  it('rejects a duplicate registration number (UNIQUE per business)', async () => {
    await asAdmin();
    await expect(
      createTanker({
        registrationNumber: TANKERS[0]!.registrationNumber,
        capacityLitres: 1000,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('surfaces the server validation error for capacity', async () => {
    await asAdmin();
    await expect(
      createTanker({ registrationNumber: 'NEW-001', capacityLitres: -5 }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('rejects tanker creation by a manager (doc 09 §15)', async () => {
    await asManager();
    await expect(
      createTanker({ registrationNumber: 'NEW-002', capacityLitres: 1000 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
