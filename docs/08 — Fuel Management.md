# 08 — Fuel Management

## 1. Purpose

This document defines the fuel-management architecture for the K.B.Y GLOBAL INVESTMENT platform.

The module is responsible for:

- Fuel types
- Fuel type configuration
- Fuel pricing
- Historical prices
- Effective pricing periods
- Price changes
- Price validation
- Business-level fuel configuration
- Price lookup for sales
- Audit requirements
- Authorization
- Future extensibility

The two core entities are:

```text
fuel_types
fuel_prices
```

The fundamental relationship is:

```text
Business
   │
   └── Fuel Types
          │
          └── Fuel Prices
```

---

# 2. Why Fuel Management Is Important

Fuel management sits at the center of several operational processes.

```text
Fuel Type
    │
    ├── Fuel Price
    │
    ├── Delivery
    │
    ├── Inventory
    │
    └── Sale
           │
           └── Revenue
```

For example:

```text
PMS
│
├── Current price: ₦1,500/L
├── Historical price: ₦1,450/L
├── Delivery: 45,000 L
├── Sales: 8,500 L
└── Revenue: 8,500 × applicable price
```

A mistake in fuel configuration or pricing can therefore affect:

- Revenue
- Inventory
- Daily reports
- Dashboards
- Management reports

Fuel management must therefore be treated as controlled business configuration.

---

# 3. MVP Fuel Types

The initial system should support common fuel products such as:

```text
PMS
AGO
DPK
```

Where:

```text
PMS = Premium Motor Spirit
AGO = Automotive Gas Oil
DPK = Dual Purpose Kerosene
```

The system should not hard-code these values into business logic.

They should exist as database records.

---

# 4. Fuel Type Entity

The `fuel_types` table:

```text
id
business_id
name
code
description
status
created_at
updated_at
deleted_at
```

Example:

```text
id: UUID
business_id: KBY
name: Premium Motor Spirit
code: PMS
description: Petrol
status: ACTIVE
```

---

# 5. Why Fuel Types Are Business-Scoped

Fuel types belong to a business.

Business A may sell:

```text
PMS
AGO
```

while Business B may sell:

```text
PMS
DPK
```

Therefore:

```text
Business A
├── PMS
└── AGO

Business B
├── PMS
└── DPK
```

This requires:

```text
business_id
```

on `fuel_types`.

---

# 6. Fuel Type Code

The code should be unique within a business.

Database constraint:

```sql
UNIQUE (business_id, code)
```

Example:

```text
Business A
PMS → valid
AGO → valid
PMS → duplicate → invalid
```

Another business may still have:

```text
Business B
PMS → valid
```

---

# 7. Fuel Type Name

The display name should be human-readable.

Examples:

```text
Premium Motor Spirit
Automotive Gas Oil
Dual Purpose Kerosene
```

The code remains stable:

```text
PMS
AGO
DPK
```

This allows the display name to change without changing references throughout the application.

---

# 8. Fuel Type Status

Fuel types should support:

```text
ACTIVE
INACTIVE
```

An inactive fuel type should generally not be available for:

```text
new sales
new deliveries
new orders
new prices
```

However, historical records using that fuel type remain accessible.

---

# 9. Fuel Type Deactivation

Suppose K.B.Y GLOBAL INVESTMENT stops selling DPK.

The system should not delete DPK.

Instead:

```text
DPK
status = INACTIVE
```

Historical records remain:

```text
Old DPK sales
Old DPK deliveries
Old DPK inventory
Old DPK reports
```

This preserves historical accuracy.

---

# 10. Fuel Type Creation

Endpoint:

```http
POST /api/v1/fuel-types
```

Request:

```json
{
  "name": "Premium Motor Spirit",
  "code": "PMS",
  "description": "Petrol"
}
```

The backend derives:

```text
business_id
```

from the authenticated ADMIN.

A normal ADMIN must never be allowed to submit another business's ID.

---

# 11. Fuel Type Authorization

Recommended:

