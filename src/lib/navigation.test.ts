import { describe, expect, it } from 'vitest';

import { canAny } from './permissions';
import { navForRole, visibleBottomBar, visibleGroups } from './navigation';

const hrefs = (role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER') =>
  visibleGroups(role).flatMap((g) => g.items.map((i) => i.href));

describe('navigation is role-aware', () => {
  it('gives a manager exactly the operational sections (doc 02 §39)', () => {
    const links = hrefs('MANAGER');
    expect(links).toContain('/sales');
    expect(links).toContain('/inventory');
    expect(links).toContain('/deliveries');
    expect(links).toContain('/daily-reports');
    expect(links).toContain('/dashboard');

    // A manager must never see procurement or configuration.
    expect(links).not.toContain('/suppliers');
    expect(links).not.toContain('/tankers');
    expect(links).not.toContain('/fuel-prices');
    expect(links).not.toContain('/fuel-types');
    expect(links).not.toContain('/users');
    expect(links).not.toContain('/audit-logs');
  });

  it('gives an admin procurement and configuration but not platform management', () => {
    const links = hrefs('ADMIN');
    expect(links).toContain('/fuel-orders');
    expect(links).toContain('/suppliers');
    expect(links).toContain('/tankers');
    expect(links).toContain('/fuel-prices');
    expect(links).toContain('/fuel-types');
    expect(links).toContain('/branches');
    expect(links).toContain('/users');
    expect(links).toContain('/audit-logs');

    expect(links).not.toContain('/businesses');
  });

  it('gives a super admin platform management', () => {
    const links = hrefs('SUPER_ADMIN');
    expect(links).toContain('/businesses');
    expect(links).toContain('/users');
    expect(links).toContain('/audit-logs');
  });

  it('renders a dashboard entry for every role', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const) {
      expect(hrefs(role)).toContain('/dashboard');
    }
  });

  it('returns nothing for an anonymous user', () => {
    expect(visibleGroups(null)).toEqual([]);
    expect(visibleBottomBar(null)).toEqual([]);
  });
});

describe('bottom navigation', () => {
  it('never exceeds five destinations (PROMPT.md §5)', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const) {
      expect(visibleBottomBar(role).length).toBeLessThanOrEqual(5);
    }
  });

  it('surfaces the most important manager actions', () => {
    const bar = visibleBottomBar('MANAGER').map((i) => i.href);
    expect(bar).toContain('/dashboard');
    expect(bar).toContain('/sales');
    expect(bar).toContain('/inventory');
  });

  it('only includes entries the role actually holds', () => {
    for (const role of ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const) {
      for (const item of visibleBottomBar(role)) {
        expect(canAny(role, item.capabilities)).toBe(true);
      }
    }
  });
});

describe('navForRole', () => {
  it('returns distinct trees per role', () => {
    expect(navForRole('MANAGER').groups).not.toBe(navForRole('ADMIN').groups);
    expect(navForRole('ADMIN').groups).not.toBe(navForRole('SUPER_ADMIN').groups);
  });
});
