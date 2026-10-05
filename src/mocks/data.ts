/**
 * Development seed data for the mock API.
 *
 * Modelled on `docs/08` §77 (K.B.Y GLOBAL INVESTMENT: PMS/AGO/DPK) and
 * `docs/03` §85 (branches KBY-IKEJA, KBY-YABA, KBY-LEKKI).
 *
 * These are demo values only — PROMPT.md §35 forbids hardcoding business data
 * into the application, so nothing under `src/app` may import this module.
 */

import type {
  AdminDashboard,
  AppNotification,
  AuditLog,
  Branch,
  Business,
  DailyReport,
  Delivery,
  FuelOrder,
  FuelPrice,
  FuelType,
  InventoryStock,
  InventoryTransaction,
  ManagerDashboard,
  Sale,
  Supplier,
  Tanker,
  User,
} from '@/types/domain';

export const BUSINESS_ID = 'b0000000-0000-4000-8000-000000000001';

export const BRANCHES: Branch[] = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    businessId: BUSINESS_ID,
    name: 'KBY Ikeja',
    code: 'KBY-IKEJA',
    address: 'Obafemi Awolowo Way, Ikeja, Lagos',
    phone: '+2348000000001',
    status: 'ACTIVE',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    businessId: BUSINESS_ID,
    name: 'KBY Yaba',
    code: 'KBY-YABA',
    address: 'Herbert Macaulay Way, Yaba, Lagos',
    phone: '+2348000000002',
    status: 'ACTIVE',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000003',
    businessId: BUSINESS_ID,
    name: 'KBY Lekki',
    code: 'KBY-LEKKI',
    address: 'Admiralty Way, Lekki, Lagos',
    phone: '+2348000000003',
    status: 'ACTIVE',
  },
];

export const BUSINESS: Business = {
  id: BUSINESS_ID,
  name: 'K.B.Y GLOBAL INVESTMENT',
  registrationNumber: 'RC123456',
  email: 'info@kbyglobal.com',
  phone: '+2348000000000',
  address: 'Lagos, Nigeria',
  status: 'ACTIVE',
};

/** doc 06 §5 — scope invariants are enforced per role. */
export const USERS: User[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    businessId: null,
    branchId: null,
    firstName: 'Platform',
    lastName: 'Root',
    email: 'superadmin@kbyglobal.com',
    phone: null,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'a0000000-0000-4000-8000-000000000002',
    businessId: BUSINESS_ID,
    branchId: null,
    firstName: 'Ahmad',
    lastName: 'Abdulkareem',
    email: 'admin@kbyglobal.com',
    phone: '+2348000000000',
    role: 'ADMIN',
    status: 'ACTIVE',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    businessId: BUSINESS_ID,
    branchId: BRANCHES[0]!.id,
    firstName: 'Tunde',
    lastName: 'Bakare',
    email: 'manager@kbyglobal.com',
    phone: '+2348000000010',
    role: 'MANAGER',
    status: 'ACTIVE',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'a0000000-0000-4000-8000-000000000004',
    businessId: BUSINESS_ID,
    branchId: BRANCHES[1]!.id,
    firstName: 'Emeka',
    lastName: 'Obi',
    email: 'manager.yaba@kbyglobal.com',
    phone: '+2348000000011',
    role: 'MANAGER',
    status: 'ACTIVE',
    lastLoginAt: null,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000005',
    businessId: BUSINESS_ID,
    branchId: BRANCHES[2]!.id,
    firstName: 'Fatima',
    lastName: 'Sani',
    email: 'manager.lekki@kbyglobal.com',
    phone: '+2348000000012',
    role: 'MANAGER',
    status: 'SUSPENDED',
    lastLoginAt: null,
  },
];

export const FUEL_TYPES: FuelType[] = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    name: 'Premium Motor Spirit',
    code: 'PMS',
    description: 'Petrol',
    status: 'ACTIVE',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    name: 'Automotive Gas Oil',
    code: 'AGO',
    description: 'Diesel',
    status: 'ACTIVE',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000003',
    name: 'Dual Purpose Kerosene',
    code: 'DPK',
    description: 'Kerosene',
    status: 'ACTIVE',
  },
];