| Operation | SUPER_ADMIN | ADMIN | MANAGER |
|---|---:|---:|---:|
| Create fuel type | ✅ | ✅ | ❌ |
| View fuel types | ✅ | Own business | Own branch/business context |
| Update fuel type | ✅ | Own business | ❌ |
| Activate/deactivate | ✅ | Own business | ❌ |
| Delete fuel type | Restricted | Restricted | ❌ |

Managers need read access because they need fuel types when recording sales.

---

# 12. Fuel Type API

Recommended:

```text
GET    /api/v1/fuel-types
POST   /api/v1/fuel-types
GET    /api/v1/fuel-types/:id
PATCH  /api/v1/fuel-types/:id
PATCH  /api/v1/fuel-types/:id/status
```

The API should not expose a normal hard-delete endpoint.

---

# 13. Fuel Type Update Rules

An ADMIN can update:

```text
name
description
```

Potentially:

```text
code
```

but changing a code should be restricted because external integrations or reports may rely on it.

For the MVP, the recommended approach is:

> Treat the fuel type code as immutable after creation.

If a code is wrong, create a controlled correction/migration rather than casually changing historical references.

---

# 14. Fuel Price Entity

The `fuel_prices` table:

```text
id
business_id
fuel_type_id
price_per_litre
effective_from
effective_to
created_by
created_at
```

Example:

```text
Fuel: PMS
Price: ₦1,500
Effective From: 2026-10-01 00:00:00
Effective To: NULL
```

---

# 15. Why Historical Prices Matter

Fuel prices change.

Example:

```text
October 1
PMS = ₦1,500/L

October 10
PMS = ₦1,550/L

October 18
PMS = ₦1,600/L
```

If a sale occurred on October 5:

```text
5 October
8,500 L
× ₦1,500
= ₦12,750,000
```

The sale must continue showing:

```text
₦1,500/L
```

even after the price becomes ₦1,600.

---

# 16. Price History

The pricing table should therefore behave like:

```text
PMS

01 Oct ───────────── 09 Oct
₦1,500

10 Oct ───────────── 17 Oct
₦1,550

18 Oct ───────────── Present
₦1,600
```

Each price has an effective period.

---

# 17. Price Interval Model

For a price:

```text
effective_from
effective_to
```

The meaning is:

```text
effective_from <= sale_time
AND
(
  effective_to IS NULL
  OR sale_time < effective_to
)
```

Therefore, the interval is:

```text
[effective_from, effective_to)
```

The start is inclusive.

The end is exclusive.

This avoids ambiguous boundaries.

---

# 18. Example

Price A:

```text
effective_from = 2026-10-01 00:00
effective_to   = 2026-10-10 00:00
```

Price B:

```text
effective_from = 2026-10-10 00:00
effective_to   = NULL
```

At exactly:

```text
2026-10-10 00:00
```

Price B applies.

This gives deterministic pricing.

---

# 19. Current Price

The current price is the price where:

```text
effective_from <= NOW()
AND
(
  effective_to IS NULL
  OR effective_to > NOW()
)
```

There should normally be exactly one active price per:

```text
business_id + fuel_type_id
```

---

# 20. Price Overlap

This is one of the most important database rules.

The system must prevent:

```text
PMS
01 Oct → 15 Oct
10 Oct → 20 Oct
```

because both prices apply during:

```text
10 Oct → 15 Oct
```

This creates ambiguity.

The system must enforce:

> Price periods for the same business and fuel type must never overlap.

---

# 21. PostgreSQL Price Constraint

Because PostgreSQL is the selected database, the strongest implementation is a database-level exclusion constraint using a range.

Conceptually:

```sql
EXCLUDE USING gist (
  business_id WITH =,
  fuel_type_id WITH =,
  tstzrange(effective_from, effective_to, '[)') WITH &&
)
```

The open-ended `effective_to = NULL` case should be represented appropriately using PostgreSQL's unbounded range behavior.

This gives the database the final authority over overlapping prices.

---

# 22. Application-Level Price Validation

The service should still validate before attempting the database write.

Flow:

```text
Create price
   ↓
Validate fuel type
   ↓
Validate price
   ↓
Validate effective date
   ↓
Check overlapping price
   ↓
Create/update price
   ↓
Database constraint confirms integrity
```

