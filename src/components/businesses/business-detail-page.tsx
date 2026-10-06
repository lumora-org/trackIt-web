'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getBusiness } from '@/api/businesses.api';
import { listBranches } from '@/api/branches.api';
import { listFuelPrices } from '@/api/fuel-prices.api';
import { listFuelTypes } from '@/api/fuel-types.api';
import { listSuppliers } from '@/api/suppliers.api';
import { listTankers } from '@/api/tankers.api';
import { listUsers } from '@/api/users.api';
import { SegmentedTabs } from '@/components/shared/segmented-tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { DetailRow } from '@/components/ui/stat-card';
import { ErrorState } from '@/components/ui/states';
import { formatLitres, formatDate, formatPricePerLitre } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';
import type { Branch, Business, FuelPrice, FuelType, Supplier, Tanker, User } from '@/types/domain';

/**
 * Business detail (product decision, 2026-10).
 *
 * Opened from a business card on the Businesses screen. A SUPER_ADMIN sees
 * everything that belongs to one tenant — profile, branches, users and the
 * configuration lists — without ever touching another business's data. The
 * lists are read-only: creating and editing stays on the global screens and
 * remains the business admin's job.
 *
 * Every list endpoint accepts `businessId` from a SUPER_ADMIN (the backend
 * clamps the value for everyone else), so each tab is a straight query.
 */
const TAB_OPTIONS = [
  { value: 'overview', label: 'Overview' },
  { value: 'branches', label: 'Branches' },
  { value: 'users', label: 'Users' },
  { value: 'fuel-types', label: 'Fuel Types' },
  { value: 'fuel-prices', label: 'Fuel Prices' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'tankers', label: 'Tankers' },
] as const;

type TabId = (typeof TAB_OPTIONS)[number]['value'];

export function BusinessDetailPage({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('overview');

  const businessQuery = useQuery({
    queryKey: queryKeys.businesses.detail(businessId),
    queryFn: () => getBusiness(businessId),
    retry: false,
  });

  if (businessQuery.isPending) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="h-16 animate-pulse rounded bg-neutral-200" />
        <div className="h-10 animate-pulse rounded bg-neutral-200" />
      </div>
    );
  }

  if (businessQuery.isError || !businessQuery.data) {
    return (
      <ErrorState
        message={
          businessQuery.error instanceof Error
            ? businessQuery.error.message
            : 'Unable to load the business.'
        }
        onRetry={() => businessQuery.refetch()}
      />
    );
  }

  const business = businessQuery.data;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => router.push('/businesses')}
        className="flex items-center gap-1 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to businesses
      </button>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-brand-50 text-brand-700 flex size-11 shrink-0 items-center justify-center rounded-lg">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-neutral-900">{business.name}</h1>
            <p className="truncate text-sm text-neutral-500">
              {business.registrationNumber ?? 'No registration number'}
            </p>
          </div>
        </div>
        <StatusCell value={business.status} />
      </header>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={TAB_OPTIONS}
        ariaLabel="Business sections"
      />

      {tab === 'overview' ? <OverviewTab business={business} /> : null}
      {tab === 'branches' ? <BranchesTab businessId={businessId} /> : null}
      {tab === 'users' ? <UsersTab businessId={businessId} /> : null}
      {tab === 'fuel-types' ? <FuelTypesTab businessId={businessId} /> : null}
      {tab === 'fuel-prices' ? <FuelPricesTab businessId={businessId} /> : null}
      {tab === 'suppliers' ? <SuppliersTab businessId={businessId} /> : null}
      {tab === 'tankers' ? <TankersTab businessId={businessId} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function StatusCell({ value }: { value: string }) {
  return (
    <Badge
      tone={value === 'ACTIVE' ? 'success' : value === 'SUSPENDED' ? 'danger' : 'neutral'}
      size="sm"
    >
      {value}
    </Badge>
  );
}

/** Turns a list-query failure into the display text DataTable expects. */
function errorText(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : null;
}

function OverviewTab({ business }: { business: Business }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Business information</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3 pt-4">
        <DetailRow label="Name" value={business.name} emphasis />
        <DetailRow label="Registration number" value={business.registrationNumber ?? '—'} />
        <DetailRow label="Email" value={business.email ?? '—'} />
        <DetailRow label="Phone" value={business.phone ?? '—'} />
        <DetailRow label="Address" value={business.address ?? '—'} />
        <DetailRow label="Status" value={<StatusCell value={business.status} />} />
      </CardBody>
    </Card>
  );
}

