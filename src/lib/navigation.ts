/**
 * Navigation model.
 *
 * PROMPT.md §5 — the navigation adapts by viewport and is role-aware. This is
 * the single source of truth for *what* exists and *who* may see it; the shell
 * components only decide *how* to render it for the current breakpoint.
 *
 * Every entry declares the capabilities required to see it. That is UX only —
 * the backend remains the authority (doc 06 §56).
 */

import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardCheck,
  Fuel,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  Users,
} from 'lucide-react';

import { canAny, type Capability } from './permissions';
import type { UserRole } from '@/types/domain';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Any-of: the item shows when the role holds at least one capability. */
  capabilities: readonly Capability[];
  /** Short label for the mobile bottom navigation, where space is tight. */
  shortLabel?: string;
}

export interface NavGroup {
  /** Group heading; omitted (null) for ungrouped top-level items. */
  title: string | null;
  items: readonly NavItem[];
}

/**
 * Mobile bottom navigation shows at most five destinations (PROMPT.md §5), so
 * each role needs an explicit shortlist rather than a truncation of the full set.
 */
export interface RoleNav {
  groups: readonly NavGroup[];
  bottomBar: readonly NavItem[];
}

const dashboard = (role: UserRole): NavItem => ({
  href: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  capabilities: [role === 'MANAGER' ? 'dashboard.manager' : 'dashboard.admin'],
});

/* ---------------------------------------------------------- manager first */

/**
 * doc 02 §39 originally listed Daily Reports for the manager; the 2026-10
 * product decision split the two ideas: Record Sale now carries the money
 * (day totals), and this section is the manager's incident log.
 */
const MANAGER_NAV: RoleNav = {
  groups: [
    { title: null, items: [dashboard('MANAGER')] },
    {
      title: 'Operations',
      items: [
        {
          href: '/sales',
          label: 'Record Sale',
          icon: ShoppingCart,
          shortLabel: 'Sales',
          capabilities: ['sales.record'],
        },
        {
          href: '/inventory',
          label: 'Products',
          icon: Package,
          capabilities: ['inventory.view'],
        },
        {
          href: '/deliveries',
          label: 'Deliveries',
          icon: Truck,
          capabilities: ['delivery.view'],
        },
        {
          href: '/daily-reports',
          label: 'Incident Reports',
          icon: AlertTriangle,
          shortLabel: 'Incidents',
          capabilities: ['dailyReport.view'],
        },
        // Read-only for managers: what the pumps sell at today. Admin price
        // changes take effect immediately and arrive as a notification.
        {
          href: '/fuel-prices',
          label: 'Fuel Prices',
          icon: Tag,
          capabilities: ['fuelPrice.view'],
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          href: '/notifications',
          label: 'Notifications',
          icon: Receipt,
          capabilities: ['notification.view'],
        },
      ],
    },
  ],
  bottomBar: [
    dashboard('MANAGER'),
    {
      href: '/sales',
      label: 'Record Sale',
      icon: ShoppingCart,
      shortLabel: 'Sales',
      capabilities: ['sales.record'],
    },
    {
      href: '/inventory',
      label: 'Products',
      icon: Package,
      capabilities: ['inventory.view'],
    },
    {
      href: '/daily-reports',
      label: 'Incident Reports',
      icon: AlertTriangle,
      shortLabel: 'Incidents',
      capabilities: ['dailyReport.view'],
    },
  ],
};

/* -------------------------------------------------------------- admin next */