Application validation improves user experience.

The database constraint provides the final safety boundary.

---

# 23. Price Creation

Endpoint:

```http
POST /api/v1/fuel-prices
```

Request:

```json
{
  "fuelTypeId": "fuel-type-uuid",
  "pricePerLitre": 1500,
  "effectiveFrom": "2026-10-01T00:00:00Z"
}
```

The backend should calculate the previous price's:

```text
effective_to
```

when appropriate.

---

# 24. Recommended Price Change Workflow

Suppose current price is:

```text
₦1,500
```

and ADMIN wants:

```text
₦1,550
```

effective tomorrow.

The service should perform:

```text
BEGIN

1. Find current price
2. Validate new effective date
3. Close current price
4. Create new price
5. Audit change

COMMIT
```

Example:

Before:

```text
₦1,500
effective_from = Oct 1
effective_to   = NULL
```

After:

```text
₦1,500
effective_from = Oct 1
effective_to   = Oct 10

₦1,550
effective_from = Oct 10
effective_to   = NULL
```

---

# 25. Why Price Changes Must Be Transactional

Without a transaction, this can happen:

```text
Old price closed
      ↓
Application crashes
      ↓
New price never created
```

Now the fuel has no valid price.

Therefore:

```text
Close old price
+
Create new price
```

must be atomic.

---

# 26. Future-Dated Prices

The system should support future pricing.

Example:

```text
Today:
₦1,500

Tomorrow:
₦1,550
```

The ADMIN can create:

```text
effective_from = tomorrow
```

without immediately changing today's price.

The price resolver will automatically select the correct price based on sale time.

---

# 27. Backdated Prices

Backdated price creation should be restricted.

Example:

Current records:

```text
Oct 1 → Oct 10
₦1,500

Oct 10 → Present
₦1,550
```

Trying to insert:

```text
Oct 5 → Oct 8
₦1,450
```

could alter historical pricing interpretation.

For the MVP:

> Backdated price changes should not be allowed through the normal UI.

If historical corrections are ever required, they should use a controlled administrative process.

---

# 28. Price Deletion

Prices should not be hard-deleted once they have been used by sales.

Why?

Because historical price information is part of the audit trail.

If:

```text
Sale A
unit_price = ₦1,500
```

was created using Price Record A, deleting Price Record A would damage historical traceability.

Therefore:

```text
Used price → immutable
```

---

# 29. Price Corrections

If an incorrect price was entered, do not rewrite historical sales.

Example:

Incorrect configuration:

```text
PMS
₦15,000/L
```

Sales already recorded:

```text
₦15,000/L
```

The system should not silently change those sales to:

```text
₦1,500/L
```

Instead:

1. Correct the future price configuration.
2. Preserve historical sales.
3. Record an administrative audit event.
4. If a financial correction is required, use a controlled correction process.

---

# 30. Price Snapshot in Sales

Every sale stores:

```text
unit_price
```

directly on the sale.

This is intentional.

For example:

```text
Sale
├── fuel_type_id = PMS
├── litres_sold = 8,500
├── unit_price = ₦1,500
└── total_amount = ₦12,750,000
```

Even if the current PMS price becomes:

```text
₦1,600
```

the historical sale remains:

```text
₦1,500
```

---

# 31. Price Resolver

The application should have a dedicated method:

```typescript
getApplicablePrice(
  businessId: string,
  fuelTypeId: string,
  at: Date,
): Promise<FuelPrice>
```

The query should find:

```text
effective_from <= at
AND
(
  effective_to IS NULL
  OR effective_to > at
)
```

ordered by:

```text
effective_from DESC
```

---

# 32. Price Resolution Example

Suppose:

```text
PMS

Oct 1 → Oct 10
₦1,500

Oct 10 → Oct 18
₦1,550

Oct 18 → Present
₦1,600
```

Sale:

```text
Oct 5
```

returns:

```text
₦1,500
```

Sale:

```text
Oct 15
```

returns:

```text
₦1,550
```

