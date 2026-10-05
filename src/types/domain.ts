/**
 * Domain types mirroring the documented API contract.
 *
 * Sources of truth:
 *  - `docs/04-api-specification.md`  (labelled "MVP API Contract" — authoritative)
 *  - `docs/03 — Database Design.md` (authoritative for PostgreSQL enums)
 *
 * Where docs 08/09 contradict doc 04, doc 04 wins. See `docs/ASSUMPTIONS.md`.
 *
 * NOTE ON MONEY: the docs conflict. `05-backend-architecture.md` §27 suggests
 * PostgreSQL NUMERIC arrives as `string`, while every JSON example in doc 04
 * uses bare numbers. We model the wire format as `number` and coerce defensively
 * at the client boundary so a string-serialising backend still works.
 */

/* ------------------------------------------------------------------ roles */

/** doc 06 §2 — exactly three roles. */
export const USER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * doc 06 §5 — scope invariants, enforced by the backend.
 *   SUPER_ADMIN → businessId === null && branchId === null
 *   ADMIN       → businessId !== null && branchId === null
 *   MANAGER     → businessId !== null && branchId !== null
 */
export interface AuthenticatedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  /** doc 03 §12 `account_status`. Only ACTIVE may authenticate (doc 06 §21). */
  status: AccountStatus;
  businessId: string | null;
  branchId: string | null;
}

/** doc 03 §12 */
export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * `account_status` is reused for fuel types, suppliers and tankers. Docs 08/09
 * only document ACTIVE/INACTIVE for those, but the column type also permits
 * SUSPENDED. We model all three so an unexpected value does not break the UI.
 */
export type ResourceStatus = AccountStatus;

/* ------------------------------------------------------------- businesses */

/** doc 03 §13 */
export const BUSINESS_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export interface Business {
  id: string;
  name: string;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: BusinessStatus;
}

/** doc 03 §14 — note: no SUSPENDED, unlike other status enums. */
export const BRANCH_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  code: string;
  address: string;
  phone: string | null;
  status: BranchStatus;
}

/* ------------------------------------------------------------------ users */

export interface User {
  id: string;
  businessId: string | null;
  branchId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: AccountStatus;
  lastLoginAt: string | null;
}

/* ------------------------------------------------------------- fuel types */

/** doc 08 §8 documents ACTIVE/INACTIVE; column type is `account_status`. */
export type FuelTypeStatus = ResourceStatus;

export interface FuelType {
  id: string;
  name: string;
  /** e.g. PMS / AGO / DPK. Immutable after creation (doc 08 §13). */
  code: string;
  description: string | null;
  status: FuelTypeStatus;
}

/* ------------------------------------------------------------ fuel prices */

/** doc 03 §31 */
export interface FuelPrice {
  id: string;
  fuelTypeId: string;
  /** NUMERIC(18,2), must be > 0 (doc 08 §39, `@IsPositive()`). */
  pricePerLitre: number;
  /** Interval is [effectiveFrom, effectiveTo) — start inclusive, end exclusive. */
  effectiveFrom: string;
  /** null means "open ended / currently applicable". */
  effectiveTo: string | null;
}

/* -------------------------------------------------------------- suppliers */

/** doc 09 §3.1, doc 03 §34 */
export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  code: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: ResourceStatus;
}

/* ---------------------------------------------------------------- tankers */

/** doc 09 §5.1, doc 03 §35 */
export interface Tanker {
  id: string;
  businessId: string;
  registrationNumber: string;
  tankerCode: string | null;
  /** NUMERIC(18,3), CHECK (capacity_litres > 0). */
  capacityLitres: number;
  driverName: string | null;
  driverPhone: string | null;
  status: ResourceStatus;
}

/* ------------------------------------------------------------ fuel orders */

/** doc 03 §15 — exact enum, note `PARTIALLY_DELIVERED`. */
export const FUEL_ORDER_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'CONFIRMED',
  'IN_TRANSIT',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type FuelOrderStatus = (typeof FUEL_ORDER_STATUSES)[number];

/**
 * Allowed transitions. Derived from doc 04 §43–46 (which documents
 * DRAFT→SUBMITTED, SUBMITTED→CONFIRMED, CONFIRMED→IN_TRANSIT) and doc 09 §9
 * (cancel from DRAFT/SUBMITTED/CONFIRMED).
 *
 * ASSUMPTION: PARTIALLY_DELIVERED and DELIVERED have no documented endpoint —
 * they are set by the delivery-receiving flow. See ASSUMPTIONS.md.
 */