const daysAgo = (n: number, hour = 9): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

/**
 * doc 08 §17 — price intervals are [effectiveFrom, effectiveTo), start
 * inclusive and end exclusive, so they never overlap.
 */
export const FUEL_PRICES: FuelPrice[] = [
  // PMS history: 1500 → 1550 → 1600 (doc 08 §46)
  {
    id: 'e0000000-0000-4000-8000-000000000001',
    fuelTypeId: FUEL_TYPES[0]!.id,
    pricePerLitre: 1500,
    effectiveFrom: daysAgo(60, 0),
    effectiveTo: daysAgo(30, 0),
  },
  {
    id: 'e0000000-0000-4000-8000-000000000002',
    fuelTypeId: FUEL_TYPES[0]!.id,
    pricePerLitre: 1550,
    effectiveFrom: daysAgo(30, 0),
    effectiveTo: daysAgo(8, 0),
  },
  {
    id: 'e0000000-0000-4000-8000-000000000003',
    fuelTypeId: FUEL_TYPES[0]!.id,
    pricePerLitre: 1600,
    effectiveFrom: daysAgo(8, 0),
    effectiveTo: null,
  },
  // AGO
  {
    id: 'e0000000-0000-4000-8000-000000000004',
    fuelTypeId: FUEL_TYPES[1]!.id,
    pricePerLitre: 1650,
    effectiveFrom: daysAgo(60, 0),
    effectiveTo: daysAgo(8, 0),
  },
  {
    id: 'e0000000-0000-4000-8000-000000000005',
    fuelTypeId: FUEL_TYPES[1]!.id,
    pricePerLitre: 1750,
    effectiveFrom: daysAgo(8, 0),
    effectiveTo: null,
  },
  // DPK
  {
    id: 'e0000000-0000-4000-8000-000000000006',
    fuelTypeId: FUEL_TYPES[2]!.id,
    pricePerLitre: 1400,
    effectiveFrom: daysAgo(60, 0),
    effectiveTo: null,
  },
  // A scheduled future PMS price — exercises the "future pricing" UI.
  {
    id: 'e0000000-0000-4000-8000-000000000007',
    fuelTypeId: FUEL_TYPES[0]!.id,
    pricePerLitre: 1650,
    effectiveFrom: daysAgo(-6, 0),
    effectiveTo: null,
  },
];

export const SUPPLIERS: Supplier[] = [
  {
    id: 'f0000000-0000-4000-8000-000000000001',
    businessId: BUSINESS_ID,
    name: 'NNPC Mega Depot',
    code: 'SUP-001',
    contactPerson: 'Aliyu Mohammed',
    phone: '+2348011111111',
    email: 'orders@nnpcdepot.example',
    address: 'Egbin, Lagos',
    status: 'ACTIVE',
  },
  {
    id: 'f0000000-0000-4000-8000-000000000002',
    businessId: BUSINESS_ID,
    name: 'Total Energies Trading',
    code: 'SUP-002',
    contactPerson: 'Chidi Nwosu',
    phone: '+2348022222222',
    email: 'supply@total.example',
    address: 'Apapa, Lagos',
    status: 'ACTIVE',
  },
  {
    id: 'f0000000-0000-4000-8000-000000000003',
    businessId: BUSINESS_ID,
    name: 'Ajah Depot Services',
    code: 'SUP-003',
    contactPerson: 'Grace Eze',
    phone: '+2348033333333',
    email: 'sales@ajahdepot.example',
    address: 'Ajah, Lagos',
    status: 'INACTIVE',
  },
];