Sale:

```text
Oct 20
```

returns:

```text
₦1,600
```

---

# 33. Sale Price Rule

The client should not be allowed to determine the authoritative price.

Avoid:

```json
{
  "fuelTypeId": "pms",
  "litresSold": 8500,
  "unitPrice": 1
}
```

being accepted as the final price.

Instead:

```text
Client
   ↓
fuelTypeId
litresSold
   ↓
Backend
   ↓
Resolve applicable price
   ↓
Calculate total
```

---

# 34. Why Managers Should Not Set Prices

A manager records sales.

The manager does not control pricing.

Therefore:

```text
MANAGER
  ↓
Record sale
  ↓
System determines price
```

while:

```text
ADMIN
  ↓
Configure price
```

This separates operational activity from business configuration.

---

# 35. Price Authorization

Recommended:

| Operation | SUPER_ADMIN | ADMIN | MANAGER |
|---|---:|---:|---:|
| View prices | ✅ | Own business | Own business |
| Create price | ✅ | ✅ | ❌ |
| Schedule price | ✅ | ✅ | ❌ |
| Change price | ✅ | ✅ | ❌ |
| Delete price | Restricted | Restricted | ❌ |
| View history | ✅ | ✅ | Read-only |

---

# 36. Fuel Type and Price Relationship

A fuel type can have many prices:

```text
FuelType
   │
   ├── Price 1
   ├── Price 2
   ├── Price 3
   └── Current Price
```

Database relationship:

```text
fuel_types.id
      ↓
fuel_prices.fuel_type_id
```

---

# 37. Fuel Type Deactivation and Prices

When a fuel type becomes inactive:

```text
fuel_type.status = INACTIVE
```

No new prices should normally be created.

Existing prices remain for historical reference.

The system should not automatically delete or rewrite them.

---

# 38. Price Validation Rules

The following should be enforced:

```text
price_per_litre >= 0
effective_from is valid timestamp
effective_to > effective_from
fuel_type exists
fuel_type belongs to business
fuel_type is active when creating future operational price
no overlapping price period
```

---

# 39. Zero Price

Should:

```text
price_per_litre = 0
```

be allowed?

For the MVP, the recommended answer is:

> No for normal commercial fuel sales.

Although the database can technically support zero, a zero price would likely indicate a configuration mistake.

Therefore:

```text
price_per_litre > 0
```

for active commercial pricing.

If future business requirements include promotional/free fuel, that should be represented explicitly rather than by accidentally setting price to zero.

---

# 40. Decimal Precision

Fuel prices should use:

```text
NUMERIC(18,2)
```

Example:

```text
1500.00
1550.00
1600.00
```

The API should return prices consistently.

Avoid JavaScript floating-point arithmetic for financial calculations.

---

# 41. Revenue Calculation

Revenue:

```text
litres_sold × unit_price
```

Example:

```text
8,500 × ₦1,500
= ₦12,750,000
```

The backend calculates:

```text
total_amount
```

and the client should not be trusted to provide the final value.

---

# 42. Fuel Quantity Precision

Fuel quantities should use:

```text
NUMERIC(18,3)
```

This allows values such as:

```text
45,000.000 L
44,850.500 L
```

This is especially useful when delivery measurements include fractional litres.

---

# 43. Fuel Type API Response

Example:

```json
{
  "id": "fuel-type-uuid",
  "name": "Premium Motor Spirit",
  "code": "PMS",
  "description": "Petrol",
  "status": "ACTIVE"
}
```

The response should not expose internal database metadata unnecessarily.

---

# 44. Fuel Price API Response

Example:

```json
{
  "id": "price-uuid",
  "fuelTypeId": "fuel-type-uuid",
  "pricePerLitre": 1500,
  "effectiveFrom": "2026-10-01T00:00:00Z",
  "effectiveTo": "2026-10-10T00:00:00Z"
}
```

For the current price:

```json
{
  "id": "price-uuid",
  "fuelTypeId": "fuel-type-uuid",
  "pricePerLitre": 1600,
  "effectiveFrom": "2026-10-18T00:00:00Z",
  "effectiveTo": null
}
```

