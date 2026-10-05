# K.B.Y GLOBAL INVESTMENT
## Fuel Station Operations, Inventory & Revenue Management Platform

**Document:** Database Design  
**Version:** 1.0  
**Status:** Approved for MVP Architecture  
**Related Documents:**
- `01-product-requirements.md`
- `02-system-architecture.md`

---

# 1. Purpose

This document defines the PostgreSQL database architecture for the K.B.Y GLOBAL INVESTMENT Fuel Station Operations, Inventory & Revenue Management Platform.

It defines:

- Database entities
- Relationships
- Columns
- Data types
- Primary keys
- Foreign keys
- Indexes
- Constraints
- Enumerations
- Inventory architecture
- Sales architecture
- Delivery architecture
- Daily reporting architecture
- Audit architecture
- Multi-tenant isolation
- Data integrity rules

The database must preserve the integrity of fuel quantities, sales, deliveries, revenue, and historical records.

---

# 2. Database Technology

## Primary Database

**PostgreSQL**

Recommended PostgreSQL version:

```text
PostgreSQL 16+
```

The exact production version can be selected based on the deployment provider.

## ORM

```text
TypeORM
```

NestJS will use TypeORM for database access and migrations.

---

# 3. Core Database Principles

The database follows these principles:

### Principle 1 — Inventory is ledger-driven

Inventory is not treated as a manually editable number.

Every movement of fuel creates an inventory transaction.

### Principle 2 — Financial records are historical

A change in today's fuel price must never alter historical sales.

### Principle 3 — Operational records are auditable

Important changes must be traceable to the user who performed them.

### Principle 4 — Businesses are isolated

One business must never access another business's data.

### Principle 5 — Managers are branch-scoped

A manager can only operate within their assigned branch.

### Principle 6 — Important records are not physically deleted

Historical sales, deliveries, and inventory transactions must remain available.

### Principle 7 — Database constraints supplement application validation

Important integrity rules should be enforced at both application and database levels.

---

# 4. High-Level Entity Model

The database can be grouped into the following domains.

```text
IDENTITY
├── users
├── refresh_tokens
└── password_reset_tokens

BUSINESS
├── businesses
├── branches
└── business_users

FUEL
├── fuel_types
└── fuel_prices

SUPPLY
├── suppliers
├── tankers
├── fuel_orders
├── fuel_order_items
└── deliveries

OPERATIONS
├── inventory_transactions
├── sales
└── daily_reports

SYSTEM
├── notifications
└── audit_logs
```

---

# 5. Entity Relationship Overview

```text
                         ┌───────────────┐
                         │   BUSINESS    │
                         └───────┬───────┘
                                 │
                    ┌────────────┼─────────────┐
                    │            │             │
                    ▼            ▼             ▼
                 USERS        BRANCHES      SUPPLIERS
                    │            │
                    │            │
                    │            ├───────────────┐
                    │            │               │
                    │            ▼               ▼
                    │       DELIVERIES        SALES
                    │            │               │
                    │            │               │
                    │            ▼               ▼
                    │     INVENTORY <────────────┘
                    │     TRANSACTIONS
                    │
                    └──── DAILY REPORTS

SUPPLIER
   │
   ▼
FUEL ORDER
   │
   ├──────────► TANKER
   │
   ▼
DELIVERY
   │
   ▼
INVENTORY TRANSACTION

FUEL TYPE
   │
   ├────────► FUEL PRICE
   ├────────► SALES
   ├────────► DELIVERY
   └────────► INVENTORY TRANSACTION
```

---

# 6. ID Strategy

All major entities should use UUID primary keys.

Example:

```sql
id UUID PRIMARY KEY
```

PostgreSQL should generate UUIDs using:

```sql
gen_random_uuid()
```

This requires:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

UUIDs should be used for public API resource identifiers.

---

# 7. Timestamp Strategy

All timestamps should use:

```text
TIMESTAMPTZ
```

Example:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

The backend should store timestamps in UTC.

The frontend can display them in the user's local timezone.

---

# 8. Currency Strategy

Amounts should not use floating-point types.

Use:

```text
NUMERIC(18,2)
```

for monetary values.

Example:

```text
unit_price NUMERIC(18,2)
total_amount NUMERIC(18,2)
```

---

# 9. Fuel Quantity Strategy

Fuel quantities should not use floating-point types.

Use:

```text
NUMERIC(18,3)
```

This allows quantities such as:

```text
44850.000
44850.125
```

The exact precision can be adjusted if the business later requires greater measurement accuracy.

---

# 10. ENUMS

The application will define PostgreSQL enums for stable finite states.

Recommended enums:

```text
user_role
account_status
business_status
branch_status
fuel_order_status
delivery_status
inventory_transaction_type
daily_report_status
notification_type
notification_status
audit_action
```