function BranchesTab({ businessId }: { businessId: string }) {
  const listQuery = useQuery({
    queryKey: queryKeys.branches.list({ businessId }),
    queryFn: () => listBranches({ businessId, limit: 100 }),
  });

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      header: 'Branch',
      primary: true,
      render: (b) => <span className="font-semibold">{b.name}</span>,
    },
    { key: 'code', header: 'Code', render: (b) => b.code },
    { key: 'address', header: 'Address', mobileHidden: true, render: (b) => b.address },
    {
      key: 'phone',
      header: 'Phone',
      mobileHidden: true,
      render: (b) => b.phone ?? '—',
    },
    { key: 'status', header: 'Status', render: (b) => <StatusCell value={b.status} /> },
  ];

  return (
    <DataTable
      caption="Branches"
      columns={columns}
      data={listQuery.data?.data ?? []}
      rowKey={(b) => b.id}
      loading={listQuery.isLoading}
      loadingLabel="Loading branches"
      error={listQuery.isError ? errorText(listQuery.error) : null}
      onRetry={() => listQuery.refetch()}
      emptyTitle="No branches yet"
      emptyDescription="Branches created for this business appear here."
      emptyIcon={Building2}
    />
  );
}

function UsersTab({ businessId }: { businessId: string }) {
  const listQuery = useQuery({
    queryKey: queryKeys.users.list({ businessId }),
    queryFn: () => listUsers({ businessId, limit: 100 }),
  });

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      primary: true,
      render: (u) => (
        <span className="font-semibold">
          {u.firstName} {u.lastName}
        </span>
      ),
    },
    { key: 'email', header: 'Email', render: (u) => u.email },
    { key: 'role', header: 'Role', render: (u) => u.role },
    {
      key: 'phone',
      header: 'Phone',
      mobileHidden: true,
      render: (u) => u.phone ?? '—',
    },
    { key: 'status', header: 'Status', render: (u) => <StatusCell value={u.status} /> },
  ];

  return (
    <DataTable
      caption="Users"
      columns={columns}
      data={listQuery.data?.data ?? []}
      rowKey={(u) => u.id}
      loading={listQuery.isLoading}
      loadingLabel="Loading users"
      error={listQuery.isError ? errorText(listQuery.error) : null}
      onRetry={() => listQuery.refetch()}
      emptyTitle="No users yet"
      emptyDescription="Administrators and managers of this business appear here."
      emptyIcon={Building2}
    />
  );
}

function FuelTypesTab({ businessId }: { businessId: string }) {
  const listQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ businessId }),
    queryFn: () => listFuelTypes({ businessId, limit: 100 }),
  });

  const columns: Column<FuelType>[] = [
    {
      key: 'name',
      header: 'Fuel type',
      primary: true,
      render: (t) => <span className="font-semibold">{t.name}</span>,
    },
    { key: 'code', header: 'Code', render: (t) => t.code },
    {
      key: 'description',
      header: 'Description',
      mobileHidden: true,
      render: (t) => t.description ?? '—',
    },
    { key: 'status', header: 'Status', render: (t) => <StatusCell value={t.status} /> },
  ];

  return (
    <DataTable
      caption="Fuel types"
      columns={columns}
      data={listQuery.data?.data ?? []}
      rowKey={(t) => t.id}
      loading={listQuery.isLoading}
      loadingLabel="Loading fuel types"
      error={listQuery.isError ? errorText(listQuery.error) : null}
      onRetry={() => listQuery.refetch()}
      emptyTitle="No fuel types yet"
      emptyDescription="The products this business sells appear here."
      emptyIcon={Building2}
    />
  );
}