export const TANKERS: Tanker[] = [
  {
    id: '91000000-0000-4000-8000-000000000001',
    businessId: BUSINESS_ID,
    registrationNumber: 'ABC-123-LA',
    tankerCode: 'TANK-001',
    capacityLitres: 45000,
    driverName: 'John Driver',
    driverPhone: '+2348044444444',
    status: 'ACTIVE',
  },
  {
    id: '91000000-0000-4000-8000-000000000002',
    businessId: BUSINESS_ID,
    registrationNumber: 'XYZ-789-BD',
    tankerCode: 'TANK-002',
    capacityLitres: 33000,
    driverName: 'Peter Okonkwo',
    driverPhone: '+2348055555555',
    status: 'ACTIVE',
  },
  {
    id: '91000000-0000-4000-8000-000000000003',
    businessId: BUSINESS_ID,
    registrationNumber: 'KLM-456-JJ',
    tankerCode: 'TANK-003',
    capacityLitres: 50000,
    driverName: 'Sani Yusuf',
    driverPhone: '+2348066666666',
    status: 'INACTIVE',
  },
];

export const FUEL_ORDERS: FuelOrder[] = [
  {
    id: '11000000-0000-4000-8000-000000000001',
    orderNumber: 'ORD-2026-000001',
    status: 'IN_TRANSIT',
    supplier: { id: SUPPLIERS[0]!.id, name: SUPPLIERS[0]!.name },
    destinationBranch: { id: BRANCHES[0]!.id, name: BRANCHES[0]!.name },
    expectedDeliveryAt: daysAgo(-1, 10),
    orderedAt: daysAgo(6, 11),
    notes: 'Morning delivery',
    items: [
      {
        fuelTypeId: FUEL_TYPES[0]!.id,
        fuelTypeName: 'PMS',
        expectedQuantityLitres: 45000,
        unitCost: 1200,
      },
    ],
  },
  {
    id: '11000000-0000-4000-8000-000000000002',
    orderNumber: 'ORD-2026-000002',
    status: 'CONFIRMED',
    supplier: { id: SUPPLIERS[1]!.id, name: SUPPLIERS[1]!.name },
    destinationBranch: { id: BRANCHES[1]!.id, name: BRANCHES[1]!.name },
    expectedDeliveryAt: daysAgo(-3, 9),
    orderedAt: daysAgo(3, 14),
    notes: null,
    items: [
      {
        fuelTypeId: FUEL_TYPES[1]!.id,
        fuelTypeName: 'AGO',
        expectedQuantityLitres: 33000,
        unitCost: 1400,
      },
      {
        fuelTypeId: FUEL_TYPES[2]!.id,
        fuelTypeName: 'DPK',
        expectedQuantityLitres: 15000,
        unitCost: 1050,
      },
    ],
  },
  {
    id: '11000000-0000-4000-8000-000000000003',
    orderNumber: 'ORD-2026-000003',
    status: 'SUBMITTED',
    supplier: { id: SUPPLIERS[0]!.id, name: SUPPLIERS[0]!.name },
    destinationBranch: { id: BRANCHES[0]!.id, name: BRANCHES[0]!.name },
    expectedDeliveryAt: daysAgo(-5, 8),
    orderedAt: daysAgo(1, 16),
    notes: 'Awaiting supplier confirmation',
    items: [
      {
        fuelTypeId: FUEL_TYPES[0]!.id,
        fuelTypeName: 'PMS',
        expectedQuantityLitres: 45000,
        unitCost: 1250,
      },
    ],
  },
  {
    id: '11000000-0000-4000-8000-000000000004',
    orderNumber: 'ORD-2026-000004',
    status: 'DRAFT',
    supplier: { id: SUPPLIERS[1]!.id, name: SUPPLIERS[1]!.name },
    destinationBranch: { id: BRANCHES[2]!.id, name: BRANCHES[2]!.name },
    expectedDeliveryAt: daysAgo(-8, 12),
    orderedAt: daysAgo(0, 12),
    notes: null,
    items: [
      {
        fuelTypeId: FUEL_TYPES[0]!.id,
        fuelTypeName: 'PMS',
        expectedQuantityLitres: 50000,
        unitCost: 1240,
      },
    ],
  },
  {
    id: '11000000-0000-4000-8000-000000000005',
    orderNumber: 'ORD-2026-000005',
    status: 'DELIVERED',
    supplier: { id: SUPPLIERS[0]!.id, name: SUPPLIERS[0]!.name },
    destinationBranch: { id: BRANCHES[0]!.id, name: BRANCHES[0]!.name },
    expectedDeliveryAt: daysAgo(4, 10),
    orderedAt: daysAgo(9, 9),
    notes: null,
    items: [
      {
        fuelTypeId: FUEL_TYPES[0]!.id,
        fuelTypeName: 'PMS',
        expectedQuantityLitres: 45000,
        unitCost: 1180,
      },
    ],
  },
  {
    id: '11000000-0000-4000-8000-000000000006',
    orderNumber: 'ORD-2026-000006',
    status: 'CANCELLED',
    supplier: { id: SUPPLIERS[1]!.id, name: SUPPLIERS[1]!.name },
    destinationBranch: { id: BRANCHES[1]!.id, name: BRANCHES[1]!.name },
    expectedDeliveryAt: daysAgo(7, 10),
    orderedAt: daysAgo(12, 10),
    notes: 'Supplier could not fulfil the order.',
    items: [
      {
        fuelTypeId: FUEL_TYPES[2]!.id,
        fuelTypeName: 'DPK',
        expectedQuantityLitres: 15000,
        unitCost: 1040,
      },
    ],
  },
];