---

# 11. User Role Enum

```sql
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER'
);
```

---

# 12. Account Status Enum

```sql
CREATE TYPE account_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);
```

---

# 13. Business Status Enum

```sql
CREATE TYPE business_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);
```

---

# 14. Branch Status Enum

```sql
CREATE TYPE branch_status AS ENUM (
  'ACTIVE',
  'INACTIVE'
);
```

---

# 15. Fuel Order Status

```sql
CREATE TYPE fuel_order_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'CONFIRMED',
  'IN_TRANSIT',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CANCELLED'
);
```

---

# 16. Delivery Status

```sql
CREATE TYPE delivery_status AS ENUM (
  'PENDING',
  'RECEIVED',
  'DISPUTED',
  'CANCELLED'
);
```

---

# 17. Inventory Transaction Type

```sql
CREATE TYPE inventory_transaction_type AS ENUM (
  'OPENING_BALANCE',
  'DELIVERY',
  'SALE',
  'ADJUSTMENT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'CORRECTION'
);
```

`TRANSFER_IN` and `TRANSFER_OUT` are included for future branch-to-branch fuel transfers.

They may not be exposed in the initial MVP.

---

# 18. Daily Report Status

```sql
CREATE TYPE daily_report_status AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED'
);
```

---

# 19. Notification Type

```sql
CREATE TYPE notification_type AS ENUM (
  'REPORT_SUBMITTED',
  'REPORT_APPROVED',
  'REPORT_REJECTED',
  'DELIVERY_RECEIVED',
  'DELIVERY_DISCREPANCY',
  'LOW_INVENTORY',
  'SYSTEM'
);
```

---

# 20. Notification Status

```sql
CREATE TYPE notification_status AS ENUM (
  'UNREAD',
  'READ'
);
```

---

# 21. Users Table

## Purpose

Stores all platform users.

```text
SUPER_ADMIN
ADMIN
MANAGER
```

## Schema

```sql
users
```

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK, nullable |
| branch_id | UUID | FK, nullable |
| first_name | VARCHAR(100) | NOT NULL |
| last_name | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| phone | VARCHAR(30) | nullable |
| password_hash | TEXT | NOT NULL |
| role | user_role | NOT NULL |
| status | account_status | NOT NULL |
| last_login_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | nullable |

---

# 22. User Business Rules

### SUPER_ADMIN

```text
business_id = NULL
branch_id = NULL
```

### ADMIN

```text
business_id = required
branch_id = NULL
```

### MANAGER

```text
business_id = required
branch_id = required
```

These relationships should be enforced through application validation and, where practical, database constraints.

---

# 23. User Email

Email should be unique.

Recommended:

```sql
UNIQUE (LOWER(email))
```

The application should normalize email addresses to lowercase.

---

# 24. Refresh Tokens

The system should support secure refresh-token management.

Table:

```text
refresh_tokens
```

| Column | Type |
|---|---|
| id | UUID |
| user_id | UUID |
| token_hash | TEXT |
| expires_at | TIMESTAMPTZ |
| revoked_at | TIMESTAMPTZ |
| created_at | TIMESTAMPTZ |
| user_agent | TEXT |
| ip_address | INET |

Raw refresh tokens should not be stored.

Only their hashes should be stored.

---

# 25. Password Reset Tokens

Table:

```text
password_reset_tokens
```

| Column | Type |
|---|---|
| id | UUID |
| user_id | UUID |
| token_hash | TEXT |
| expires_at | TIMESTAMPTZ |
| used_at | TIMESTAMPTZ |
| created_at | TIMESTAMPTZ |

Tokens should expire and should only be usable once.

---

# 26. Businesses Table

Represents a fuel station business/company.

```text
businesses
```

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| registration_number | VARCHAR(100) | nullable |
| email | VARCHAR(255) | nullable |
| phone | VARCHAR(30) | nullable |
| address | TEXT | nullable |
| status | business_status | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | nullable |

Initial record:

```text
K.B.Y GLOBAL INVESTMENT
```

---

# 27. Branches Table

Represents an individual fuel station location.

```text
branches
```

| Column | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| business_id | UUID | FK |
| name | VARCHAR(255) | NOT NULL |
| code | VARCHAR(50) | NOT NULL |
| address | TEXT | NOT NULL |
| phone | VARCHAR(30) | nullable |
| status | branch_status | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |
| deleted_at | TIMESTAMPTZ | nullable |

Constraint:

```text
UNIQUE (business_id, code)
```

This allows two different businesses to theoretically use the same branch code.

---

# 28. Branch Manager Relationship

A manager belongs to one branch through:

```text
users.branch_id
```

For MVP:

```text
One manager → One branch
```

A future system could support multiple managers per branch.

---

# 29. Fuel Types Table