function FuelPricesTab({ businessId }: { businessId: string }) {
  // Only currently-applicable intervals: the price history lives on the
  // global Fuel Prices screen, this tab answers "what does each product cost".
  const pricesQuery = useQuery({
    queryKey: queryKeys.fuelPrices.list({ businessId, active: true }),
    queryFn: () => listFuelPrices({ businessId, active: true, limit: 100 }),
  });

  const fuelTypesQuery = useQuery({
    queryKey: queryKeys.fuelTypes.list({ businessId }),
    queryFn: () => listFuelTypes({ businessId, limit: 100 }),
  });

  const typeNames = new Map(
    fuelTypesQuery.data?.data.map((t) => [t.id, `${t.name} (${t.code})`] as const),
  );

  const columns: Column<FuelPrice>[] = [
    {
      key: 'fuelType',
      header: 'Fuel type',
      primary: true,
      render: (p) => <span className="font-semibold">{typeNames.get(p.fuelTypeId) ?? '—'}</span>,
    },
    {
      key: 'price',
      header: 'Price / litre',
      align: 'right',
      render: (p) => formatPricePerLitre(p.pricePerLitre),
    },
    {
      key: 'effectiveFrom',
      header: 'Effective from',
      render: (p) => formatDate(p.effectiveFrom),
    },
    {
      key: 'effectiveTo',
      header: 'Effective to',
      mobileHidden: true,
      render: (p) => (p.effectiveTo ? formatDate(p.effectiveTo) : 'Current'),
    },
  ];

  return (
    <DataTable
      caption="Current fuel prices"
      columns={columns}
      data={pricesQuery.data?.data ?? []}
      rowKey={(p) => p.id}
      loading={pricesQuery.isLoading || fuelTypesQuery.isLoading}
      loadingLabel="Loading prices"
      error={
        pricesQuery.isError ? errorText(pricesQuery.error) : errorText(fuelTypesQuery.error)
      }
      onRetry={() => {
        void pricesQuery.refetch();
        void fuelTypesQuery.refetch();
      }}
      emptyTitle="No prices set yet"
      emptyDescription="Prices configured for this business appear here."
      emptyIcon={Building2}
    />
  );
}

function SuppliersTab({ businessId }: { businessId: string }) {
  const listQuery = useQuery({
    queryKey: queryKeys.suppliers.list({ businessId }),
    queryFn: () => listSuppliers({ businessId, limit: 100 }),
  });

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier',
      primary: true,
      render: (s) => <span className="font-semibold">{s.name}</span>,
    },
    { key: 'code', header: 'Code', render: (s) => s.code },
    {
      key: 'contactPerson',
      header: 'Contact',
      mobileHidden: true,
      render: (s) => s.contactPerson ?? '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      mobileHidden: true,
      render: (s) => s.phone ?? '—',
    },
    { key: 'status', header: 'Status', render: (s) => <StatusCell value={s.status} /> },
  ];

  return (
    <DataTable
      caption="Suppliers"
      columns={columns}
      data={listQuery.data?.data ?? []}
      rowKey={(s) => s.id}
      loading={listQuery.isLoading}
      loadingLabel="Loading suppliers"
      error={listQuery.isError ? errorText(listQuery.error) : null}
      onRetry={() => listQuery.refetch()}
      emptyTitle="No suppliers yet"
      emptyDescription="Suppliers configured for this business appear here."
      emptyIcon={Building2}
    />
  );
}

function TankersTab({ businessId }: { businessId: string }) {
  const listQuery = useQuery({
    queryKey: queryKeys.tankers.list({ businessId }),
    queryFn: () => listTankers({ businessId, limit: 100 }),
  });

  const columns: Column<Tanker>[] = [
    {
      key: 'registrationNumber',
      header: 'Registration',
      primary: true,
      render: (t) => <span className="font-semibold">{t.registrationNumber}</span>,
    },
    {
      key: 'tankerCode',
      header: 'Code',
      render: (t) => t.tankerCode ?? '—',
    },
    {
      key: 'capacity',
      header: 'Capacity',
      align: 'right',
      render: (t) => formatLitres(t.capacityLitres),
    },
    {
      key: 'driverName',
      header: 'Driver',
      mobileHidden: true,
      render: (t) => t.driverName ?? '—',
    },
    { key: 'status', header: 'Status', render: (t) => <StatusCell value={t.status} /> },
  ];

  return (
    <DataTable
      caption="Tankers"
      columns={columns}
      data={listQuery.data?.data ?? []}
      rowKey={(t) => t.id}
      loading={listQuery.isLoading}
      loadingLabel="Loading tankers"
      error={listQuery.isError ? errorText(listQuery.error) : null}
      onRetry={() => listQuery.refetch()}
      emptyTitle="No tankers yet"
      emptyDescription="Tankers registered for this business appear here."
      emptyIcon={Building2}
    />
  );
}