export const DELIVERIES: Delivery[] = [
  {
    id: '12000000-0000-4000-8000-000000000001',
    deliveryNumber: 'DEL-2026-000001',
    status: 'PENDING',
    fuelOrderId: FUEL_ORDERS[0]!.id,
    tankerId: TANKERS[0]!.id,
    destinationBranchId: BRANCHES[0]!.id,
    deliveredAt: daysAgo(-1, 10),
    notes: 'Awaiting receipt at branch',
    items: [
      {
        id: '13000000-0000-4000-8000-000000000001',
        fuelTypeId: FUEL_TYPES[0]!.id,
        fuelTypeName: 'PMS',
        expectedQuantityLitres: 45000,
        actualQuantityLitres: null,
        differenceLitres: null,
        discrepancyReason: null,
      },
    ],
    tanker: {
      id: TANKERS[0]!.id,
      name: TANKERS[0]!.registrationNumber,
      registrationNumber: TANKERS[0]!.registrationNumber,
      driverName: TANKERS[0]!.driverName,
    },
    fuelOrder: { id: FUEL_ORDERS[0]!.id, orderNumber: FUEL_ORDERS[0]!.orderNumber },
  },
  {
    id: '12000000-0000-4000-8000-000000000002',
    deliveryNumber: 'DEL-2026-000002',
    status: 'PENDING',
    fuelOrderId: FUEL_ORDERS[1]!.id,
    tankerId: TANKERS[1]!.id,
    destinationBranchId: BRANCHES[1]!.id,
    deliveredAt: daysAgo(-2, 9),
    notes: null,
    items: [
      {
        id: '13000000-0000-4000-8000-000000000002',
        fuelTypeId: FUEL_TYPES[1]!.id,
        fuelTypeName: 'AGO',
        expectedQuantityLitres: 33000,
        actualQuantityLitres: null,
        differenceLitres: null,
        discrepancyReason: null,
      },
      {
        id: '13000000-0000-4000-8000-000000000003',
        fuelTypeId: FUEL_TYPES[2]!.id,
        fuelTypeName: 'DPK',
        expectedQuantityLitres: 15000,
        actualQuantityLitres: null,
        differenceLitres: null,
        discrepancyReason: null,
      },
    ],
    tanker: {
      id: TANKERS[1]!.id,
      name: TANKERS[1]!.registrationNumber,
      registrationNumber: TANKERS[1]!.registrationNumber,
      driverName: TANKERS[1]!.driverName,
    },
    fuelOrder: { id: FUEL_ORDERS[1]!.id, orderNumber: FUEL_ORDERS[1]!.orderNumber },
  },
  {
    // Short delivery — the discrepancy UI (PROMPT.md §11) needs this case.
    id: '12000000-0000-4000-8000-000000000003',
    deliveryNumber: 'DEL-2026-000003',
    status: 'PENDING',
    fuelOrderId: FUEL_ORDERS[2]!.id,
    tankerId: TANKERS[0]!.id,
    destinationBranchId: BRANCHES[0]!.id,
    deliveredAt: daysAgo(-1, 15),
    notes: null,
    items: [
      {
        id: '13000000-0000-4000-8000-000000000004',
        fuelTypeId: FUEL_TYPES[0]!.id,
        fuelTypeName: 'PMS',
        expectedQuantityLitres: 45000,
        actualQuantityLitres: null,
        differenceLitres: null,
        discrepancyReason: null,
      },
    ],
    tanker: {
      id: TANKERS[0]!.id,
      name: TANKERS[0]!.registrationNumber,
      registrationNumber: TANKERS[0]!.registrationNumber,
      driverName: TANKERS[0]!.driverName,
    },
    fuelOrder: { id: FUEL_ORDERS[2]!.id, orderNumber: FUEL_ORDERS[2]!.orderNumber },
  },
  {
    // doc 08 §11 worked example: expected 45,000 / actual 44,850 / -150 L.
    id: '12000000-0000-4000-8000-000000000004',
    deliveryNumber: 'DEL-2026-000004',
    status: 'RECEIVED',
    fuelOrderId: FUEL_ORDERS[4]!.id,
    tankerId: TANKERS[0]!.id,
    destinationBranchId: BRANCHES[0]!.id,
    deliveredAt: daysAgo(4, 10),
    notes: 'Received and verified.',
    items: [
      {
        id: '13000000-0000-4000-8000-000000000005',
        fuelTypeId: FUEL_TYPES[0]!.id,
        fuelTypeName: 'PMS',
        expectedQuantityLitres: 45000,
        actualQuantityLitres: 44850,
        differenceLitres: -150,
        discrepancyReason: 'Short delivery',
      },
    ],
    tanker: {
      id: TANKERS[0]!.id,
      name: TANKERS[0]!.registrationNumber,
      registrationNumber: TANKERS[0]!.registrationNumber,
      driverName: TANKERS[0]!.driverName,
    },
    fuelOrder: { id: FUEL_ORDERS[4]!.id, orderNumber: FUEL_ORDERS[4]!.orderNumber },
  },
  {
    id: '12000000-0000-4000-8000-000000000005',
    deliveryNumber: 'DEL-2026-000005',
    status: 'DISPUTED',
    fuelOrderId: FUEL_ORDERS[1]!.id,
    tankerId: TANKERS[1]!.id,
    destinationBranchId: BRANCHES[0]!.id,
    deliveredAt: daysAgo(5, 11),
    notes: null,
    items: [
      {
        id: '13000000-0000-4000-8000-000000000006',
        fuelTypeId: FUEL_TYPES[2]!.id,
        fuelTypeName: 'DPK',
        expectedQuantityLitres: 15000,
        actualQuantityLitres: 12800,
        differenceLitres: -2200,
        discrepancyReason: 'Significant shortage on arrival',
      },
    ],
    tanker: {
      id: TANKERS[1]!.id,
      name: TANKERS[1]!.registrationNumber,
      registrationNumber: TANKERS[1]!.registrationNumber,
      driverName: TANKERS[1]!.driverName,
    },
  },
];