const ADMIN_NAV: RoleNav = {
  groups: [
    { title: null, items: [dashboard('ADMIN')] },
    {
      title: 'Operations',
      items: [
        {
          href: '/inventory',
          label: 'Products',
          icon: Package,
          capabilities: ['inventory.view'],
        },
        {
          href: '/deliveries',
          label: 'Deliveries',
          icon: Truck,
          capabilities: ['delivery.view'],
        },
        // Product decision (2026-10) — the manager's recording passes an
        // admin approval gate, so the admin view reviews what was recorded.
        {
          href: '/sales',
          label: 'Sales',
          icon: ShoppingCart,
          capabilities: ['sales.view'],
        },
        {
          href: '/daily-reports',
          label: 'Daily Reports',
          icon: ClipboardCheck,
          capabilities: ['dailyReport.view'],
        },
      ],
    },
    {
      title: 'Procurement',
      items: [
        {
          href: '/fuel-orders',
          label: 'Fuel Orders',
          icon: ClipboardCheck,
          capabilities: ['fuelOrder.view'],
        },
        {
          href: '/suppliers',
          label: 'Suppliers',
          icon: Building2,
          capabilities: ['supplier.view'],
        },
        {
          href: '/tankers',
          label: 'Tankers',
          icon: Truck,
          capabilities: ['tanker.view'],
        },
      ],
    },
    {
      title: 'Configuration',
      items: [
        {
          href: '/fuel-types',
          label: 'Fuel Types',
          icon: Fuel,
          capabilities: ['fuelType.view'],
        },
        {
          href: '/fuel-prices',
          label: 'Fuel Prices',
          icon: Tag,
          capabilities: ['fuelPrice.view'],
        },
        {
          href: '/branches',
          label: 'Branches',
          icon: Building2,
          capabilities: ['branch.view'],
        },
        {
          href: '/users',
          label: 'Users',
          icon: Users,
          capabilities: ['user.view'],
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          href: '/reports',
          label: 'Reports',
          icon: BarChart3,
          capabilities: ['dashboard.admin'],
        },
        {
          href: '/notifications',
          label: 'Notifications',
          icon: Receipt,
          capabilities: ['notification.view'],
        },
        {
          href: '/audit-logs',
          label: 'Audit Logs',
          icon: ScrollText,
          capabilities: ['auditLog.view'],
        },
      ],
    },
  ],
  bottomBar: [
    dashboard('ADMIN'),
    {
      href: '/inventory',
      label: 'Products',
      icon: Package,
      capabilities: ['inventory.view'],
    },
    {
      href: '/fuel-orders',
      label: 'Fuel Orders',
      icon: ClipboardCheck,
      shortLabel: 'Orders',
      capabilities: ['fuelOrder.manage'],
    },
    {
      href: '/daily-reports',
      label: 'Daily Reports',
      icon: ClipboardCheck,
      shortLabel: 'Reports',
      capabilities: ['dailyReport.view'],
    },
  ],
};

/* ------------------------------------------------------ super admin last */

const SUPER_ADMIN_NAV: RoleNav = {
  groups: [
    { title: null, items: [dashboard('SUPER_ADMIN')] },
    {
      title: 'Platform',
      items: [
        {
          href: '/businesses',
          label: 'Businesses',
          icon: Building2,
          capabilities: ['business.view'],
        },
        {
          href: '/users',
          label: 'Users',
          icon: Users,
          capabilities: ['user.view'],
        },
      ],
    },
    {
      title: 'Configuration',
      items: [
        {
          href: '/fuel-types',
          label: 'Fuel Types',
          icon: Fuel,
          capabilities: ['fuelType.view'],
        },
        {
          href: '/fuel-prices',
          label: 'Fuel Prices',
          icon: Tag,
          capabilities: ['fuelPrice.view'],
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          href: '/reports',
          label: 'Reports',
          icon: BarChart3,
          capabilities: ['dashboard.admin'],
        },
        {
          href: '/notifications',
          label: 'Notifications',
          icon: Receipt,
          capabilities: ['notification.view'],
        },
        {
          href: '/audit-logs',
          label: 'Audit Logs',
          icon: ScrollText,
          capabilities: ['auditLog.view'],
        },
      ],
    },
  ],
  bottomBar: [
    dashboard('SUPER_ADMIN'),
    {
      href: '/businesses',
      label: 'Businesses',
      icon: Building2,
      capabilities: ['business.view'],
    },
    {
      href: '/users',
      label: 'Users',
      icon: Users,
      capabilities: ['user.view'],
    },
    {
      href: '/audit-logs',
      label: 'Audit Logs',
      icon: ScrollText,
      shortLabel: 'Audit',
      capabilities: ['auditLog.view'],
    },
  ],
};

const NAV_BY_ROLE: Record<UserRole, RoleNav> = {
  MANAGER: MANAGER_NAV,
  ADMIN: ADMIN_NAV,
  SUPER_ADMIN: SUPER_ADMIN_NAV,
};

export function navForRole(role: UserRole | null | undefined): RoleNav {
  if (!role) return { groups: [], bottomBar: [] };
  return NAV_BY_ROLE[role];
}

/** Filter a nav tree down to what the role may see, dropping empty groups. */
export function visibleGroups(role: UserRole | null | undefined): NavGroup[] {
  return navForRole(role)
    .groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => canAny(role, item.capabilities)),
    }))
    .filter((group) => group.items.length > 0);
}

export function visibleBottomBar(role: UserRole | null | undefined): NavItem[] {
  return navForRole(role)
    .bottomBar.filter((item) => canAny(role, item.capabilities))
    .slice(0, 5);
}

/**
 * The "More" destination opens the drawer; it is appended by the shell when the
 * sidebar tree does not fit the bottom bar.
 */
export const MORE_HREF = '/more';

export const MORE_ITEM: NavItem = {
  href: MORE_HREF,
  label: 'More',
  icon: Settings,
  shortLabel: 'More',
  capabilities: [],
};

/** Profile, available to every role (doc 07 §56 — all roles may edit themselves). */
export const PROFILE_ITEM: NavItem = {
  href: '/profile',
  label: 'Profile',
  icon: Users,
  capabilities: [],
};

export const SHIELD_ICON = ShieldCheck;