---

# 45. Current Price Endpoint

A convenient endpoint:

```http
GET /api/v1/fuel-prices/current
```

could return:

```json
[
  {
    "fuelType": "PMS",
    "pricePerLitre": 1600
  },
  {
    "fuelType": "AGO",
    "pricePerLitre": 1750
  },
  {
    "fuelType": "DPK",
    "pricePerLitre": 1400
  }
]
```

This will be useful to the frontend.

---

# 46. Price History Endpoint

Recommended:

```http
GET /api/v1/fuel-prices/history?fuelTypeId=<uuid>
```

Example response:

```json
[
  {
    "pricePerLitre": 1500,
    "effectiveFrom": "2026-10-01T00:00:00Z",
    "effectiveTo": "2026-10-10T00:00:00Z"
  },
  {
    "pricePerLitre": 1550,
    "effectiveFrom": "2026-10-10T00:00:00Z",
    "effectiveTo": "2026-10-18T00:00:00Z"
  },
  {
    "pricePerLitre": 1600,
    "effectiveFrom": "2026-10-18T00:00:00Z",
    "effectiveTo": null
  }
]
```

---

# 47. Price Schedule Endpoint

For future-dated pricing:

```http
GET /api/v1/fuel-prices/scheduled
```

This can show:

```text
Upcoming PMS price
₦1,650
Effective: tomorrow
```

This is useful for ADMINs preparing future price changes.

---

# 48. Price Change Endpoint

A dedicated endpoint is recommended:

```http
POST /api/v1/fuel-prices/change
```

Request:

```json
{
  "fuelTypeId": "fuel-type-uuid",
  "pricePerLitre": 1650,
  "effectiveFrom": "2026-10-20T00:00:00Z"
}
```

This is preferable to allowing arbitrary:

```text
PATCH /fuel-prices/:id
```

for active pricing periods.

The service controls the lifecycle.

---

# 49. Why Dedicated Price Change Operations Are Better

A generic update could accidentally allow:

```text
effective_from
effective_to
price_per_litre
```

to be modified independently.

That can create:

```text
overlapping periods
gaps
retroactive changes
invalid intervals
```

A dedicated business operation makes the rules explicit.

---

# 50. Price Change Transaction

Recommended:

```text
BEGIN

1. Authenticate ADMIN
2. Verify fuel type belongs to business
3. Verify fuel type active
4. Validate new price
5. Validate effective date
6. Find existing active/future price
7. Adjust previous interval
8. Create new price
9. Create audit record

COMMIT
```

---

# 51. Future Price Replacement

Suppose:

```text
Existing:
Oct 20 → Present
₦1,600
```

ADMIN schedules:

```text
Oct 25
₦1,650
```

Then:

```text
Oct 20 → Oct 25
₦1,600

Oct 25 → Present
₦1,650
```

If another price is scheduled for:

```text
Oct 23
```

the system must determine whether that request replaces or conflicts with the existing schedule.

For the MVP:

> Do not allow ambiguous future-price overlaps. Require the administrator to explicitly replace or cancel the existing scheduled price.

---

# 52. Price Cancellation

A future price that has not become active may need cancellation.

Recommended future endpoint:

```http
POST /api/v1/fuel-prices/:id/cancel
```

Only scheduled, unused price records can be cancelled.

The system should not modify historical prices that have already been used.

---

# 53. Fuel Configuration Workflow

Typical ADMIN workflow:

```text
1. Create fuel type
       ↓
2. Set initial price
       ↓
3. Fuel becomes available
       ↓
4. Deliveries can be recorded
       ↓
5. Managers can sell
       ↓
6. ADMIN changes price when required
       ↓
7. Historical price remains preserved
```

---

# 54. Initial Fuel Setup

For K.B.Y GLOBAL INVESTMENT, the initial seed data should create:

```text
PMS
AGO
DPK
```

Then initial prices can be configured.

Example:

```text
PMS → ₦1,500
AGO → ₦1,700
DPK → ₦1,400
```

These are example/demo values and should not be treated as permanent business pricing.