/** Current stock per branch × fuel type (doc 04 §54). */
export const INVENTORY_STOCK: InventoryStock[] = BRANCHES.flatMap((branch, bi) => {
  const base = bi === 0 ? 86500 : bi === 1 ? 42000 : 27500;
  return FUEL_TYPES.map((fuel, fi) => ({
    branchId: branch.id,
    branchName: branch.name,
    fuelTypeId: fuel.id,
    fuelTypeName: fuel.code,
    currentQuantityLitres: base - fi * 21000,
  }));
});

/** doc 03 §45 sign convention. */
export const INVENTORY_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: '14000000-0000-4000-8000-000000000001',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[0]!.id,
    transactionType: 'OPENING_BALANCE',
    quantityLitres: 86500,
    balanceAfter: 86500,
    referenceType: null,
    referenceId: null,
    occurredAt: daysAgo(14, 6),
  },
  {
    id: '14000000-0000-4000-8000-000000000002',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[0]!.id,
    transactionType: 'DELIVERY',
    quantityLitres: 44850,
    balanceAfter: 131350,
    referenceType: 'DELIVERY',
    referenceId: DELIVERIES[3]!.id,
    occurredAt: daysAgo(4, 10),
  },
  {
    id: '14000000-0000-4000-8000-000000000003',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[0]!.id,
    transactionType: 'SALE',
    quantityLitres: -8500,
    balanceAfter: 122850,
    referenceType: 'SALE',
    referenceId: '15000000-0000-4000-8000-000000000001',
    occurredAt: daysAgo(1, 15),
  },
  {
    id: '14000000-0000-4000-8000-000000000004',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[0]!.id,
    transactionType: 'SALE',
    quantityLitres: -20000,
    balanceAfter: 102850,
    referenceType: 'SALE',
    referenceId: '15000000-0000-4000-8000-000000000002',
    occurredAt: daysAgo(0, 11),
  },
  {
    id: '14000000-0000-4000-8000-000000000005',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[1]!.id,
    transactionType: 'OPENING_BALANCE',
    quantityLitres: 42000,
    balanceAfter: 42000,
    referenceType: null,
    referenceId: null,
    occurredAt: daysAgo(14, 6),
  },
  {
    id: '14000000-0000-4000-8000-000000000006',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[1]!.id,
    transactionType: 'ADJUSTMENT',
    quantityLitres: -100,
    balanceAfter: 41900,
    referenceType: 'ADJUSTMENT',
    referenceId: null,
    reason: 'Physical stock count discrepancy',
    occurredAt: daysAgo(2, 17),
  },
  {
    id: '14000000-0000-4000-8000-000000000007',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[2]!.id,
    transactionType: 'OPENING_BALANCE',
    quantityLitres: 15500,
    balanceAfter: 15500,
    referenceType: null,
    referenceId: null,
    occurredAt: daysAgo(14, 6),
  },
];

