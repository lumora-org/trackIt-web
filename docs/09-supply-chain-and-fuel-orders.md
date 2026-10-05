# 09 — Supply Chain and Fuel Orders

## 1. Overview

The Supply Chain module manages the procurement side of K.B.Y GLOBAL INVESTMENT's fueling operations.

The module covers:

- Suppliers
- Tankers
- Fuel procurement orders
- Fuel order items
- Order lifecycle
- Planned delivery quantities
- Procurement costs
- Destination branches
- Order tracking

The key principle is:

> A fuel order represents a procurement commitment. It does not represent physical stock.

Inventory only increases when a physical delivery is received and recorded through the Delivery and Receiving workflow.

---

# 2. Business Flow

The normal procurement workflow is:

```text
Admin
  ↓
Create Fuel Order
  ↓
Add Fuel Order Items
  ↓
Submit Order
  ↓
Confirm Order
  ↓
Assign/Prepare Tanker
  ↓
Fuel In Transit
  ↓
Delivery Arrives at Branch
  ↓
Manager Receives Delivery
  ↓
Actual Quantity Recorded
  ↓
Inventory Increased
```

Example:

```text
Order:
45,000 L PMS

Supplier:
Supplier A

Destination:
KBY-IKEJA

Expected delivery:
45,000 L

Actual delivery:
44,850 L

Inventory increase:
44,850 L

Variance:
-150 L
```

The system must never add the planned `45,000 L` to inventory merely because the order was created.

---

# 3. Suppliers

## 3.1 Supplier Entity

Table:

```text
suppliers
```

Fields:

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| business_id | UUID | Owning business |
| name | VARCHAR | Supplier name |
| code | VARCHAR | Business-scoped supplier code |
| contact_person | VARCHAR | Primary contact |
| phone | VARCHAR | Contact number |
| email | VARCHAR | Contact email |
| address | TEXT | Supplier address |
| status | ENUM | ACTIVE / INACTIVE |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |
| deleted_at | TIMESTAMPTZ | Soft deletion |

Constraint:

```sql
UNIQUE (business_id, code)
```

---

# 4. Supplier Rules

Suppliers are business-scoped.

An administrator from one business must not be able to:

- View another business's suppliers
- Modify another business's suppliers
- Use another business's supplier when creating an order

Managers may have read-only access where operationally necessary.

Supplier records should be soft-deleted rather than physically deleted.

A supplier that has historical fuel orders should remain available for historical reporting.

---

# 5. Tankers

## 5.1 Tanker Entity

Table:

```text
tankers
```

Fields:

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| business_id | UUID | Owning business |
| registration_number | VARCHAR | Vehicle registration |
| tanker_code | VARCHAR | Internal tanker identifier |
| capacity_litres | NUMERIC(18,3) | Tanker capacity |
| driver_name | VARCHAR | Driver name |
| driver_phone | VARCHAR | Driver phone |
| status | ENUM | ACTIVE / INACTIVE |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update |
| deleted_at | TIMESTAMPTZ | Soft deletion |

Recommended constraints:

```sql
UNIQUE (business_id, registration_number)
```

```sql
CHECK (capacity_litres > 0)
```

Example:

```text
Tanker:
KB-Y-TNK-001

Registration:
ABC-123-XY

Capacity:
45,000 L

Driver:
John Doe
```

---

# 6. Fuel Orders

## 6.1 Fuel Order Entity

Table:

```text
fuel_orders
```

Fields:

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| business_id | UUID | Owning business |
| order_number | VARCHAR | Human-readable order number |
| supplier_id | UUID | Supplier |
| destination_branch_id | UUID | Receiving branch |
| status | ENUM | Order status |
| ordered_at | TIMESTAMPTZ | Order creation/submission time |
| expected_delivery_at | TIMESTAMPTZ | Expected arrival |
| notes | TEXT | Optional notes |
| created_by | UUID | User creating order |
| created_at | TIMESTAMPTZ | Creation |
| updated_at | TIMESTAMPTZ | Last update |
| cancelled_at | TIMESTAMPTZ | Cancellation time |

Constraint:

```sql
UNIQUE (business_id, order_number)
```

Example:

```text
ORD-2026-000001
```

---

# 7. Fuel Order Items

A single procurement order may contain multiple fuel types.