---

# 55. Fuel Management Module Structure

Recommended:

```text
src/
├── fuel-types/
│   ├── fuel-types.module.ts
│   ├── fuel-types.controller.ts
│   ├── fuel-types.service.ts
│   ├── fuel-types.repository.ts
│   ├── entities/
│   │   └── fuel-type.entity.ts
│   └── dto/
│       ├── create-fuel-type.dto.ts
│       ├── update-fuel-type.dto.ts
│       └── update-fuel-type-status.dto.ts
│
└── fuel-prices/
    ├── fuel-prices.module.ts
    ├── fuel-prices.controller.ts
    ├── fuel-prices.service.ts
    ├── fuel-prices.repository.ts
    ├── entities/
    │   └── fuel-price.entity.ts
    ├── dto/
    │   ├── create-fuel-price.dto.ts
    │   ├── change-fuel-price.dto.ts
    │   └── cancel-fuel-price.dto.ts
    └── interfaces/
        └── applicable-price.interface.ts
```

---

# 56. Fuel Types Service

Responsibilities:

```text
create
findAll
findOne
update
activate
deactivate
validateOwnership
```

It should not contain price lifecycle logic.

---

# 57. Fuel Prices Service

Responsibilities:

```text
createInitialPrice
changePrice
getCurrentPrice
getApplicablePrice
getPriceHistory
getScheduledPrices
cancelScheduledPrice
validatePriceInterval
```

This keeps pricing rules centralized.

---

# 58. Price Resolver as a Shared Dependency

The most important method is:

```typescript
getApplicablePrice(
  businessId: string,
  fuelTypeId: string,
  at: Date,
)
```

The Sales module should call this method rather than implementing its own pricing query.

This prevents different modules from calculating different prices.

---

# 59. Fuel Price Dependency Graph

```text
FuelTypeService
       │
       ▼
FuelPriceService
       │
       ├──────────────┐
       ▼              ▼
   Delivery        Sales
                      │
                      ▼
                   Revenue
```

Inventory primarily depends on fuel types.

Sales depends on both fuel types and prices.

---

# 60. Fuel Type Validation During Delivery

When a delivery item is created:

```text
fuelTypeId
```

must refer to:

```text
active fuel type
+
same business
```

Example:

```text
Business A delivery
       ↓
Fuel Type A
       ↓
Business A → valid
Business B → invalid
```

---

# 61. Fuel Type Validation During Sale

When a manager records a sale:

```text
fuelTypeId
```

must:

```text
exist
belong to manager's business
be active
```

The system then determines:

```text
applicable price
```

and verifies inventory.

---

# 62. Fuel Price and Inventory

Changing the price does not change inventory.

Example:

```text
PMS stock = 40,000 L
```

Price:

```text
₦1,500 → ₦1,600
```

Inventory remains:

```text
40,000 L
```

Only sales affect stock.

This distinction is critical.

---

# 63. Fuel Price and Delivery

Fuel price does not determine delivered quantity.

A delivery:

```text
Expected = 45,000 L
Actual = 44,850 L
```

adds:

```text
+44,850 L
```

to inventory.

The selling price is a separate concern.

---

# 64. Fuel Price and Revenue

Revenue is calculated when a sale occurs.

Example:

```text
PMS
8,500 L
₦1,500/L
```

Revenue:

```text
₦12,750,000
```

If the price later changes:

```text
₦1,600/L
```

the previous revenue does not change.

---

# 65. Audit Events

Fuel type events:

```text
FUEL_TYPE_CREATED
FUEL_TYPE_UPDATED
FUEL_TYPE_ACTIVATED
FUEL_TYPE_DEACTIVATED
```

Price events:

```text
FUEL_PRICE_CREATED
FUEL_PRICE_CHANGED
FUEL_PRICE_SCHEDULED
FUEL_PRICE_CANCELLED
```

Audit records should capture:

```text
who
business
fuel type
old price
new price
effective date
timestamp
```

---

# 66. Example Price Audit