export const SALES: Sale[] = [
  {
    id: '15000000-0000-4000-8000-000000000001',
    saleNumber: 'SALE-2026-000001',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[0]!.id,
    fuelTypeName: 'PMS',
    litresSold: 8500,
    unitPrice: 1550,
    totalAmount: 13175000,
    soldAt: daysAgo(1, 15),
    voidedAt: null,
    voidReason: null,
  },
  {
    id: '15000000-0000-4000-8000-000000000002',
    saleNumber: 'SALE-2026-000002',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[0]!.id,
    fuelTypeName: 'PMS',
    litresSold: 20000,
    unitPrice: 1600,
    totalAmount: 32000000,
    soldAt: daysAgo(0, 11),
    voidedAt: null,
    voidReason: null,
  },
  {
    id: '15000000-0000-4000-8000-000000000003',
    saleNumber: 'SALE-2026-000003',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[1]!.id,
    fuelTypeName: 'AGO',
    litresSold: 4500,
    unitPrice: 1750,
    totalAmount: 7875000,
    soldAt: daysAgo(0, 9),
    voidedAt: null,
    voidReason: null,
  },
  {
    id: '15000000-0000-4000-8000-000000000004',
    saleNumber: 'SALE-2026-000004',
    branchId: BRANCHES[0]!.id,
    fuelTypeId: FUEL_TYPES[0]!.id,
    fuelTypeName: 'PMS',
    litresSold: 2500,
    unitPrice: 1550,
    totalAmount: 3875000,
    soldAt: daysAgo(2, 13),
    // Voiding must not delete history — the inventory correction remains.
    voidedAt: daysAgo(1, 10),
    voidReason: 'Duplicate sale entry',
  },
  {
    id: '15000000-0000-4000-8000-000000000005',
    saleNumber: 'SALE-2026-000005',
    branchId: BRANCHES[1]!.id,
    fuelTypeId: FUEL_TYPES[1]!.id,
    fuelTypeName: 'AGO',
    litresSold: 6000,
    unitPrice: 1750,
    totalAmount: 10500000,
    soldAt: daysAgo(0, 14),
    voidedAt: null,
    voidReason: null,
  },
];