```text
fuel_types
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| name | VARCHAR(100) |
| code | VARCHAR(30) |
| description | TEXT |
| status | account_status |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

Examples:

```text
PMS
AGO
DPK
```

---

# 30. Fuel Type Uniqueness

Fuel type codes should be unique per business.

```text
UNIQUE (business_id, code)
```

---

# 31. Fuel Prices Table

Fuel prices must preserve history.

```text
fuel_prices
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| fuel_type_id | UUID |
| price_per_litre | NUMERIC(18,2) |
| effective_from | TIMESTAMPTZ |
| effective_to | TIMESTAMPTZ |
| created_by | UUID |
| created_at | TIMESTAMPTZ |

---

# 32. Fuel Price History

Example:

```text
Fuel Type: PMS

01 Oct
₦1,500
effective_to = 10 Oct

10 Oct
₦1,550
effective_to = 18 Oct

18 Oct
₦1,600
effective_to = NULL
```

The currently active price has:

```text
effective_to = NULL
```

---

# 33. Price Overlap Rule

Two active price records for the same:

```text
business_id + fuel_type_id
```

must not overlap.

This should be enforced through PostgreSQL exclusion constraints or carefully controlled application/database transactions.

---

# 34. Suppliers Table

```text
suppliers
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| name | VARCHAR(255) |
| code | VARCHAR(50) |
| contact_person | VARCHAR(255) |
| phone | VARCHAR(30) |
| email | VARCHAR(255) |
| address | TEXT |
| status | account_status |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| deleted_at | TIMESTAMPTZ |

---

# 35. Tankers Table

```text
tankers
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| registration_number | VARCHAR(50) |
| tanker_code | VARCHAR(50) |
| capacity_litres | NUMERIC(18,3) |
| driver_name | VARCHAR(255) |
| driver_phone | VARCHAR(30) |
| status | account_status |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| deleted_at | TIMESTAMPTZ |

---

# 36. Tanker Constraints

Within a business:

```text
registration_number
```

must be unique.

```text
UNIQUE (business_id, registration_number)
```

Capacity must be:

```text
> 0
```

---

# 37. Fuel Orders Table

A fuel order represents the business requesting fuel.

```text
fuel_orders
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| order_number | VARCHAR(50) |
| supplier_id | UUID |
| destination_branch_id | UUID |
| status | fuel_order_status |
| ordered_at | TIMESTAMPTZ |
| expected_delivery_at | TIMESTAMPTZ |
| notes | TEXT |
| created_by | UUID |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| cancelled_at | TIMESTAMPTZ |

---

# 38. Fuel Order Number

Order numbers should be human-readable.

Example:

```text
ORD-2026-000001
```

The database should enforce uniqueness within the business:

```text
UNIQUE (business_id, order_number)
```

---

# 39. Fuel Order Items

A fuel order should support multiple fuel types.

Therefore:

```text
fuel_order_items
```

| Column | Type |
|---|---|
| id | UUID |
| fuel_order_id | UUID |
| fuel_type_id | UUID |
| expected_quantity_litres | NUMERIC(18,3) |
| unit_cost | NUMERIC(18,2) |
| created_at | TIMESTAMPTZ |

This allows:

```text
Order #001

PMS: 45,000 L
AGO: 20,000 L
```

in a single order if the business eventually needs it.

For a simple MVP, most orders may contain one fuel type.

---

# 40. Delivery Table

A delivery records what physically arrived.

```text
deliveries
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| fuel_order_id | UUID |
| tanker_id | UUID |
| destination_branch_id | UUID |
| delivery_number | VARCHAR(50) |
| delivery_status | delivery_status |
| delivered_at | TIMESTAMPTZ |
| received_by | UUID |
| notes | TEXT |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

---

# 41. Delivery Items

Because a fuel order may contain multiple fuel types, deliveries should also support multiple items.

```text
delivery_items
```

| Column | Type |
|---|---|
| id | UUID |
| delivery_id | UUID |
| fuel_type_id | UUID |
| expected_quantity_litres | NUMERIC(18,3) |
| actual_quantity_litres | NUMERIC(18,3) |
| difference_litres | NUMERIC(18,3) |
| created_at | TIMESTAMPTZ |

The difference should be calculated:

```text
difference =
actual_quantity - expected_quantity
```

---

# 42. Delivery Discrepancy

Example:

```text
Expected:
45,000 L

Actual:
44,850 L

Difference:
-150 L
```

A negative difference indicates a shortage.

The system should flag significant discrepancies.

---

# 43. Delivery Discrepancy Explanation

The MVP should allow:

```text
discrepancy_reason TEXT
```

in `delivery_items` or a dedicated discrepancy structure.

For MVP simplicity:

```text
delivery_items.discrepancy_reason
```

is sufficient.

---