export const FUEL_ORDER_TRANSITIONS: Record<FuelOrderStatus, FuelOrderStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['PARTIALLY_DELIVERED', 'DELIVERED'],
  PARTIALLY_DELIVERED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** doc 04 §41 — items[] has exactly these three fields. */
export interface FuelOrderItemInput {
  fuelTypeId: string;
  expectedQuantityLitres: number;
  /** Procurement cost per litre. NOT the retail price (doc 09 §7). */
  unitCost: number;
}

/** doc 04 §42 — responses additionally carry `fuelTypeName`. */
export interface FuelOrderItem extends FuelOrderItemInput {
  fuelTypeName: string;
}

/** Minimal nested reference used inside fuel order responses. */
export interface EntityRef {
  id: string;
  name: string;
}

export interface FuelOrder {
  id: string;
  orderNumber: string;
  status: FuelOrderStatus;
  supplier: EntityRef;
  destinationBranch: EntityRef;
  expectedDeliveryAt: string;
  orderedAt?: string;
  notes: string | null;
  items: FuelOrderItem[];
}

/* -------------------------------------------------------------- deliveries */

/** doc 03 §16 — exact enum. */
export const DELIVERY_STATUSES = ['PENDING', 'RECEIVED', 'DISPUTED', 'CANCELLED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DeliveryItem {
  id: string;
  fuelTypeId: string;
  fuelTypeName?: string;
  expectedQuantityLitres: number;
  /** Only ever supplied on receive (doc 04 §50). */
  actualQuantityLitres: number | null;
  /** actual - expected (doc 03 §42). Negative means a shortage. */
  differenceLitres: number | null;
  discrepancyReason: string | null;
}

export interface Delivery {
  id: string;
  deliveryNumber: string | null;
  status: DeliveryStatus;
  fuelOrderId: string;
  tankerId: string;
  destinationBranchId: string;
  deliveredAt: string;
  notes: string | null;
  items: DeliveryItem[];
  /* Enrichment: these nested refs are not in the doc 04 examples, but are
     required to render the receiving screen. Treated as optional. */
  tanker?: EntityRef & { registrationNumber?: string; driverName?: string | null };
  fuelOrder?: { id: string; orderNumber: string };
}

/** doc 04 §50 — receive body carries only these per item. */
export interface ReceiveDeliveryItemInput {
  fuelTypeId: string;
  actualQuantityLitres: number;
  discrepancyReason?: string;
}

/* --------------------------------------------------------------- inventory */

/** doc 03 §17 — exact enum. TRANSFER_* are future branch transfers. */
export const INVENTORY_TRANSACTION_TYPES = [
  'OPENING_BALANCE',
  'DELIVERY',
  'SALE',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'CORRECTION',
] as const;
export type InventoryTransactionType = (typeof INVENTORY_TRANSACTION_TYPES)[number];

/** doc 03 §45 — sign convention. */
export const TRANSACTION_TYPE_SIGNS: Record<InventoryTransactionType, 1 | -1 | 0> = {
  OPENING_BALANCE: 1,
  DELIVERY: 1,
  SALE: -1,
  ADJUSTMENT: 0, // either direction
  TRANSFER_IN: 1,
  TRANSFER_OUT: -1,
  CORRECTION: 0, // either direction
};

/** doc 04 §54 */
export interface InventoryStock {
  branchId: string;
  branchName: string;
  fuelTypeId: string;
  fuelTypeName: string;
  currentQuantityLitres: number;
}

/** doc 04 §55 */
export interface InventoryTransaction {
  id: string;
  branchId?: string;
  fuelTypeId?: string;
  transactionType: InventoryTransactionType;
  /** Signed. Negative for SALE. */
  quantityLitres: number;
  /** Derived snapshot — authoritative value is the sum of transactions. */
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  occurredAt: string;
  reason?: string | null;
}

/** doc 04 §56 */
export interface InventorySummary {
  branchId: string;
  asOf: string;
  fuel: Array<{
    fuelTypeId: string;
    /** Note the key is `fuelType`, not `fuelTypeName` as in GET /inventory. */
    fuelType: string;
    currentQuantityLitres: number;
  }>;
}

/* ------------------------------------------------------------------ sales */

export interface Sale {
  id: string;
  /** Format `SALE-2026-000001`, unique per business (doc 03 §53). */
  saleNumber: string;
  branchId: string;
  fuelTypeId: string;
  fuelTypeName?: string;
  litresSold: number;
  /** Snapshotted at sale time; never recomputed (doc 03 §52). */
  unitPrice: number;
  /** litresSold × unitPrice — computed by the backend only. */
  totalAmount: number;
  soldAt: string;
  voidedAt?: string | null;
  voidReason?: string | null;
}