const isoDate = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const DAILY_REPORTS: DailyReport[] = [
  {
    id: '16000000-0000-4000-8000-000000000001',
    branchId: BRANCHES[0]!.id,
    reportDate: isoDate(0),
    status: 'DRAFT',
    openingStockLitres: 131350,
    totalReceivedLitres: 0,
    totalSoldLitres: 33000,
    closingStockLitres: 98350,
    totalRevenue: 39875000,
    managerNotes: 'Normal business operations.',
  },
  {
    id: '16000000-0000-4000-8000-000000000002',
    branchId: BRANCHES[0]!.id,
    reportDate: isoDate(1),
    status: 'SUBMITTED',
    openingStockLitres: 131350,
    totalReceivedLitres: 44850,
    totalSoldLitres: 8500,
    closingStockLitres: 167700,
    totalRevenue: 13175000,
    managerNotes: 'Morning delivery received.',
  },
  {
    id: '16000000-0000-4000-8000-000000000003',
    branchId: BRANCHES[0]!.id,
    reportDate: isoDate(2),
    status: 'APPROVED',
    openingStockLitres: 86500,
    totalReceivedLitres: 0,
    totalSoldLitres: 2500,
    closingStockLitres: 84000,
    totalRevenue: 3875000,
    managerNotes: 'Quiet trading day.',
    reviewedAt: daysAgo(1, 12),
    reviewedBy: USERS[1]!.id,
  },
  {
    id: '16000000-0000-4000-8000-000000000004',
    branchId: BRANCHES[0]!.id,
    reportDate: isoDate(3),
    status: 'REJECTED',
    openingStockLitres: 86500,
    totalReceivedLitres: 0,
    totalSoldLitres: 0,
    closingStockLitres: 86500,
    totalRevenue: 0,
    managerNotes: 'No sales recorded.',
    reviewedAt: daysAgo(2, 12),
    reviewedBy: USERS[1]!.id,
    rejectionReason: 'Closing stock does not match the physical stock count.',
  },
];

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: '17000000-0000-4000-8000-000000000001',
    type: 'REPORT_SUBMITTED',
    title: 'Daily report submitted',
    message: 'Tunde Bakare submitted the daily report for KBY Ikeja.',
    status: 'UNREAD',
    resourceType: 'DAILY_REPORT',
    resourceId: DAILY_REPORTS[1]!.id,
    createdAt: daysAgo(0, 12),
    readAt: null,
  },
  {
    id: '17000000-0000-4000-8000-000000000002',
    type: 'LOW_INVENTORY',
    title: 'Low inventory',
    message: 'DPK stock at KBY Yaba is running low.',
    status: 'UNREAD',
    resourceType: 'BRANCH',
    resourceId: BRANCHES[1]!.id,
    createdAt: daysAgo(0, 8),
    readAt: null,
  },
  {
    id: '17000000-0000-4000-8000-000000000003',
    type: 'DELIVERY_RECEIVED',
    title: 'Delivery received',
    message: 'DEL-2026-000004 was received with a 150 L shortage.',
    status: 'UNREAD',
    resourceType: 'DELIVERY',
    resourceId: DELIVERIES[3]!.id,
    createdAt: daysAgo(4, 11),
    readAt: null,
  },
  {
    id: '17000000-0000-4000-8000-000000000004',
    type: 'REPORT_APPROVED',
    title: 'Daily report approved',
    message: 'Your report for 02 October was approved.',
    status: 'READ',
    resourceType: 'DAILY_REPORT',
    resourceId: DAILY_REPORTS[2]!.id,
    createdAt: daysAgo(1, 12),
    readAt: daysAgo(1, 13),
  },
];