# 44. Inventory Transactions Table

This is the core table of the platform.

```text
inventory_transactions
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| branch_id | UUID |
| fuel_type_id | UUID |
| transaction_type | inventory_transaction_type |
| quantity_litres | NUMERIC(18,3) |
| balance_after | NUMERIC(18,3) |
| reference_type | VARCHAR(50) |
| reference_id | UUID |
| occurred_at | TIMESTAMPTZ |
| created_by | UUID |
| notes | TEXT |
| created_at | TIMESTAMPTZ |

---

# 45. Inventory Quantity Sign Convention

Inventory transactions should use a consistent sign convention.

### Positive

Adds fuel:

```text
DELIVERY
OPENING_BALANCE
TRANSFER_IN
```

### Negative

Removes fuel:

```text
SALE
TRANSFER_OUT
```

### Adjustment

Can be positive or negative:

```text
ADJUSTMENT
CORRECTION
```

---

# 46. Example Inventory Ledger

```text
Transaction          Quantity

Opening Balance      +10,000
Delivery             +45,000
Sale                  -8,500
Adjustment             -100
----------------------------
Current Stock         46,400 L
```

---

# 47. Balance After

`balance_after` may be stored for fast historical display.

Example:

```text
Transaction      Quantity     Balance
---------------------------------------
Opening          +10,000      10,000
Delivery         +45,000      55,000
Sale              -8,500      46,500
```

However:

> `balance_after` is a derived snapshot, not the fundamental source of truth.

The transaction history remains authoritative.

---

# 48. Inventory Reference

Every inventory transaction should reference the business event that created it.

Examples:

```text
DELIVERY
reference_type = DELIVERY
reference_id = delivery UUID
```

```text
SALE
reference_type = SALE
reference_id = sale UUID
```

This provides traceability.

---

# 49. Inventory Immutability

Inventory transactions should not normally be updated or deleted.

If an error occurs:

```text
Incorrect:
-500 L
```

Do not edit it to:

```text
-300 L
```

Instead create:

```text
CORRECTION
+200 L
```

This preserves the audit trail.

---

# 50. Sales Table

```text
sales
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| branch_id | UUID |
| fuel_type_id | UUID |
| sale_number | VARCHAR(50) |
| litres_sold | NUMERIC(18,3) |
| unit_price | NUMERIC(18,2) |
| total_amount | NUMERIC(18,2) |
| sold_at | TIMESTAMPTZ |
| recorded_by | UUID |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |
| voided_at | TIMESTAMPTZ |
| void_reason | TEXT |

---

# 51. Sale Calculation

The backend calculates:

```text
total_amount =
litres_sold × unit_price
```

Example:

```text
8,500 × ₦1,500
=
₦12,750,000
```

The frontend must not be trusted to provide the final amount.

---

# 52. Historical Price Preservation

When a sale is created:

```text
unit_price
```

must be copied into the sale record.

Do not calculate historical sales by looking up today's price.

Example:

```text
Sale date:
Oct 1

Price:
₦1,500
```

Even if current price becomes:

```text
₦1,600
```

the sale remains:

```text
₦1,500
```

---

# 53. Sale Number

Use human-readable sale numbers:

```text
SALE-2026-000001
```

Unique per business.

```text
UNIQUE (business_id, sale_number)
```

---

# 54. Sale and Inventory Relationship

Every valid sale must have exactly one corresponding inventory transaction.

Conceptually:

```text
SALE
 │
 └── INVENTORY_TRANSACTION
       quantity = -litres_sold
```

The two records must be created inside the same database transaction.

---

# 55. Daily Reports Table

```text
daily_reports
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| branch_id | UUID |
| report_date | DATE |
| status | daily_report_status |
| opening_stock_litres | NUMERIC(18,3) |
| total_received_litres | NUMERIC(18,3) |
| total_sold_litres | NUMERIC(18,3) |
| closing_stock_litres | NUMERIC(18,3) |
| total_revenue | NUMERIC(18,2) |
| manager_notes | TEXT |
| submitted_by | UUID |
| submitted_at | TIMESTAMPTZ |
| reviewed_by | UUID |
| reviewed_at | TIMESTAMPTZ |
| rejection_reason | TEXT |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

---

# 56. Daily Report Uniqueness

A branch should normally have one daily report per day.

Constraint:

```text
UNIQUE (
  branch_id,
  report_date
)
```

This prevents duplicate daily reports.

---

# 57. Daily Report Source of Truth

The report's numerical values should be derived from operational records wherever possible.

For example:

```text
total_sold_litres
```

should be calculated from sales.

```text
total_received_litres
```

should be calculated from deliveries.

```text
total_revenue
```

should be calculated from sales.

This prevents managers from simply entering arbitrary totals.

---

# 58. Daily Report Opening and Closing Stock

Opening stock should correspond to the branch's inventory at the start of the reporting period.

Closing stock should correspond to:

```text
Opening
+ Deliveries
- Sales
+ Adjustments
```

Any discrepancy should be flagged.

---

# 59. Notifications Table

```text
notifications
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| user_id | UUID |
| type | notification_type |
| title | VARCHAR(255) |
| message | TEXT |
| status | notification_status |
| resource_type | VARCHAR(50) |
| resource_id | UUID |
| created_at | TIMESTAMPTZ |
| read_at | TIMESTAMPTZ |