```json
{
  "action": "FUEL_PRICE_CHANGED",
  "resourceType": "FUEL_PRICE",
  "resourceId": "price-uuid",
  "oldValues": {
    "pricePerLitre": 1500,
    "effectiveTo": null
  },
  "newValues": {
    "pricePerLitre": 1550,
    "effectiveFrom": "2026-10-10T00:00:00Z"
  }
}
```

This provides a complete administrative trail.

---

# 67. Database Indexes

Recommended indexes:

```text
fuel_types(business_id)
fuel_types(business_id, code)
fuel_types(status)

fuel_prices(business_id)
fuel_prices(fuel_type_id)
fuel_prices(business_id, fuel_type_id)
fuel_prices(effective_from)
```

A useful composite query index is:

```text
(business_id, fuel_type_id, effective_from)
```

---

# 68. Foreign Keys

Recommended relationships:

```text
fuel_types.business_id
    → businesses.id

fuel_prices.business_id
    → businesses.id

fuel_prices.fuel_type_id
    → fuel_types.id

fuel_prices.created_by
    → users.id
```

Historical pricing records should not be casually deleted when referenced by operational history.

---

# 69. Delete Strategy

Fuel types:

```text
Soft deactivate
```

Fuel prices:

```text
Do not delete used historical prices
```

The database should use appropriate foreign-key restrictions.

---

# 70. API Validation

All DTOs should use NestJS validation.

Example:

```typescript
class CreateFuelTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_-]+$/)
  code: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

The exact regex can be relaxed if business naming requirements change.

---

# 71. Price DTO

Example:

```typescript
class ChangeFuelPriceDto {
  @IsUUID()
  fuelTypeId: string;

  @IsNumber()
  @IsPositive()
  pricePerLitre: number;

  @IsDateString()
  effectiveFrom: string;
}
```

The database still remains the final authority for numeric precision and constraints.

---

# 72. Timezone Handling

All timestamps should be stored as:

```text
TIMESTAMPTZ
```

and internally represented in UTC.

Example:

```text
2026-10-10T00:00:00Z
```

The frontend can display:

```text
10 October 2026, 01:00 WAT
```

for Nigeria.

The backend should not store local time as an ambiguous timestamp.

---

# 73. Price Effective Date Semantics

The API should clearly define whether the supplied date is:

```text
UTC
```

or includes an explicit timezone.

Prefer:

```text
2026-10-10T00:00:00+01:00
```

or:

```text
2026-10-09T23:00:00Z
```

rather than:

```text
2026-10-10 00:00
```

This avoids timezone ambiguity.

---

# 74. Business Rules Summary

### Fuel Types

```text
Fuel types belong to a business.
Fuel codes are unique per business.
Inactive fuel types cannot be used for new operations.
Historical references remain valid.
```

### Prices

```text
Prices belong to a business and fuel type.
Price periods cannot overlap.
Price changes are transactional.
Historical prices are preserved.
Backdated changes are restricted.
Used prices cannot be casually deleted.
```

### Sales

```text
Backend resolves the applicable price.
Client cannot override authoritative price.
Sale stores unit_price snapshot.
Revenue is calculated by backend.
```

---

# 75. E2E Test Scenarios

## Fuel type creation

```text
ADMIN Business A
    ↓
Create PMS
    ↓
Success
```

Attempt:

```text
MANAGER
    ↓
Create AGO
    ↓
403
```

---

## Cross-business fuel access

```text
Business A ADMIN
    ↓
Request Business B fuel type
    ↓
Denied
```

---

## Price creation

```text
PMS
₦1,500
Oct 1
    ↓
Success
```

---

## Overlapping price

Existing:

```text
Oct 1 → Oct 10
₦1,500
```

Attempt:

```text
Oct 5 → Oct 15
₦1,550
```

Expected:

```text
Rejected
```

---

## Price change

Existing:

```text
Oct 1 → Present
₦1,500
```

Change:

```text
Oct 10
₦1,550
```

Expected:

```text
Oct 1 → Oct 10
₦1,500