export const AUDIT_LOGS: AuditLog[] = [
  {
    id: '18000000-0000-4000-8000-000000000001',
    businessId: BUSINESS_ID,
    branchId: BRANCHES[0]!.id,
    userId: USERS[2]!.id,
    action: 'SALE_CREATED',
    resourceType: 'SALE',
    resourceId: SALES[0]!.id,
    oldValues: null,
    newValues: { litresSold: 8500, unitPrice: 1550, totalAmount: 13175000 },
    metadata: null,
    ipAddress: '102.89.34.12',
    createdAt: daysAgo(1, 15),
  },
  {
    id: '18000000-0000-4000-8000-000000000002',
    businessId: BUSINESS_ID,
    branchId: BRANCHES[0]!.id,
    userId: USERS[2]!.id,
    action: 'DAILY_REPORT_SUBMITTED',
    resourceType: 'DAILY_REPORT',
    resourceId: DAILY_REPORTS[1]!.id,
    oldValues: null,
    newValues: { status: 'SUBMITTED' },
    metadata: null,
    ipAddress: '102.89.34.12',
    createdAt: daysAgo(0, 12),
  },
  {
    id: '18000000-0000-4000-8000-000000000003',
    businessId: BUSINESS_ID,
    branchId: null,
    userId: USERS[1]!.id,
    action: 'FUEL_PRICE_CREATED',
    resourceType: 'FUEL_PRICE',
    resourceId: FUEL_PRICES[2]!.id,
    oldValues: null,
    newValues: { pricePerLitre: 1600, effectiveFrom: FUEL_PRICES[2]!.effectiveFrom },
    metadata: null,
    ipAddress: '102.89.34.55',
    createdAt: daysAgo(8, 8),
  },
  {
    id: '18000000-0000-4000-8000-000000000004',
    businessId: BUSINESS_ID,
    branchId: BRANCHES[0]!.id,
    userId: USERS[2]!.id,
    action: 'DELIVERY_RECEIVED',
    resourceType: 'DELIVERY',
    resourceId: DELIVERIES[3]!.id,
    oldValues: null,
    newValues: { status: 'RECEIVED', differenceLitres: -150 },
    metadata: null,
    ipAddress: '102.89.34.12',
    createdAt: daysAgo(4, 10),
  },
  {
    id: '18000000-0000-4000-8000-000000000005',
    businessId: BUSINESS_ID,
    branchId: null,
    userId: USERS[1]!.id,
    action: 'LOGIN_SUCCESS',
    resourceType: 'AUTH',
    resourceId: null,
    oldValues: null,
    newValues: null,
    metadata: null,
    ipAddress: '102.89.34.55',
    createdAt: daysAgo(0, 7),
  },
];

/* -------------------------------------------------------------- dashboards */

export function buildAdminDashboard(): AdminDashboard {
  const totalRevenue = SALES.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalSold = SALES.reduce((sum, s) => sum + s.litresSold, 0);
  return {
    summary: {
      totalBranches: BRANCHES.length,
      totalFuelReceivedLitres: 59850,
      totalFuelSoldLitres: totalSold,
      totalRevenue,
      // No reorder threshold exists anywhere in the docs (see ASSUMPTIONS.md),
      // so the mock derives this rather than the API.
      lowInventoryBranches: INVENTORY_STOCK.filter((s) => s.currentQuantityLitres < 20000).length,
    },
    branches: BRANCHES.map((b) => {
      const rows = SALES.filter((s) => s.branchId === b.id);
      return {
        branchId: b.id,
        branchName: b.name,
        fuelSoldLitres: rows.reduce((sum, s) => sum + s.litresSold, 0),
        revenue: rows.reduce((sum, s) => sum + s.totalAmount, 0),
      };
    }),
  };
}

export function buildManagerDashboard(branchId: string): ManagerDashboard {
  const branch = BRANCHES.find((b) => b.id === branchId) ?? BRANCHES[0]!;
  const rows = SALES.filter((s) => s.branchId === branch.id && !s.voidedAt);
  const today = new Date().toISOString().slice(0, 10);
  const todaysSales = rows.filter((s) => s.soldAt.slice(0, 10) === today);
  const report = DAILY_REPORTS.find((r) => r.branchId === branch.id);

  return {
    branch: { id: branch.id, name: branch.name },
    inventory: INVENTORY_STOCK.filter((s) => s.branchId === branch.id),
    today: {
      litresSold: todaysSales.reduce((sum, s) => sum + s.litresSold, 0),
      revenue: todaysSales.reduce((sum, s) => sum + s.totalAmount, 0),
    },
    dailyReport: report ? { status: report.status } : null,
  };
}