---

# 60. Audit Logs Table

Audit logging is essential for operational accountability.

```text
audit_logs
```

| Column | Type |
|---|---|
| id | UUID |
| business_id | UUID |
| branch_id | UUID |
| user_id | UUID |
| action | VARCHAR(100) |
| resource_type | VARCHAR(100) |
| resource_id | UUID |
| old_values | JSONB |
| new_values | JSONB |
| metadata | JSONB |
| ip_address | INET |
| user_agent | TEXT |
| created_at | TIMESTAMPTZ |

---

# 61. Audit Examples

Example:

```json
{
  "action": "SALE_CREATED",
  "resource_type": "SALE",
  "resource_id": "...",
  "new_values": {
    "litresSold": 8500,
    "unitPrice": 1500,
    "totalAmount": 12750000
  }
}
```

Another:

```json
{
  "action": "REPORT_REJECTED",
  "resource_type": "DAILY_REPORT",
  "resource_id": "...",
  "metadata": {
    "reason": "Closing stock mismatch"
  }
}
```

---

# 62. Audit Immutability

Normal application users must not be able to:

- Update audit logs
- Delete audit logs
- Modify audit history

Audit records should be append-only.

---

# 63. Business-Level Relationships

The primary relationships are:

```text
Business
 │
 ├── Users
 ├── Branches
 ├── Fuel Types
 ├── Fuel Prices
 ├── Suppliers
 ├── Tankers
 ├── Fuel Orders
 ├── Deliveries
 ├── Inventory Transactions
 ├── Sales
 ├── Daily Reports
 ├── Notifications
 └── Audit Logs
```

---

# 64. Branch-Level Relationships

A branch owns:

```text
Branch
 │
 ├── Managers
 ├── Deliveries
 ├── Inventory Transactions
 ├── Sales
 └── Daily Reports
```

---

# 65. Supply Relationships

```text
Supplier
    │
    ▼
Fuel Order
    │
    ├── Fuel Order Items
    │
    ▼
Delivery
    │
    └── Delivery Items
            │
            ▼
    Inventory Transaction
```

---

# 66. Sales Relationships

```text
Manager
   │
   ▼
Sale
   │
   ├── Fuel Type
   ├── Branch
   └── Inventory Transaction
```

---

# 67. Foreign Key Strategy

Foreign keys should use:

```text
ON DELETE RESTRICT
```

for historical/financial records where appropriate.

Do not allow deleting:

```text
Branch
FuelType
Sale
Delivery
InventoryTransaction
```

if doing so would destroy historical integrity.

Prefer soft deletion for master data.

---

# 68. Soft Delete Strategy

Soft delete should be used for:

- Users
- Businesses
- Branches
- Suppliers
- Tankers
- Fuel Types

Financial records should not be soft-deleted as a substitute for correction.

Sales should be voided.

Inventory transactions should be corrected.

Deliveries should be disputed/cancelled according to workflow.

---

# 69. Recommended Indexes

## Users

```text
users(email)
users(business_id)
users(branch_id)
```

## Branches

```text
branches(business_id)
branches(business_id, code)
```

## Fuel Prices

```text
fuel_prices(business_id, fuel_type_id)
fuel_prices(effective_from)
```

## Orders

```text
fuel_orders(business_id)
fuel_orders(destination_branch_id)
fuel_orders(status)
```

## Deliveries

```text
deliveries(business_id)
deliveries(destination_branch_id)
deliveries(fuel_order_id)
deliveries(delivered_at)
```

## Inventory

```text
inventory_transactions(business_id, branch_id)
inventory_transactions(branch_id, fuel_type_id)
inventory_transactions(occurred_at)
inventory_transactions(reference_type, reference_id)
```

## Sales

```text
sales(business_id, branch_id)
sales(branch_id, fuel_type_id)
sales(sold_at)
```

## Reports

```text
daily_reports(business_id, branch_id)
daily_reports(branch_id, report_date)
daily_reports(status)
```

## Audit

```text
audit_logs(business_id, user_id)
audit_logs(resource_type, resource_id)
audit_logs(created_at)
```

---

# 70. Composite Indexing for Multi-Tenancy

Frequently queried business-scoped tables should include:

```text
(business_id, created_at)
```

