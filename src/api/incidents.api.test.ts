import { describe, expect, it } from 'vitest';

import { login } from '@/api/auth.api';
import { resetApiClientForTests, setAccessToken } from '@/api/client';
import {
  createIncidentReport,
  createIncidentReportSchema,
  getIncidentReport,
  listIncidentReports,
  reviewIncidentReport,
} from '@/api/incidents.api';
import { BRANCHES, INCIDENT_REPORTS } from '@/mocks/data';

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

const doka = BRANCHES[0]!.id;

describe('incident report validation', () => {
  it('requires a real title and a description', () => {
    expect(
      createIncidentReportSchema.safeParse({ title: 'ab', description: 'Something happened' })
        .success,
    ).toBe(false);
    expect(
      createIncidentReportSchema.safeParse({ title: 'Pump leak', description: 'no' }).success,
    ).toBe(false);
    expect(
      createIncidentReportSchema.safeParse({
        title: 'Pump leak',
        description: 'Pump 3 leaked about 20 litres.',
      }).success,
    ).toBe(true);
  });

  it('refuses a future incident date', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    expect(
      createIncidentReportSchema.safeParse({
        incidentDate: future,
        title: 'Pump leak',
        description: 'Pump 3 leaked about 20 litres.',
      }).success,
    ).toBe(false);
  });
});

describe('filing an incident', () => {
  it('creates an OPEN incident reported by the caller', async () => {
    await asManager();
    const incident = await createIncidentReport({
      branchId: doka,
      incidentDate: '2026-09-01',
      title: '  Tanker hose leaked during offload  ',
      description: 'Roughly 40 litres spilled; the area was cleaned immediately.',
    });

    expect(incident.status).toBe('OPEN');
    expect(incident.title).toBe('Tanker hose leaked during offload');
    expect(incident.reportedByName).toBeTruthy();
    expect(incident.reviewedAt).toBeNull();
  });

  it('refuses a manager filing for another branch (doc 04 §93)', async () => {
    await asManager();
    await expect(
      createIncidentReport({
        branchId: BRANCHES[1]!.id,
        title: 'Odd smell at the depot',
        description: 'Detected after closing; nobody was hurt.',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
  });
});

describe('reviewing an incident', () => {
  it('an administrator flips OPEN to REVIEWED exactly once', async () => {
    await asAdmin();
    const open = INCIDENT_REPORTS.find((r) => r.status === 'OPEN')!;

    const reviewed = await reviewIncidentReport(open.id);
    expect(reviewed.status).toBe('REVIEWED');
    expect(reviewed.reviewedAt).toBeTruthy();
    expect(reviewed.reviewedByName).toBeTruthy();

    await expect(reviewIncidentReport(open.id)).rejects.toMatchObject({
      code: 'INVALID_OPERATION',
    });
  });

  it('refuses a manager reviewing an incident (doc 06 §28)', async () => {
    await asManager();
    const open = INCIDENT_REPORTS.find((r) => r.status === 'OPEN' && r.branchId === doka)!;
    await expect(reviewIncidentReport(open.id)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('incident listing', () => {
  it('scopes a manager to their branch', async () => {
    await asManager();
    const { data } = await listIncidentReports({ limit: 100 });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.branchId === doka)).toBe(true);
  });

  it('filters by status', async () => {
    await asAdmin();
    const { data } = await listIncidentReports({ status: 'OPEN', limit: 100 });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.status === 'OPEN')).toBe(true);
  });

  it('returns a single incident by id', async () => {
    await asAdmin();
    const any = INCIDENT_REPORTS[0]!;
    const fetched = await getIncidentReport(any.id);
    expect(fetched.id).toBe(any.id);
    expect(fetched.description).toBe(any.description);
  });
});