Oct 10 → Present
₦1,550
```

---

## Historical price

Sale:

```text
Oct 5
8,500 L
```

Expected:

```text
unit_price = ₦1,500
```

Even after:

```text
Oct 10
₦1,550
```

---

## Future price

Current:

```text
₦1,500
```

Scheduled:

```text
tomorrow
₦1,550
```

Today:

```text
Applicable price = ₦1,500
```

Tomorrow:

```text
Applicable price = ₦1,550
```

---

# 76. Security Tests

The module must specifically test:

```text
[ ] ADMIN cannot access another business's fuel types
[ ] ADMIN cannot change another business's prices
[ ] MANAGER cannot create prices
[ ] MANAGER cannot modify prices
[ ] MANAGER cannot create fuel types
[ ] Manager cannot supply another business's fuelTypeId
[ ] Client cannot override sale price
[ ] Overlapping prices are rejected
[ ] Backdated price changes are restricted
[ ] Historical prices cannot be deleted
[ ] Inactive fuel types cannot be used for new operations
```

---

# 77. MVP Seed Data

Development seed:

```text
Business:
K.B.Y GLOBAL INVESTMENT
```

Fuel types:

```text
PMS
AGO
DPK
```

Example prices:

```text
PMS → ₦1,500/L
AGO → ₦1,700/L
DPK → ₦1,400/L
```

These should be treated as development/demo data.

Production prices must be entered according to actual business pricing.

---

# 78. Module Completion Criteria

Fuel Management is complete when:

```text
[ ] Fuel types can be created
[ ] Fuel types are business-scoped
[ ] Fuel codes are unique per business
[ ] Fuel types can be activated/deactivated
[ ] Historical fuel types are preserved
[ ] Fuel prices can be created
[ ] Prices are business-scoped
[ ] Prices are fuel-type-scoped
[ ] Price periods cannot overlap
[ ] Current price can be resolved
[ ] Historical price can be resolved
[ ] Future prices can be scheduled
[ ] Price changes are transactional
[ ] Used historical prices cannot be deleted
[ ] Sales snapshot their unit price
[ ] Managers cannot modify prices
[ ] Price changes are audited
[ ] Cross-business access is prevented
[ ] DTO validation is implemented
[ ] E2E pricing tests pass
```

---

# 79. Final Architecture

The completed fuel-management flow is:

```text
                 BUSINESS
                     │
                     ▼
                FUEL TYPE
                     │
             ┌───────┴────────┐
             │                │
             ▼                ▼
        PRICE HISTORY      STATUS
             │
             ▼
      APPLICABLE PRICE
             │
             ▼
            SALE
             │
       ┌─────┴─────┐
       ▼           ▼
   UNIT PRICE    REVENUE
       │
       ▼
   INVENTORY
```

The most important rule is:

> **Fuel prices are time-dependent business configuration, while the sale's unit price is immutable historical transaction data.**

This separation ensures that changing today's fuel price never rewrites yesterday's revenue.

---

# 80. Final Design Decision

For the MVP, K.B.Y GLOBAL INVESTMENT will use:

```text
fuel_types
    +
fuel_prices
    +
historical price intervals
    +
backend price resolution
    +
sale-level price snapshots
```

The system will **not**:

```text
hard-code PMS/AGO/DPK
store only one current price
allow managers to set prices
trust client-supplied sale prices
rewrite historical sales when prices change
allow overlapping price periods
```

This gives the platform a reliable foundation for the next major area:

```text
Fuel Management
       ↓
Supply Chain
       ↓
Deliveries
       ↓
Inventory
       ↓
Sales
       ↓
Revenue
```

# 81. Recommended Next Module

The next document should be:

```text
09-supply-chain-and-fuel-orders.md
```

It will define:

- Suppliers
- Tankers
- Fuel orders
- Order items
- Order status lifecycle
- Expected tanker quantity
- Multiple fuel types per order
- Destination branches
- Order confirmation
- In-transit tracking
- Delivery handoff
- Cancellation rules
- Idempotency
- Authorization
- Audit trail

This is the natural next step before we design **deliveries and inventory**, because the platform needs to know how fuel gets ordered and moves from supplier → tanker → branch before we record it as stock.