or:

```text
(business_id, branch_id, created_at)
```

depending on query patterns.

This improves both performance and tenant-scoped querying.

---

# 71. Database Constraints

Important constraints include:

### Fuel quantity

```text
quantity > 0
```

for positive quantity fields.

### Price

```text
price >= 0
```

### Tanker capacity

```text
capacity > 0
```

### Sale quantity

```text
litres_sold > 0
```

### Total amount

```text
total_amount >= 0
```

---

# 72. Delivery Quantity Constraint

For normal delivery:

```text
actual_quantity_litres >= 0
```

and:

```text
expected_quantity_litres >= 0
```

The system should flag unexpected quantities rather than silently accepting invalid values.

---

# 73. Sale Inventory Constraint

The database alone should not attempt to fully determine whether a sale exceeds available inventory.

This is a transactional business rule.

The backend must:

```text
BEGIN
 ↓
Lock/check inventory
 ↓
Verify available stock
 ↓
Create sale
 ↓
Create inventory transaction
 ↓
COMMIT
```

---

# 74. Inventory Balance Calculation

The authoritative balance is:

```sql
SELECT
    COALESCE(SUM(quantity_litres), 0)
FROM inventory_transactions
WHERE branch_id = :branchId
  AND fuel_type_id = :fuelTypeId;
```

This can later be optimized using a materialized/current balance mechanism.

---

# 75. Current Inventory View

For reporting, create a database view conceptually equivalent to:

```text
branch_inventory
```

containing:

```text
business_id
branch_id
fuel_type_id
current_quantity
```

This allows dashboards to query current stock efficiently.

The underlying ledger remains authoritative.

---

# 76. Inventory Snapshot Optimization

If the platform becomes large, calculating the full ledger every time may become expensive.

A future optimization can introduce:

```text
inventory_balances
```

Example:

| Branch | Fuel | Current Stock |
|---|---|---:|
| Ikeja | PMS | 43,000 |
| Ikeja | AGO | 12,000 |
| Yaba | PMS | 31,500 |

However:

> `inventory_balances` should be treated as a derived/cache table, not the audit source of truth.

---

# 77. Inventory Transaction Processing

A delivery should execute:

```text
BEGIN

1. Validate delivery
2. Create delivery
3. Create inventory transaction
4. Calculate balance_after
5. Create audit record

COMMIT
```

---

# 78. Sale Processing

A sale should execute:

```text
BEGIN

1. Authenticate manager
2. Verify branch ownership
3. Validate fuel type
4. Lock/check inventory
5. Determine applicable price
6. Calculate total amount
7. Create sale
8. Create inventory transaction
9. Create audit record

COMMIT
```

---

# 79. Report Submission Processing

```text
BEGIN

1. Verify manager branch
2. Verify report date
3. Calculate sales
4. Calculate deliveries
5. Calculate inventory
6. Validate report
7. Change status to SUBMITTED
8. Create audit record
9. Create notification

COMMIT
```

---

# 80. Report Approval Processing

```text
BEGIN

1. Verify admin authorization
2. Load report
3. Validate report status
4. Change status to APPROVED
5. Record reviewer
6. Create audit record
7. Create manager notification

COMMIT
```

---

# 81. Report Rejection Processing

```text
BEGIN

1. Verify admin authorization
2. Validate report status
3. Store rejection reason
4. Change status to REJECTED
5. Record reviewer
6. Create audit record
7. Notify manager

COMMIT
```

---

# 82. Database Transaction Isolation

PostgreSQL transactions should be used for operations that affect both financial/operational records and inventory.

At minimum:

```text
READ COMMITTED
```

can be used for ordinary operations.

For inventory-sensitive concurrent operations, row locking should be used.

Where necessary, stronger transaction isolation can be introduced.

---

# 83. Preventing Duplicate Transactions

Important operations should have idempotency protection where appropriate.

For example, an external client should not be able to submit the same delivery twice because of a network retry.

Potential future field:

```text
idempotency_key
```

for critical write operations.

This can be particularly useful for:

- Deliveries
- Sales
- Payments
- External integrations

---

# 84. Data Retention

Operational and audit data should be retained for a period appropriate to the business and applicable regulations.

Do not automatically delete financial history as part of normal application cleanup.

Retention policy should be finalized with the business.

---

# 85. Initial Seed Data

The development environment should include:

### Roles

```text
SUPER_ADMIN
ADMIN
MANAGER
```

### Business

```text
K.B.Y GLOBAL INVESTMENT
```

### Example branches

```text
KBY-IKEJA
KBY-YABA
KBY-LEKKI
```

### Fuel

```text
PMS
AGO
DPK
```

Seed data must only be used in development/demo environments.

---

# 86. Example End-to-End Database Flow

## Step 1 — Order