Table:

```text
fuel_order_items
```

Fields:

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| fuel_order_id | UUID | Parent order |
| fuel_type_id | UUID | Fuel being ordered |
| expected_quantity_litres | NUMERIC(18,3) | Planned quantity |
| unit_cost | NUMERIC(18,2) | Procurement cost per litre |
| created_at | TIMESTAMPTZ | Creation timestamp |

Example:

```text
Order: ORD-2026-000001

PMS:
45,000 L
₦1,200/L

AGO:
20,000 L
₦1,300/L
```

`unit_cost` represents the procurement cost.

It is completely separate from the retail selling price stored in `fuel_prices`.

---

# 8. Order Number Generation

Order numbers should be human-readable.

Recommended format:

```text
ORD-{YEAR}-{SEQUENCE}
```

Example:

```text
ORD-2026-000001
ORD-2026-000002
ORD-2026-000003
```

The database must enforce uniqueness.

The frontend must never generate the authoritative order number.

---

# 9. Fuel Order Lifecycle

The lifecycle is:

```text
DRAFT
  ↓
SUBMITTED
  ↓
CONFIRMED
  ↓
IN_TRANSIT
  ↓
PARTIALLY_DELIVERED
  ↓
DELIVERED
```

Cancellation:

```text
DRAFT
SUBMITTED
CONFIRMED
      ↓
  CANCELLED
```

An order should not normally be cancelled after physical delivery has started.

Any exceptional cancellation after transit begins requires administrative intervention and an audit record.

---

# 10. Order Status Definitions

## DRAFT

Order is being prepared.

No procurement commitment has been finalized.

## SUBMITTED

Order has been submitted for processing.

## CONFIRMED

Supplier/order details have been confirmed.

## IN_TRANSIT

At least one delivery associated with the order is currently being transported.

## PARTIALLY_DELIVERED

Some expected fuel has been physically received, but the order is not completely fulfilled.

## DELIVERED

The required order quantities have been fulfilled or the order has been explicitly closed after reconciliation.

## CANCELLED

Order will not be fulfilled.

---

# 11. Multiple Deliveries Per Order

An order may be fulfilled by more than one tanker.

Example:

```text
Order:
60,000 L PMS

Delivery 1:
45,000 L

Delivery 2:
15,000 L
```

Therefore:

```text
fuel_order
    |
    +---- delivery
    |
    +---- delivery
```

Each delivery has its own tanker.

This allows the system to support:

- Multiple tankers
- Partial deliveries
- Split deliveries
- Delivery discrepancies

---

# 12. Remaining Quantity

For each fuel type:

```text
remaining =
expected_quantity
-
sum(actual_received_quantity)
```

Example:

```text
Expected:
60,000 L

Received:
45,000 L

Remaining:
15,000 L
```

A negative remaining quantity indicates over-delivery and should require administrative review.

---

# 13. Order Quantity Rules

Expected quantities must be:

```text
> 0
```

Delivery quantities must be:

```text
>= 0
```

An order cannot be considered delivered simply because a delivery record exists.

Actual physical receipt determines fulfillment.

---

# 14. Procurement Cost Rules

The procurement cost is stored on the order item.

Example:

```text
PMS
45,000 L
₦1,200/L
```

Estimated procurement value:

```text
45,000 × ₦1,200
=
₦54,000,000
```

The procurement cost must not be used as the retail selling price.

Retail pricing is controlled by the Fuel Pricing module.

---

# 15. Permissions

| Operation | SUPER_ADMIN | ADMIN | MANAGER |
|---|---:|---:|---:|
| Create supplier | Yes | Yes | No |
| Update supplier | Yes | Yes | No |
| View suppliers | Yes | Yes | Limited |
| Create order | Yes | Yes | No |
| Edit draft order | Yes | Yes | No |
| Submit order | Yes | Yes | No |
| Confirm order | Yes | Yes | No |
| Cancel order | Yes | Yes | No |
| View branch orders | Yes | Yes | Yes |
| Receive delivery | Yes | Yes | Yes, own branch |

Managers must never be able to redirect an order to another branch.

---

# 16. API Endpoints

## Suppliers

```http
GET /api/v1/suppliers
POST /api/v1/suppliers
GET /api/v1/suppliers/:id
PATCH /api/v1/suppliers/:id
PATCH /api/v1/suppliers/:id/status
```