/** Derived from `voidedAt` (doc 05 §61) — there is no sale_status column. */
export type SaleStatus = 'CREATED' | 'VOIDED';
export function saleStatus(sale: Pick<Sale, 'voidedAt'>): SaleStatus {
  return sale.voidedAt ? 'VOIDED' : 'CREATED';
}

/* ---------------------------------------------------------- daily reports */

/** doc 03 §18 — exact enum. UNDER_REVIEW has no documented transition. */
export const DAILY_REPORT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;
export type DailyReportStatus = (typeof DAILY_REPORT_STATUSES)[number];

/**
 * doc 05 §57 shows DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED, but
 * doc 04 documents only submit/approve/reject/resubmit — no operation sets or
 * clears UNDER_REVIEW. It is therefore deliberately absent as a transition
 * target (ASSUMPTIONS.md §3.3). It remains a valid enum value for rendering.
 */
export const DAILY_REPORT_TRANSITIONS: Record<DailyReportStatus, DailyReportStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['DRAFT'],
};

/** doc 04 §67 — all Litres/Revenue fields are backend-calculated. */
export interface DailyReport {
  id: string;
  branchId: string;
  /** Bare DATE, e.g. "2026-10-05". Unique per (branchId, reportDate). */
  reportDate: string;
  status: DailyReportStatus;
  openingStockLitres: number;
  totalReceivedLitres: number;
  totalSoldLitres: number;
  closingStockLitres: number;
  totalRevenue: number;
  managerNotes: string | null;
  /* Present in the DB (doc 03 §55) but absent from doc 04 examples.
     Modelled optional. */
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
}

/* ---------------------------------------------------------- notifications */

/** doc 03 §19 — exact enum. */
export const NOTIFICATION_TYPES = [
  'REPORT_SUBMITTED',
  'REPORT_APPROVED',
  'REPORT_REJECTED',
  'DELIVERY_RECEIVED',
  'DELIVERY_DISCREPANCY',
  'LOW_INVENTORY',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** doc 03 §20 */
export const NOTIFICATION_STATUSES = ['UNREAD', 'READ'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  status: NotificationStatus;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  readAt: string | null;
}

/* -------------------------------------------------------------- dashboard */

/** doc 04 §76 */
export interface AdminDashboard {
  summary: {
    totalBranches: number;
    totalFuelReceivedLitres: number;
    totalFuelSoldLitres: number;
    totalRevenue: number;
    lowInventoryBranches: number;
  };
  branches: Array<{
    branchId: string;
    branchName: string;
    fuelSoldLitres: number;
    revenue: number;
  }>;
}

/** doc 04 §77 */
export interface ManagerDashboard {
  branch: EntityRef;
  inventory: InventoryStock[];
  today: {
    litresSold: number;
    revenue: number;
  };
  dailyReport: {
    status: DailyReportStatus;
  } | null;
}

/* ------------------------------------------------------------- audit logs */

/** doc 04 §88 */
export const AUDIT_ACTIONS = [
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'BUSINESS_CREATED',
  'BUSINESS_UPDATED',
  'BRANCH_CREATED',
  'BRANCH_UPDATED',
  'FUEL_TYPE_CREATED',
  'FUEL_TYPE_UPDATED',
  'FUEL_PRICE_CREATED',
  'SUPPLIER_CREATED',
  'SUPPLIER_UPDATED',
  'TANKER_CREATED',
  'TANKER_UPDATED',
  'FUEL_ORDER_CREATED',
  'FUEL_ORDER_SUBMITTED',
  'FUEL_ORDER_CONFIRMED',
  'FUEL_ORDER_CANCELLED',
  'DELIVERY_CREATED',
  'DELIVERY_RECEIVED',
  'DELIVERY_DISPUTED',
  'INVENTORY_ADJUSTED',
  'SALE_CREATED',
  'SALE_VOIDED',
  'DAILY_REPORT_CREATED',
  'DAILY_REPORT_SUBMITTED',
  'DAILY_REPORT_APPROVED',
  'DAILY_REPORT_REJECTED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'PASSWORD_RESET',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLog {
  id: string;
  businessId: string | null;
  branchId: string | null;
  /** Named `user_id` in the DB; the API returns `actorId` per doc 02 §33. */
  userId: string | null;
  action: AuditAction | string;
  resourceType: string | null;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

/* ------------------------------------------------------- envelope shapes */

/** doc 04 §6 — `{ data }` for single resources, `{ data, meta }` for collections. */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** doc 04 §7 */
export interface ApiFieldError {
  field: string;
  message: string;
}