```text
fuel_orders
+
fuel_order_items
```

```text
45,000 L PMS
```

---

## Step 2 — Delivery

```text
deliveries
+
delivery_items
```

```text
Expected:
45,000 L

Actual:
44,850 L
```

---

## Step 3 — Inventory

Create:

```text
inventory_transactions

DELIVERY
+44,850 L
```

---

## Step 4 — Sale

Manager sells:

```text
8,500 L
```

Create:

```text
sales
```

and:

```text
inventory_transactions

SALE
-8,500 L
```

---

## Step 5 — Revenue

```text
8,500 × ₦1,500

= ₦12,750,000
```

---

## Step 6 — Remaining Stock

```text
44,850
-
8,500
=
36,350 L
```

---

## Step 7 — Daily Report

The report references/calculates:

```text
Opening Stock
+44,850 L received
-8,500 L sold
= Closing Stock
```

---

# 87. Full Entity Relationship Diagram

```text
┌──────────────────┐
│    BUSINESSES    │
├──────────────────┤
│ id PK            │
│ name             │
│ status           │
└────────┬─────────┘
         │
    ┌────┴─────────────────────────────┐
    │                                  │
    ▼                                  ▼
┌───────────────┐              ┌────────────────┐
│    USERS      │              │    BRANCHES    │
├───────────────┤              ├────────────────┤
│ id PK         │              │ id PK          │
│ business_id FK│              │ business_id FK │
│ branch_id FK  │              │ name           │
│ role          │              │ code           │
│ email         │              │ status         │
└───────┬───────┘              └───────┬────────┘
        │                              │
        │                     ┌────────┼─────────┐
        │                     │        │         │
        │                     ▼        ▼         ▼
        │                   SALES  DELIVERIES REPORTS
        │                     │        │         │
        │                     │        │         │
        │                     └────┬───┴────┬────┘
        │                          │        │
        │                          ▼        ▼
        │                    INVENTORY   AUDIT
        │                    TRANSACTIONS
        │
        ▼
┌─────────────────┐
│   FUEL ORDERS   │
├─────────────────┤
│ id PK           │
│ business_id FK  │
│ supplier_id FK  │
│ branch_id FK    │
│ status          │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│ FUEL ORDER ITEMS │
├──────────────────┤
│ fuel_type_id FK  │
│ quantity         │
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│   DELIVERIES    │
├─────────────────┤
│ order_id FK     │
│ tanker_id FK    │
│ branch_id FK    │
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│ DELIVERY ITEMS   │
├──────────────────┤
│ fuel_type_id FK  │
│ expected_qty     │
│ actual_qty       │
└──────────────────┘


┌────────────────┐
│   FUEL TYPES   │
├────────────────┤
│ id PK          │
│ business_id FK │
│ code           │
│ name           │
└───────┬────────┘
        │
        ├──────────────► FUEL PRICES
        │
        ├──────────────► SALES
        │
        ├──────────────► DELIVERIES
        │
        └──────────────► INVENTORY
```

---

# 88. Critical Relationships

The most important relationships are:

```text
Business 1 ──── * Branch

Business 1 ──── * User

Branch 1 ──── * User

Business 1 ──── * FuelType

FuelType 1 ──── * FuelPrice

Business 1 ──── * Supplier

Business 1 ──── * Tanker

Supplier 1 ──── * FuelOrder

FuelOrder 1 ──── * FuelOrderItem

FuelOrder 1 ──── * Delivery

Delivery 1 ──── * DeliveryItem

Branch 1 ──── * InventoryTransaction

FuelType 1 ──── * InventoryTransaction

Branch 1 ──── * Sale

FuelType 1 ──── * Sale

Sale 1 ──── 1 InventoryTransaction

Branch 1 ──── * DailyReport
```

---

# 89. MVP Tables

The minimum production database should contain:

```text
users
refresh_tokens
password_reset_tokens

businesses
branches

fuel_types
fuel_prices

suppliers
tankers

fuel_orders
fuel_order_items

deliveries
delivery_items

inventory_transactions

sales
daily_reports

notifications
audit_logs
```

---

# 90. Tables Deliberately Excluded From MVP

The following should not be implemented until the corresponding feature is approved:

```text
payments
expenses
cash_reconciliation
pumps
pump_readings
nozzles
staff_shifts
customers
loyalty_accounts
fuel_transfers
subscriptions
invoices
accounting_entries
```

The schema should remain focused.

---

# 91. Important Design Decision — No Generic "Transactions" Table

Do not create one generic table containing:

```text
sales
deliveries
payments
expenses
```

Instead, use domain-specific tables.

For example:

```text
sales
deliveries
inventory_transactions
```

This provides clearer business rules and stronger database constraints.

---

# 92. Important Design Decision — No Manual Stock Table Initially

Do not make:

```text
branch_fuel_stock
```

the authoritative source of inventory in the MVP.

Use:

```text
inventory_transactions
```

as the source of truth.

A current-balance table can be introduced later as an optimization.

---

# 93. Important Design Decision — Daily Reports Are Not Transactions

A daily report is a **business summary**.

It should not create an additional:

```text
+45,000 L
```

inventory transaction merely because the report says 45,000 L was received.

The actual delivery creates the inventory transaction.

Similarly:

```text
Sale
```

creates the inventory deduction.

The daily report summarizes those events.

---

# 94. Important Design Decision — Revenue Is Derived From Sales

Revenue should not be independently entered into the database.

Instead:

```text
Revenue
=
SUM(sales.total_amount)
```

for the relevant period.

This prevents discrepancies between sales and revenue.

---

# 95. Important Design Decision — Historical Prices Are Snapshotted

`fuel_prices` determines the current/applicable price.

`sales.unit_price` preserves the actual historical price.

Therefore:

```text
fuel_prices
     ↓
price lookup at sale time
     ↓
sales.unit_price
```

This is the correct historical accounting model.

---

# 96. Important Design Decision — Actual Delivery Controls Inventory

The expected quantity does not increase inventory.

Only:

```text
delivery_items.actual_quantity_litres
```

creates the inventory increase.

Therefore:

```text
Expected = 45,000 L
Actual   = 44,850 L

Inventory Increase = 44,850 L
```

---

# 97. Database Integrity Summary

The database must guarantee or support:

```text
✓ Unique users
✓ Unique branch codes per business
✓ Unique tanker registration per business
✓ Unique order numbers
✓ Unique sale numbers
✓ One daily report per branch/date
✓ Valid foreign keys
✓ Positive fuel quantities
✓ Valid prices
✓ Historical price preservation
✓ Business ownership
✓ Branch ownership
✓ Inventory traceability
✓ Auditability
✓ Transactional sales
✓ Transactional deliveries
```

---

# 98. Migration Strategy

The project should use TypeORM migrations.

Do not use:

```text
synchronize: true
```

in production.

Development may use migrations from the beginning to ensure that the database schema remains reproducible.

Migration flow:

```text
Entity Change
     ↓
Generate Migration
     ↓
Review Migration
     ↓
Run Migration
     ↓
Test
```

---

# 99. Production Migration Rule

Every schema change must be committed as a migration.

Example:

```text
1700000000000-CreateUsers.ts
1700000000001-CreateBusinesses.ts
1700000000002-CreateBranches.ts
1700000000003-CreateFuelTypes.ts
...
```

Never manually modify the production schema without a corresponding migration.

---

# 100. Final Database Architecture

The final MVP data flow is:

```text
                    BUSINESS
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
        USERS       BRANCHES     SUPPLIERS
          │            │            │
          │            │            ▼
          │            │        FUEL ORDERS
          │            │            │
          │            │            ▼
          │            │        DELIVERIES
          │            │            │
          │            └──────┐     │
          │                   │     │
          │                   ▼     ▼
          │              INVENTORY
          │              TRANSACTIONS
          │                   ▲
          │                   │
          ▼                   │
        MANAGER               │
          │                   │
          ▼                   │
         SALES ───────────────┘
          │
          ▼
      DAILY REPORT
          │
          ▼
        ADMIN
          │
          ▼
       AUDIT LOG
```

---

# 101. Database Design Completion Criteria

The database design is considered ready for implementation when:

1. All MVP entities are defined.
2. All primary relationships are defined.
3. Multi-business ownership is defined.
4. Branch ownership is defined.
5. Manager access is branch-scoped.
6. Fuel prices preserve historical values.
7. Deliveries track expected and actual quantities.
8. Inventory uses an immutable ledger.
9. Sales create inventory deductions transactionally.
10. Daily reports summarize operational data.
11. Audit logs preserve important actions.
12. Financial and inventory records cannot be casually deleted.
13. Required indexes are defined.
14. Database constraints are defined.
15. TypeORM migrations can be generated from this design.

---

# 102. Next Document

The next document should be:

**`04-api-specification.md`**

It should translate this database design and the PRD into the actual backend contract.

It should define:

- Authentication endpoints
- User endpoints
- Business endpoints
- Branch endpoints
- Fuel endpoints
- Supplier endpoints
- Tanker endpoints
- Fuel order endpoints
- Delivery endpoints
- Inventory endpoints
- Sales endpoints
- Daily report endpoints
- Notification endpoints
- Dashboard endpoints
- Report/export endpoints
- Request DTOs
- Response DTOs
- Pagination
- Filtering
- Authorization requirements
- Error codes
- HTTP status codes
- Swagger structure

The API specification should be completed **before implementation**, so the frontend and backend can be developed against a stable contract.