## Tankers

```http
GET /api/v1/tankers
POST /api/v1/tankers
GET /api/v1/tankers/:id
PATCH /api/v1/tankers/:id
PATCH /api/v1/tankers/:id/status
```

## Fuel Orders

```http
GET /api/v1/fuel-orders
POST /api/v1/fuel-orders
GET /api/v1/fuel-orders/:id
PATCH /api/v1/fuel-orders/:id
POST /api/v1/fuel-orders/:id/submit
POST /api/v1/fuel-orders/:id/confirm
POST /api/v1/fuel-orders/:id/cancel
```

Filtering:

```http
GET /api/v1/fuel-orders?status=IN_TRANSIT
GET /api/v1/fuel-orders?branchId=<uuid>
GET /api/v1/fuel-orders?supplierId=<uuid>
```

---

# 17. Service Responsibilities

Recommended module:

```text
src/fuel-orders/
├── fuel-orders.module.ts
├── fuel-orders.controller.ts
├── fuel-orders.service.ts
├── fuel-orders.repository.ts
├── entities/
│   ├── fuel-order.entity.ts
│   └── fuel-order-item.entity.ts
├── dto/
│   ├── create-fuel-order.dto.ts
│   ├── update-fuel-order.dto.ts
│   ├── list-fuel-orders.dto.ts
│   ├── submit-fuel-order.dto.ts
│   └── cancel-fuel-order.dto.ts
└── constants/
    └── fuel-order.constants.ts
```

Supplier and tanker modules should follow the same pattern.

---

# 18. Transaction Rules

Order creation should use a transaction when multiple order items are created.

```text
BEGIN

Create fuel order
Create fuel order items
Validate supplier
Validate destination branch
Validate fuel types
Create audit event

COMMIT
```

If any step fails:

```text
ROLLBACK
```

No partial order should remain.

---

# 19. Audit Events

Recommended audit actions:

```text
SUPPLIER_CREATED
SUPPLIER_UPDATED
SUPPLIER_DEACTIVATED

TANKER_CREATED
TANKER_UPDATED
TANKER_DEACTIVATED

FUEL_ORDER_CREATED
FUEL_ORDER_UPDATED
FUEL_ORDER_SUBMITTED
FUEL_ORDER_CONFIRMED
FUEL_ORDER_CANCELLED
FUEL_ORDER_STATUS_CHANGED
```

---

# 20. Important Business Rules

1. Orders do not create inventory.
2. Deliveries create inventory only after physical receipt.
3. One order can have multiple deliveries.
4. A delivery belongs to one order.
5. A delivery is assigned to one tanker.
6. Actual received quantity controls stock.
7. Procurement cost is different from retail price.
8. Managers are branch-scoped.
9. Order numbers are business-scoped.
10. Historical procurement records must remain auditable.
11. Cancelled orders cannot create inventory.
12. Over-delivery requires review.
13. Supplier and tanker records are soft-deleted.
14. Critical order state changes are audited.

---

# 21. Test Scenarios

### Create order

```text
45,000 L PMS
Supplier A
KBY-IKEJA
```

Expected:

```text
Order created
Status = DRAFT
Inventory unchanged
```

### Confirm order

Expected:

```text
Status = CONFIRMED
Inventory unchanged
```

### Start transit

Expected:

```text
Status = IN_TRANSIT
Inventory unchanged
```

### Receive 44,850 L

Expected:

```text
Delivery = RECEIVED
Inventory += 44,850 L
Variance = -150 L
```

### Duplicate receive request

Expected:

```text
Rejected
No second inventory transaction
```

### Manager attempts another branch

Expected:

```text
403 Forbidden
```

### Cancelled order

Expected:

```text
Order = CANCELLED
No inventory transaction
```

---

# 22. Completion Criteria

The Supply Chain module is complete when:

- Suppliers can be managed.
- Tankers can be managed.
- Fuel orders can be created.
- Orders support multiple fuel types.
- Orders support multiple deliveries.
- Order status transitions are enforced.
- Procurement cost is stored separately from retail price.
- Inventory is never increased by an order.
- Business and branch authorization is enforced.
- Critical operations are audited.
- Duplicate order numbers are impossible.
- Transactions prevent partial order creation.