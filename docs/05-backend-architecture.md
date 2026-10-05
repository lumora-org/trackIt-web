# K.B.Y GLOBAL INVESTMENT
# Backend Architecture

**Document:** `05-backend-architecture.md`  
**Version:** 1.0  
**Status:** MVP Architecture  
**Backend:** NestJS  
**Language:** TypeScript  
**Database:** PostgreSQL 16+  
**ORM:** TypeORM  
**API:** REST  
**Authentication:** JWT + Refresh Tokens  
**API Version:** `/api/v1`

---

# 1. Purpose

This document defines the backend architecture for the K.B.Y GLOBAL INVESTMENT fueling-station management platform.

It translates:

- `01-product-requirements.md`
- `02-architecture-design.md`
- `03-database-design.md`
- `04-api-specification.md`

into a practical NestJS architecture that can be implemented by the development team.

The architecture is designed around the actual business domains rather than around database tables alone.

The most important business flow is:

```text
Fuel Order
    ↓
Delivery
    ↓
Inventory
    ↓
Sale
    ↓
Inventory Reduction
    ↓
Daily Report
    ↓
Admin Review
    ↓
Dashboard / Reports
```

---

# 2. Architectural Goals

The backend must provide:

1. Secure authentication.
2. Role-based access control.
3. Business-level tenant isolation.
4. Branch-level access control.
5. Transaction-safe inventory management.
6. Historical fuel pricing.
7. Immutable operational history.
8. Auditable business operations.
9. Clear separation between controllers, services, repositories, and domain rules.
10. Consistent API responses and errors.
11. Strong request validation.
12. Easy testing.
13. Maintainability as the platform grows.
14. A clean path for future modules such as payments, expenses, pump readings, and accounting.

---

# 3. Architectural Style

The MVP uses a **modular monolith**.

```text
Client
  ↓
NestJS REST API
  ↓
Domain Modules
  ↓
Application Services
  ↓
Repositories / TypeORM
  ↓
PostgreSQL
```

This is intentionally not a microservice architecture.

For the current business size, a modular monolith provides:

- simpler deployment
- simpler transactions
- simpler debugging
- lower infrastructure cost
- easier development
- strong module boundaries
- the ability to extract services later if necessary

---

# 4. High-Level Architecture

```text
                         ┌──────────────────────┐
                         │      Frontend        │
                         │ Web / Mobile Client  │
                         └──────────┬───────────┘
                                    │
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │      NestJS API      │
                         │      /api/v1         │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌────────────┐        ┌─────────────┐       ┌────────────┐
       │   Guards   │        │ Validation  │       │  Logging   │
       │ JWT / RBAC │        │   Pipes     │       │ / Audit    │
       └──────┬─────┘        └──────┬──────┘       └─────┬──────┘
              │                     │                    │
              └─────────────────────┼────────────────────┘
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │     Domain Modules     │
                       ├────────────────────────┤
                       │ Auth                   │
                       │ Users                  │
                       │ Businesses             │
                       │ Branches               │
                       │ Fuel Types             │
                       │ Fuel Prices             │
                       │ Suppliers               │
                       │ Tankers                │
                       │ Fuel Orders            │
                       │ Deliveries             │
                       │ Inventory              │
                       │ Sales                  │
                       │ Daily Reports         │
                       │ Notifications          │
                       │ Dashboard              │
                       │ Reports                │
                       │ Audit Logs             │
                       └────────────┬───────────┘
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │      TypeORM Layer     │
                       │ Entities / Repositories│
                       └────────────┬───────────┘
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │      PostgreSQL        │
                       └────────────────────────┘
```

---

# 5. Core Architectural Principle

The backend should separate four concerns:

```text
HTTP
 ↓
Controller
 ↓
Application Service
 ↓
Domain / Business Logic
 ↓
Repository / Database
```

A controller should not contain business logic.

For example, this is discouraged:

```typescript
@Post()
async createSale(@Body() dto: CreateSaleDto) {
  const inventory = await this.repository.find(...);

  if (inventory.quantity < dto.litresSold) {
    throw new BadRequestException(...);
  }

  const sale = ...
  await this.repository.save(sale);

  ...
}
```

Instead:

```typescript
@Post()
createSale(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: CreateSaleDto,
) {
  return this.salesService.createSale(user, dto);
}
```

The service owns the business operation.

---

# 6. Recommended Project Structure

```text
src/
├── main.ts
├── app.module.ts
│
├── config/
│   ├── configuration.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── validation.ts
│
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── public.decorator.ts
│   │
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   ├── business-access.guard.ts
│   │   └── branch-access.guard.ts
│   │
│   ├── interceptors/
│   │   ├── audit.interceptor.ts
│   │   └── logging.interceptor.ts
│   │
│   ├── filters/
│   │   └── http-exception.filter.ts
│   │
│   ├── pipes/
│   │   └── validation.pipe.ts
│   │
│   ├── middleware/
│   │   └── request-id.middleware.ts
│   │
│   ├── enums/
│   │   ├── user-role.enum.ts
│   │   ├── account-status.enum.ts
│   │   └── ...
│   │
│   ├── interfaces/
│   │   ├── authenticated-user.interface.ts
│   │   └── paginated-response.interface.ts
│   │
│   ├── dto/
│   │   └── pagination.dto.ts
│   │
│   └── utils/
│       ├── money.util.ts
│       ├── date.util.ts
│       └── pagination.util.ts
│
├── database/
│   ├── database.module.ts
│   ├── migrations/
│   └── seeds/
│
├── auth/
├── users/
├── businesses/
├── branches/
├── fuel-types/
├── fuel-prices/
├── suppliers/
├── tankers/
├── fuel-orders/
├── deliveries/
├── inventory/
├── sales/
├── daily-reports/
├── notifications/
├── dashboard/
├── reports/
└── audit-logs/
```

---

# 7. Domain Module Structure

Each domain module should follow a predictable structure.

Example:

```text
sales/
├── sales.module.ts
├── sales.controller.ts
├── sales.service.ts
├── sales.repository.ts
├── entities/
│   └── sale.entity.ts
├── dto/
│   ├── create-sale.dto.ts
│   ├── list-sales.dto.ts
│   └── void-sale.dto.ts
├── interfaces/
│   └── sale.interface.ts
└── constants/
    └── sales.constants.ts
```

Not every module requires every file.

Keep the module as small as possible while preserving clear responsibility.

---

# 8. Module Responsibilities

## 8.1 Auth Module

Responsible for:

- Login
- Logout
- JWT
- Refresh tokens
- Password reset
- Authentication strategies
- Password hashing

Should not manage:

- branches
- inventory
- sales
- fuel orders

---

# 9. Users Module

Responsible for:

- Creating users
- Updating users
- Activating/deactivating users
- User lookup
- User role assignment

Business rules include:

```text
SUPER_ADMIN
    businessId = NULL
    branchId = NULL

ADMIN
    businessId = required
    branchId = NULL

MANAGER
    businessId = required
    branchId = required
```

---

# 10. Businesses Module

Responsible for:

- Business creation
- Business updates
- Business status
- Business lookup

The business is the primary tenant boundary.

---

# 11. Branches Module

Responsible for:

- Branch creation
- Branch updates
- Branch status
- Branch lookup
- Business-to-branch relationships

Managers are assigned to branches.

---

# 12. Fuel Types Module

Responsible for:

- PMS
- AGO
- DPK
- Future fuel types

The module manages the definition of fuel products.

It does not manage prices or inventory.

---

# 13. Fuel Prices Module

Responsible for:

- Creating prices
- Finding active price
- Historical price lookup
- Price interval validation

The module must prevent overlapping price intervals.

---

# 14. Suppliers Module

Responsible for:

- Supplier CRUD
- Supplier activation/deactivation
- Supplier lookup

---

# 15. Tankers Module

Responsible for:

- Tanker CRUD
- Capacity
- Driver information
- Tanker registration numbers

---

# 16. Fuel Orders Module

Responsible for:

- Creating orders
- Order items
- Order status transitions
- Supplier relationship
- Destination branch
- Order cancellation

It does not directly manipulate inventory.

Inventory changes happen when the delivery is actually received.

---

# 17. Deliveries Module

Responsible for:

- Receiving physical fuel deliveries
- Delivery items
- Expected vs actual quantities
- Discrepancies
- Delivery status
- Creating inventory movements

The delivery module coordinates with the inventory module.

---

# 18. Inventory Module

This is one of the most important modules in the platform.

Responsible for:

- Inventory ledger
- Inventory calculations
- Inventory transactions
- Inventory adjustments
- Current stock
- Inventory concurrency
- Stock validation

Inventory must remain ledger-driven.

---

# 19. Sales Module

Responsible for:

- Recording sales
- Resolving fuel price
- Calculating revenue
- Checking inventory
- Creating inventory deductions
- Voiding sales

Sales must coordinate with:

```text
Fuel Prices
Inventory
Audit Logs
```

---

# 20. Daily Reports Module

Responsible for:

- Generating daily reports
- Calculating report totals
- Submission
- Approval
- Rejection
- Resubmission

The report is a summary of existing operational records.

It must not independently create inventory transactions.

---

# 21. Notifications Module

Responsible for:

- Creating notifications
- Listing notifications
- Marking notifications read
- Notification types

Other modules may publish notification events.

---

# 22. Dashboard Module

Responsible only for aggregation.

It should not own operational business records.

Examples:

```text
GET /dashboard/admin
GET /dashboard/manager
GET /dashboard/inventory
```

Dashboard queries should read from operational services/repositories.

---

# 23. Reports Module

Responsible for:

- Sales reports
- Inventory reports
- Delivery reports
- Daily report summaries
- Export generation

Reports should not modify operational data.

---

# 24. Audit Logs Module

Responsible for:

- Reading audit logs
- Audit record persistence
- Audit-related queries

Audit logs should be append-only.

Normal API operations must never update or delete audit records.

---

# 25. Module Dependency Rules

The architecture should avoid circular dependencies.

Recommended direction:

```text
Auth
  ↓
Users

Fuel Prices
  ↓
Sales

Fuel Orders
  ↓
Deliveries
  ↓
Inventory

Sales
  ↓
Inventory

Sales
  ↓
Audit

Deliveries
  ↓
Audit

Daily Reports
  ↓
Sales
  ↓
Deliveries
  ↓
Inventory
```

Avoid:

```text
Module A → Module B → Module A
```

If two modules need shared functionality, move that functionality into:

```text
common/
```

or create a dedicated domain service.

---

# 26. Entity Layer

TypeORM entities should represent database persistence models.

Example:

```typescript
@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id', type: 'uuid' })
  businessId: string;

  @Column({ name: 'branch_id', type: 'uuid' })
  branchId: string;

  @Column({ name: 'fuel_type_id', type: 'uuid' })
  fuelTypeId: string;

  @Column({ name: 'sale_number' })
  saleNumber: string;

  @Column({
    name: 'litres_sold',
    type: 'numeric',
    precision: 18,
    scale: 3,
  })
  litresSold: string;

  @Column({
    name: 'unit_price',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  unitPrice: string;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 18,
    scale: 2,
  })
  totalAmount: string;

  @Column({ name: 'sold_at', type: 'timestamptz' })
  soldAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

---

# 27. PostgreSQL Numeric Handling

PostgreSQL `NUMERIC` values are commonly returned by TypeORM as strings.

Therefore:

```typescript
litresSold: string
unitPrice: string
totalAmount: string
```

may be preferable at the persistence layer.

Never use JavaScript floating-point arithmetic for financial calculations without appropriate care.

For example, avoid relying on:

```typescript
0.1 + 0.2
```

for financial calculations.

Use a decimal arithmetic strategy or PostgreSQL calculations where appropriate.

---

# 28. Money Representation

Database:

```text
NUMERIC(18,2)
```

Examples:

```text
1500.00
12750000.00
```

The API should serialize monetary values consistently.

Recommended:

```json
{
  "unitPrice": 1500,
  "totalAmount": 12750000
}
```

or strings if exact decimal preservation across clients is required.

The project should make this decision globally and apply it consistently.

---

# 29. Fuel Quantity Representation

Fuel quantities use:

```text
NUMERIC(18,3)
```

Example:

```text
44850.000
```

This provides enough precision for fuel measurement.

---

# 30. Repository Pattern

Repositories should isolate database access.

Example:

```typescript
@Injectable()
export class SalesRepository {
  constructor(
    @InjectRepository(Sale)
    private readonly repository: Repository<Sale>,
  ) {}

  findById(id: string) {
    return this.repository.findOne({
      where: { id },
    });
  }
}
```

The service should own business decisions.

---

# 31. Service Layer

Services coordinate domain operations.

Example:

```typescript
@Injectable()
export class SalesService {
  async createSale(
    user: AuthenticatedUser,
    dto: CreateSaleDto,
  ) {
    // business workflow
  }
}
```

Services should:

- Validate business rules
- Coordinate repositories
- Start transactions when necessary
- Call domain services
- Create audit records
- Return application-level results

---

# 32. Controllers

Controllers should be thin.

Example:

```typescript
@Controller('sales')
@ApiTags('Sales')
@ApiBearerAuth('access-token')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
  ) {}

  @Post()
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.createSale(user, dto);
  }
}
```

---

# 33. Authentication Architecture

Authentication flow:

```text
Login
  ↓
Validate credentials
  ↓
Load user
  ↓
Verify password
  ↓
Generate access token
  ↓
Generate refresh token
  ↓
Hash refresh token
  ↓
Store hash
  ↓
Return tokens
```

---

# 34. JWT Payload

Keep JWT payload minimal.

Recommended:

```typescript
interface JwtPayload {
  sub: string;
  role: UserRole;
  businessId: string | null;
  branchId: string | null;
}
```

Do not place sensitive business information inside the token.

---

# 35. Refresh Token Storage

Database:

```text
refresh_tokens
```

Recommended fields:

```text
id
user_id
token_hash
expires_at
revoked_at
created_at
```

Never store the raw refresh token.

---

# 36. Password Reset

Password reset flow:

```text
User requests reset
       ↓
Generate random token
       ↓
Hash token
       ↓
Store hash
       ↓
Send raw token through email
       ↓
User submits token
       ↓
Hash submitted token
       ↓
Compare
       ↓
Reset password
       ↓
Mark token used
```

The reset endpoint must not reveal whether an email exists.

---

# 37. RBAC Architecture

Use:

```text
@Roles()
RolesGuard
```

Example:

```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Post()
createBranch() {}
```

However, role checks alone are not enough.

The system also requires resource-level authorization.

---

# 38. Business Access Control

Example:

```typescript
if (
  user.role !== UserRole.SUPER_ADMIN &&
  resource.businessId !== user.businessId
) {
  throw new ForbiddenException();
}
```

This must be centralized where practical.

---

# 39. Branch Access Control

For managers:

```typescript
if (
  user.role === UserRole.MANAGER &&
  resource.branchId !== user.branchId
) {
  throw new ForbiddenException();
}
```

This prevents IDOR-style access.

A manager must not be able to access:

```text
/sales/<another-branch-sale-id>
```

even if the UUID is known.

---

# 40. Recommended Authorization Layers

```text
Layer 1:
JWT authentication

Layer 2:
Role authorization

Layer 3:
Business ownership

Layer 4:
Branch ownership

Layer 5:
Operation-specific business rules
```

All five may be required for a single operation.

---

# 41. Multi-Tenant Architecture

The platform is designed as a multi-tenant system.

The tenant is:

```text
business
```

Every business-owned operational table includes:

```text
business_id
```

This provides an explicit tenant boundary.

---

# 42. Tenant Isolation Rule

Never execute queries such as:

```typescript
repository.findOne({
  where: { id },
});
```

for a tenant-owned resource when authorization depends on business ownership.

Prefer:

```typescript
repository.findOne({
  where: {
    id,
    businessId: user.businessId,
  },
});
```

or enforce equivalent authorization in a dedicated service.

---

# 43. Manager Branch Isolation

For managers, queries should additionally include:

```text
branch_id = authenticatedUser.branchId
```

Example:

```typescript
where: {
  id,
  businessId: user.businessId,
  branchId: user.branchId,
}
```

---

# 44. Database Transactions

Use TypeORM transactions for critical operations.

Example:

```typescript
await this.dataSource.transaction(
  async (manager) => {
    // all writes
  },
);
```

Do not mix transactional repositories with the default repository inside the transaction.

Use the transaction manager consistently.

---

# 45. Sale Transaction

The sale transaction must perform:

```text
BEGIN
    ↓
Validate user
    ↓
Validate branch
    ↓
Lock/check inventory
    ↓
Resolve price
    ↓
Calculate amount
    ↓
Create sale
    ↓
Create inventory transaction
    ↓
Create audit log
    ↓
COMMIT
```

If any operation fails:

```text
ROLLBACK
```

---

# 46. Inventory Concurrency

Inventory is a concurrency-sensitive resource.

A simple:

```typescript
const stock = await getStock();

if (stock >= litres) {
  createSale();
}
```

is not sufficient.

Two simultaneous requests can both read the same stock.

The inventory operation must use an appropriate PostgreSQL locking strategy.

Possible approach:

```text
BEGIN
 ↓
Lock relevant inventory state
 ↓
Calculate current balance
 ↓
Validate available quantity
 ↓
Insert sale
 ↓
Insert inventory transaction
 ↓
COMMIT
```

---

# 47. Inventory Ledger

The source of truth is:

```text
inventory_transactions
```

Not:

```text
branches.currentStock
```

and not:

```text
fuel_types.currentStock
```

---

# 48. Inventory Calculation Service

Create a dedicated service:

```text
InventoryService
```

Responsibilities:

```text
getCurrentBalance()
getBranchInventory()
getLedger()
recordDelivery()
recordSale()
createAdjustment()
createCorrection()
```

---

# 49. Inventory Transaction Service

For stronger separation, inventory movement creation can be centralized:

```typescript
InventoryTransactionService
```

Example:

```typescript
await inventoryTransactionService.record({
  businessId,
  branchId,
  fuelTypeId,
  transactionType: InventoryTransactionType.SALE,
  quantityLitres: -litresSold,
  referenceType: 'SALE',
  referenceId: sale.id,
});
```

This prevents individual modules from inventing their own inventory logic.

---

# 50. Inventory Reference Integrity

Every operational inventory movement should identify its source.

Examples:

```text
DELIVERY
referenceType = DELIVERY
referenceId = delivery.id
```

```text
SALE
referenceType = SALE
referenceId = sale.id
```

This makes the ledger traceable.

---

# 51. Delivery Transaction

Delivery processing:

```text
Fuel Order
    ↓
Delivery
    ↓
Delivery Items
    ↓
Actual Quantity
    ↓
Inventory Transaction (+)
```

Expected quantity must not become inventory.

---

# 52. Sale Transaction

Sale processing:

```text
Sale
    ↓
Inventory Transaction (-)
```

The sale and inventory transaction must be created in the same database transaction.

---

# 53. Historical Pricing Service

Create:

```text
FuelPriceService
```

with a method similar to:

```typescript
getApplicablePrice(
  businessId: string,
  fuelTypeId: string,
  date: Date,
): Promise<Price>
```

The query must find the price whose effective period contains the sale timestamp.

---

# 54. Price Interval Rules

For a given:

```text
businessId
fuelTypeId
```

price intervals cannot overlap.

Valid:

```text
Oct 1 → Oct 9
Oct 10 → Oct 17
Oct 18 → NULL
```

Invalid:

```text
Oct 1 → Oct 15
Oct 10 → Oct 20
```

The database should provide additional protection where possible.

---

# 55. Sale Price Snapshot

When the sale is created:

```text
Current Fuel Price
       ↓
sales.unit_price
```

The sale keeps its historical price.

If price changes later:

```text
Fuel Price
₦1,500 → ₦1,600
```

the old sale remains:

```text
unitPrice = ₦1,500
```

---

# 56. Daily Report Architecture

Daily reports are derived from:

```text
Sales
Deliveries
Inventory
```

The report service should calculate:

```text
openingStock
+
deliveries
-
sales
=
closingStock
```

and:

```text
totalRevenue
=
SUM(sales.totalAmount)
```

The report should not duplicate operational transactions.

---

# 57. Daily Report Workflow

```text
DRAFT
  │
  ▼
SUBMITTED
  │
  ├─────────────┐
  ▼             ▼
APPROVED      REJECTED
                │
                ▼
              DRAFT
```

Only authorized roles may perform each transition.

---

# 58. State Transition Validation

Do not allow arbitrary status updates such as:

```http
PATCH /daily-reports/:id
```

with:

```json
{
  "status": "APPROVED"
}
```

Instead use explicit commands:

```text
POST /daily-reports/:id/submit
POST /daily-reports/:id/approve
POST /daily-reports/:id/reject
POST /daily-reports/:id/resubmit
```

This makes business transitions explicit and auditable.

---

# 59. Fuel Order State Machine

Recommended:

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
DRAFT → CANCELLED
SUBMITTED → CANCELLED
CONFIRMED → CANCELLED
```

Business rules must determine whether cancellation is allowed after transit/delivery.

---

# 60. Delivery State Machine

```text
PENDING
   │
   ├──► RECEIVED
   │
   └──► DISPUTED
```

A cancelled delivery should not create an inventory increase.

---

# 61. Sales State

Sales do not require a complex status workflow for MVP.

A normal sale is:

```text
CREATED
```

If reversed:

```text
VOIDED
```

A void must remain traceable.

---

# 62. Voiding a Sale

Do not:

```text
DELETE FROM sales
```

Instead:

```text
sales.voided_at = timestamp
sales.void_reason = reason
```

and create the corresponding inventory correction.

---

# 63. Audit Architecture

Audit logging should capture:

```text
Who?
What?
Which resource?
When?
Which business?
Which branch?
Before?
After?
From which IP?
Using which user agent?
```

The audit entity contains:

```text
business_id
branch_id
user_id
action
resource_type
resource_id
old_values
new_values
metadata
ip_address
user_agent
created_at
```

---

# 64. Audit Service

Create:

```text
AuditService
```

Example:

```typescript
await this.auditService.log({
  businessId,
  branchId,
  userId,
  action: 'SALE_CREATED',
  resourceType: 'SALE',
  resourceId: sale.id,
  oldValues: null,
  newValues: sale,
  metadata: {
    saleNumber: sale.saleNumber,
  },
});
```

---

# 65. Audit Logging Strategy

Critical business operations should explicitly call the audit service.

Examples:

```text
Sale created
Sale voided
Delivery received
Inventory adjusted
Fuel price changed
Order cancelled
Report approved
Report rejected
User deactivated
```

A global interceptor may supplement explicit audit logging, but critical domain actions should not rely solely on generic HTTP interception.

---

# 66. Notifications Architecture

Notifications should not tightly couple every domain module to notification persistence.

Prefer an application event approach.

Example:

```text
DailyReportsService
        ↓
ReportApprovedEvent
        ↓
NotificationsListener
        ↓
Create Notification
```

Potential NestJS implementation:

```text
@nestjs/event-emitter
```

for internal application events.

---

# 67. Event Examples

```text
SaleCreatedEvent
DeliveryReceivedEvent
DailyReportSubmittedEvent
DailyReportApprovedEvent
DailyReportRejectedEvent
InventoryLowEvent
```

Events should be used for secondary effects.

The primary business transaction must remain explicit.

---

# 68. Dashboard Architecture

Dashboard services should use optimized read queries.

Example:

```text
AdminDashboardService
```

Responsibilities:

```text
getSummary()
getBranchPerformance()
getRevenueSummary()
getInventorySummary()
```

Do not load thousands of sales into memory just to calculate totals.

Use database aggregation:

```sql
SUM(...)
COUNT(...)
GROUP BY ...
```

---

# 69. Reports Architecture

Reports should use dedicated query services.

Example:

```text
SalesReportService
InventoryReportService
DeliveryReportService
DailyReportSummaryService
```

This avoids putting reporting logic inside operational services.

---

# 70. Export Architecture

Exports should be handled by a dedicated service.

Example:

```text
ReportExportService
```

Responsibilities:

```text
generateSalesExcel()
generateInventoryExcel()
generateDeliveryExcel()
generateDailyReportExcel()
```

For MVP:

```text
ExcelJS
```

can be used for `.xlsx` generation.

---

# 71. Configuration Management

Environment-specific configuration should be centralized.

Example:

```text
.env
.env.development
.env.test
.env.production
```

Recommended variables:

```text
NODE_ENV
PORT

DATABASE_HOST
DATABASE_PORT
DATABASE_NAME
DATABASE_USER
DATABASE_PASSWORD

JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN

JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN

FRONTEND_URL

SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

Secrets must never be committed to Git.

---

# 72. Configuration Module

Use NestJS `ConfigModule`.

Example:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: [
    `.env.${process.env.NODE_ENV}`,
    '.env',
  ],
  validate: validateEnvironment,
});
```

Environment validation should happen at application startup.

---

# 73. Database Configuration

Production:

```text
synchronize = false
```

Use migrations.

Example:

```typescript
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host: config.getOrThrow<string>('DATABASE_HOST'),
    port: config.getOrThrow<number>('DATABASE_PORT'),
    username: config.getOrThrow<string>('DATABASE_USER'),
    password: config.getOrThrow<string>('DATABASE_PASSWORD'),
    database: config.getOrThrow<string>('DATABASE_NAME'),
    autoLoadEntities: true,
    synchronize: false,
  }),
});
```

---

# 74. Migrations

All schema changes must be represented by migrations.

Examples:

```text
1710000000000-CreateUsers.ts
1710000000001-CreateBusinesses.ts
1710000000002-CreateBranches.ts
1710000000003-CreateFuelTypes.ts
...
```

Never rely on:

```text
synchronize: true
```

in production.

---

# 75. Database Seed Strategy

Development seed data should create:

```text
1 business
3 branches
1 SUPER_ADMIN
1 ADMIN
3 MANAGER users
PMS
AGO
DPK
Sample supplier
Sample tanker
Sample fuel prices
```

Seed data must be clearly separated from production migrations.

---

# 76. API Prefix

In `main.ts`:

```typescript
app.setGlobalPrefix('api/v1');
```

This ensures all controllers are versioned consistently.

---

# 77. Global Validation

Use:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

This prevents unexpected request properties from entering the application.

---

# 78. Global Exception Handling

Create:

```text
HttpExceptionFilter
```

to normalize errors.

The frontend should receive a predictable structure regardless of which module generated the exception.

---

# 79. Request IDs

Every request should have a request identifier.

Example:

```text
X-Request-ID: 7d1f8e1c-...
```

This should appear in logs and preferably error responses.

This makes debugging production problems much easier.

---

# 80. Logging

The backend should log:

- Request ID
- HTTP method
- Endpoint
- Status code
- Duration
- User ID where available
- Business ID where available
- Error information

Never log:

```text
password
JWT
refresh token
password reset token
database password
```

---

# 81. Security Middleware

Recommended:

```text
Helmet
CORS
Rate Limiting
ValidationPipe
```

Example:

```typescript
app.use(helmet());

app.enableCors({
  origin: config.get('FRONTEND_URL'),
  credentials: true,
});
```

CORS should be explicitly configured for production.

---

# 82. Rate Limiting

Authentication endpoints should receive stricter rate limits.

Example:

```text
/login
/forgot-password
/reset-password
/refresh
```

Use NestJS throttling support.

---

# 83. Password Hashing

Passwords must never be stored directly.

Recommended:

```text
Argon2
```

Alternative:

```text
bcrypt
```

The stored value belongs in:

```text
users.password_hash
```

---

# 84. Secrets

The following must come from environment configuration:

```text
JWT secrets
Database password
SMTP credentials
Cloud credentials
Encryption keys
```

Never hard-code secrets in TypeScript files.

---

# 85. API Documentation

Swagger should document:

- Authentication
- Request DTOs
- Response DTOs
- Roles
- HTTP status codes
- Error responses
- Query parameters
- Pagination

Example:

```typescript
@ApiOperation({
  summary: 'Record a fuel sale',
})
@ApiResponse({
  status: 201,
  description: 'Sale recorded successfully',
})
@ApiResponse({
  status: 422,
  description: 'Insufficient inventory',
})
```

---

# 86. Testing Architecture

The backend should have three testing levels.

```text
Unit Tests
     ↓
Integration Tests
     ↓
End-to-End Tests
```

---

# 87. Unit Tests

Unit test business logic independently.

High-priority services:

```text
FuelPriceService
InventoryService
SalesService
DeliveryService
DailyReportService
AuthService
```

Examples:

```text
should reject sale when inventory is insufficient
should resolve historical fuel price
should calculate sale amount correctly
should reject manager access to another branch
should calculate daily report totals
```

---

# 88. Integration Tests

Integration tests should verify:

```text
Service
+
TypeORM
+
PostgreSQL
```

Examples:

```text
sale creates inventory transaction
delivery increases inventory
voiding sale creates correction
price intervals cannot overlap
daily report calculates from actual records
```

A test PostgreSQL database should be used.

---

# 89. End-to-End Tests

E2E tests should exercise the actual API.

Example:

```text
POST /auth/login
        ↓
POST /fuel-orders
        ↓
POST /deliveries
        ↓
GET /inventory
        ↓
POST /sales
        ↓
GET /inventory
        ↓
POST /daily-reports
        ↓
POST /daily-reports/:id/submit
        ↓
POST /daily-reports/:id/approve
```

This verifies the core business workflow.

---

# 90. Critical E2E Scenario

A complete test should prove:

```text
Initial stock = 0

Delivery = +45,000 L

Current stock = 45,000 L

Sale = 8,500 L

Current stock = 36,500 L

Revenue =
8,500 × applicable price

Daily report:
Received = 45,000 L
Sold = 8,500 L
Closing = 36,500 L
```

This is the most important MVP workflow.

---

# 91. Data Integrity Rules

The application must enforce:

```text
Sale litresSold > 0

Delivery actualQuantity >= 0

Fuel price >= 0

Tanker capacity > 0

Business-scoped codes are unique

Daily report branch/date is unique

Sale number is unique per business

Order number is unique per business

Tanker registration is unique per business
```

---

# 92. Soft Deletion

Soft deletion should be used for master records where appropriate.

Entities:

```text
users
businesses
branches
suppliers
tankers
fuel_types
```

Example:

```text
deleted_at
```

Operational history should remain.

---

# 93. Operational Records

Do not casually delete:

```text
sales
deliveries
inventory_transactions
daily_reports
audit_logs
```

Use:

```text
VOID
CORRECTION
DISPUTE
REJECTION
```

depending on the resource.

---

# 94. Repository Query Rules

Repositories should always consider tenant context.

Bad:

```typescript
findOne({
  where: { id },
});
```

Potentially unsafe:

```text
Could return another tenant's record.
```

Better:

```typescript
findOne({
  where: {
    id,
    businessId,
  },
});
```

For managers:

```typescript
findOne({
  where: {
    id,
    businessId,
    branchId,
  },
});
```

---

# 95. Service Authorization

Authorization should not depend solely on controllers.

For sensitive operations, services should validate ownership as well.

Example:

```text
Controller
   ↓
RolesGuard
   ↓
SalesService
   ↓
Verify business
   ↓
Verify branch
   ↓
Process sale
```

This provides defense in depth.

---

# 96. DTO Separation

Never reuse an entity directly as a request DTO.

Avoid:

```typescript
@Post()
create(@Body() body: Sale) {}
```

Use:

```typescript
create(@Body() dto: CreateSaleDto) {}
```

This prevents clients from controlling fields such as:

```text
businessId
createdAt
voidedAt
totalAmount
unitPrice
```

unless explicitly permitted.

---

# 97. Server-Controlled Fields

The client must not directly control:

```text
businessId
createdBy
recordedBy
createdAt
updatedAt
totalAmount
unitPrice
inventory balance
audit fields
approval reviewer
approval timestamp
```

These values must be derived by the backend.

---

# 98. Current User Context

Use a typed interface:

```typescript
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  businessId: string | null;
  branchId: string | null;
}
```

Controller:

```typescript
@CurrentUser()
user: AuthenticatedUser
```

This should be the standard way to access authenticated identity.

---

# 99. Business Context

For most operations:

```text
user.businessId
```

is the authoritative business context.

Do not require the frontend to repeatedly submit:

```json
{
  "businessId": "..."
}
```

unless there is a genuine cross-business SUPER_ADMIN use case.

---

# 100. Branch Context

For MANAGER:

```text
user.branchId
```

is the authoritative branch.

For ADMIN:

```text
branchId
```

may be selected when the operation applies to a particular branch, but the backend must verify that the branch belongs to the admin's business.

---

# 101. Super Admin Context

SUPER_ADMIN is the exception to normal tenant scoping.

A SUPER_ADMIN can explicitly select:

```text
businessId
```

when performing platform administration.

This must still be auditable.

---

# 102. Business Service Boundaries

Business modules should not bypass domain services.

For example:

```text
SalesService
```

should not directly manipulate:

```text
FuelPrice
```

through raw TypeORM logic.

Instead:

```text
SalesService
      ↓
FuelPriceService
      ↓
resolve price
```

This keeps business rules centralized.

---

# 103. Cross-Module Communication

Prefer direct service calls for primary synchronous operations.

Example:

```text
SalesService
   ↓
FuelPriceService
   ↓
InventoryService
```

Use events for secondary actions:

```text
SaleCreatedEvent
   ↓
Notification / Analytics / Future integrations
```

---

# 104. Avoid Generic "God Services"

Do not create:

```text
BusinessService
```

that handles:

```text
users
sales
inventory
deliveries
reports
pricing
```

Each domain should own its behavior.

---

# 105. Avoid Generic "Transaction" Abstraction

Do not create a generic API such as:

```text
POST /transactions
```

for:

```text
sales
deliveries
inventory
payments
expenses
```

These are different business concepts.

Keep explicit domains:

```text
/sales
/deliveries
/inventory
```

---

# 106. Database Access Strategy

For ordinary CRUD:

```text
Repository
```

For complex business transactions:

```text
DataSource.transaction()
```

For complex reporting:

```text
QueryBuilder
```

Use raw SQL only where it provides a clear benefit and remains parameterized.

---

# 107. QueryBuilder Use Cases

QueryBuilder is appropriate for:

- inventory aggregation
- dashboard statistics
- report generation
- complex filtering
- historical price resolution
- grouped sales reports

Example:

```typescript
this.saleRepository
  .createQueryBuilder('sale')
  .select('SUM(sale.totalAmount)', 'revenue')
  .where('sale.businessId = :businessId', { businessId });
```

---

# 108. Transaction Boundary Rule

The transaction should be owned by the service coordinating the business operation.

Example:

```text
SalesService
    owns transaction

InventoryService
    participates

AuditService
    participates
```

Do not let every repository independently create transactions.

---

# 109. Example Sale Service Architecture

```typescript
@Injectable()
export class SalesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly fuelPriceService: FuelPriceService,
    private readonly auditService: AuditService,
  ) {}

  async createSale(
    user: AuthenticatedUser,
    dto: CreateSaleDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      // 1. authorize branch
      // 2. resolve price
      // 3. check inventory
      // 4. create sale
      // 5. create inventory transaction
      // 6. audit
      // 7. return result
    });
  }
}
```

---

# 110. Transactional Inventory Service

The inventory service should support transaction-aware operations.

Conceptually:

```typescript
inventoryService.recordSale({
  manager,
  ...
});
```

This ensures it participates in the parent transaction.

---

# 111. Idempotency Architecture

Critical requests should optionally provide:

```text
Idempotency-Key
```

The system can maintain an idempotency record:

```text
id
business_id
user_id
key
request_hash
response_status
response_body
created_at
```

A repeated identical request returns the original result.

A reused key with a different request body should be rejected.

---

# 112. API Response DTOs

Do not return TypeORM entities directly.

Use response DTOs where appropriate.

Example:

```typescript
export class SaleResponseDto {
  id: string;
  saleNumber: string;
  litresSold: number;
  unitPrice: number;
  totalAmount: number;
  soldAt: string;
}
```

Benefits:

- prevents accidental field exposure
- gives stable API contracts
- separates persistence from API representation

---

# 113. Pagination Response

Use a shared structure:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

---

# 114. API Versioning Strategy

MVP:

```text
/api/v1
```

If breaking changes are required later:

```text
/api/v2
```

Do not silently change existing response structures.

---

# 115. File and Export Handling

Exports should be generated server-side.

The API should return:

```http
Content-Disposition: attachment
```

with an appropriate filename.

Example:

```text
sales-report-2026-10-01-to-2026-10-31.xlsx
```

For very large reports in the future, asynchronous report generation can be introduced.

---

# 116. Future Background Jobs

Not required for the first MVP, but architecture should allow:

```text
BullMQ
Redis
```

for:

- email sending
- large report generation
- notification processing
- scheduled inventory alerts
- future reconciliation jobs

Do not introduce queues until there is a real asynchronous workload.

---

# 117. Caching

Do not introduce aggressive caching into the core inventory flow initially.

In particular, current inventory should not depend on a stale cache.

Potential future cache candidates:

```text
Dashboard summaries
Fuel type lists
Branch lists
Notification counts
```

Redis can be introduced when performance requirements justify it.

---

# 118. Health Check

Provide:

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Production health checks should verify required dependencies without exposing secrets.

---

# 119. Graceful Shutdown

NestJS should close:

- HTTP server
- database connections
- Redis connections if introduced
- background workers if introduced

during application shutdown.

---

# 120. Deployment Architecture

MVP:

```text
                 Internet
                    │
                    ▼
             ┌─────────────┐
             │ Reverse     │
             │ Proxy / TLS │
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │ NestJS API  │
             │   PM2/Docker│
             └──────┬──────┘
                    │
                    ▼
             ┌─────────────┐
             │ PostgreSQL  │
             └─────────────┘
```

The exact cloud provider can be selected separately.

---

# 121. Production Environment

Production should use:

```text
NODE_ENV=production
```

and:

```text
synchronize=false
```

Production deployments should run:

```text
build
migration
start
```

in a controlled deployment pipeline.

---

# 122. CI/CD

Recommended pipeline:

```text
Push
 ↓
Install dependencies
 ↓
Lint
 ↓
Unit tests
 ↓
Build
 ↓
Integration tests
 ↓
Migration validation
 ↓
Deploy
 ↓
Health check
```

---

# 123. Git Strategy

Recommended branches:

```text
main
develop
feature/*
fix/*
hotfix/*
```

Example:

```text
feature/auth-module
feature/inventory-module
feature/sales-module
feature/daily-reports
```

Pull requests should require:

- passing tests
- lint success
- build success
- code review

---

# 124. Development Order

The backend should be implemented in dependency order.

## Phase 1 — Foundation

```text
NestJS setup
Configuration
PostgreSQL
TypeORM
Migrations
Global validation
Error handling
Logging
Swagger
Health check
```

---

# 125. Phase 2 — Identity

```text
Users
Auth
JWT
Refresh tokens
Password hashing
Password reset
RBAC
```

---

# 126. Phase 3 — Business Structure

```text
Businesses
Branches
User branch assignment
Business access
Branch access
```

---

# 127. Phase 4 — Fuel Configuration

```text
Fuel Types
Fuel Prices
Historical pricing
Price validation
```

---

# 128. Phase 5 — Supply Chain

```text
Suppliers
Tankers
Fuel Orders
Deliveries
```

---

# 129. Phase 6 — Inventory

Implement inventory before sales.

```text
Inventory transactions
Inventory calculations
Delivery movements
Adjustments
Concurrency protection
```

---

# 130. Phase 7 — Sales

```text
Sales
Historical price resolution
Inventory deduction
Revenue calculation
Sale voiding
Audit
```

---

# 131. Phase 8 — Daily Reports

```text
Report generation
Submission
Approval
Rejection
Resubmission
Notifications
```

---

# 132. Phase 9 — Dashboard and Reports

```text
Admin dashboard
Manager dashboard
Inventory dashboard
Sales reports
Inventory reports
Delivery reports
Excel exports
```

---

# 133. Phase 10 — Hardening

```text
Security review
Authorization tests
Concurrency tests
IDOR tests
Tenant-isolation tests
Performance testing
E2E testing
Production configuration
CI/CD
```

---

# 134. Recommended Implementation Priority

The critical path is:

```text
Auth
 ↓
Users
 ↓
Business / Branch
 ↓
Fuel Types / Prices
 ↓
Suppliers / Tankers
 ↓
Fuel Orders
 ↓
Deliveries
 ↓
Inventory
 ↓
Sales
 ↓
Daily Reports
 ↓
Dashboard / Reports
```

This order follows actual business dependencies.

---

# 135. MVP Module Dependency Graph

```text
                         AUTH
                           │
                           ▼
                         USERS
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
            BUSINESSES             BRANCHES
                │                     │
                └──────────┬──────────┘
                           │
                           ▼
                     FUEL TYPES
                           │
                           ▼
                     FUEL PRICES
                           │
             ┌─────────────┴──────────────┐
             ▼                            ▼
         SUPPLIERS                      TANKERS
             │                            │
             └─────────────┬──────────────┘
                           ▼
                      FUEL ORDERS
                           │
                           ▼
                       DELIVERIES
                           │
                           ▼
                       INVENTORY
                           │
                           ▼
                         SALES
                           │
                           ▼
                    DAILY REPORTS
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
              DASHBOARD          REPORTS
```

Cross-cutting:

```text
Authentication
Authorization
Audit
Notifications
Logging
Validation
```

---

# 136. Architecture Rules for Developers

Every developer working on the backend should follow these rules:

### Rule 1

Do not put business logic in controllers.

### Rule 2

Do not return TypeORM entities directly unless intentionally approved.

### Rule 3

Never trust `businessId` or `branchId` supplied by a client without authorization checks.

### Rule 4

Never allow a manager to access another branch.

### Rule 5

Never calculate authoritative revenue on the frontend.

### Rule 6

Never use expected delivery quantity as received inventory.

### Rule 7

Never modify historical inventory transactions.

### Rule 8

Never delete a sale to reverse it.

### Rule 9

Never change historical sale prices when current prices change.

### Rule 10

Never use `synchronize: true` in production.

### Rule 11

Critical operational writes must use transactions.

### Rule 12

Every important business action must be auditable.

---

# 137. Anti-Patterns to Avoid

## God Controller

```text
BusinessController
```

handling every operation.

Avoid.

---

## God Service

```text
BusinessService
```

handling all domains.

Avoid.

---

## Generic Transaction Table

```text
transactions
```

for every business event.

Avoid.

---

## Direct Entity Exposure

```typescript
return saleEntity;
```

when it exposes internal fields.

Avoid.

---

## Frontend-Controlled Revenue

```json
{
  "litresSold": 8500,
  "unitPrice": 1500,
  "totalAmount": 1
}
```

Never trust `totalAmount`.

---

## Frontend-Controlled Inventory

```json
{
  "currentStock": 50000
}
```

Never allow this.

---

## IDOR

```http
GET /sales/another-business-sale-id
```

must fail authorization.

---

# 138. Core Security Model

The backend security model is:

```text
                 REQUEST
                    │
                    ▼
             JWT Authentication
                    │
                    ▼
              Role Validation
                    │
                    ▼
            Business Validation
                    │
                    ▼
             Branch Validation
                    │
                    ▼
           Resource Validation
                    │
                    ▼
          Business Rule Validation
                    │
                    ▼
             Database Transaction
                    │
                    ▼
                 AUDIT
                    │
                    ▼
               RESPONSE
```

Security is therefore enforced at multiple levels.

---

# 139. Core Business Model

The backend should ultimately enforce this equation:

```text
Opening Stock
+ Actual Deliveries
+ Positive Adjustments
+ Transfers In
- Sales
- Transfers Out
+ Corrections
=
Current Stock
```

Revenue:

```text
Revenue = Σ Sale Total Amount
```

Sale:

```text
Sale Total = Litres Sold × Historical Applicable Price
```

Daily closing stock:

```text
Opening Stock
+ Received
- Sold
+/- Adjustments
=
Closing Stock
```

---

# 140. Definition of Done

The backend architecture is considered correctly implemented when:

- NestJS modules are domain-oriented.
- Controllers remain thin.
- Services contain business workflows.
- Repositories isolate persistence.
- PostgreSQL is accessed through TypeORM.
- Migrations are used.
- Authentication is implemented.
- RBAC is implemented.
- Business isolation is enforced.
- Branch isolation is enforced.
- Managers cannot access other branches.
- Inventory is ledger-driven.
- Inventory writes are transactional.
- Concurrent sales cannot oversell stock.
- Historical fuel prices are preserved.
- Sales snapshot their applicable price.
- Deliveries use actual received quantities.
- Daily reports derive their totals from operational data.
- Operational history is preserved.
- Audit logs are append-only.
- Critical operations are auditable.
- DTO validation is enabled globally.
- API responses are consistent.
- Swagger documents the API.
- Unit tests cover core business rules.
- Integration tests cover database behavior.
- E2E tests cover the primary business workflow.
- Production uses migrations rather than synchronization.
- Secrets are environment-based.
- The system is ready for deployment.

---

# 141. Final Backend Architecture

The completed backend can be summarized as:

```text
┌────────────────────────────────────────────────────────────┐
│                    K.B.Y GLOBAL INVESTMENT                │
│                         NestJS API                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Cross-Cutting                                             │
│  ┌────────┐ ┌─────────┐ ┌────────┐ ┌──────────┐           │
│  │  JWT   │ │  RBAC   │ │ Audit  │ │Validation│           │
│  └────────┘ └─────────┘ └────────┘ └──────────┘           │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Identity & Tenancy                                        │
│  ┌──────┐ ┌───────┐ ┌──────────┐ ┌─────────┐             │
│  │ Auth │ │ Users │ │ Business │ │ Branches│             │
│  └──────┘ └───────┘ └──────────┘ └─────────┘             │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Fuel & Supply                                             │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌────────┐     │
│  │Fuel Types│ │Fuel Prices │ │ Suppliers│ │ Tankers│     │
│  └──────────┘ └────────────┘ └──────────┘ └────────┘     │
│                              │                             │
│                              ▼                             │
│                        ┌────────────┐                       │
│                        │Fuel Orders │                       │
│                        └─────┬──────┘                       │
│                              ▼                             │
│                        ┌────────────┐                       │
│                        │ Deliveries │                       │
│                        └─────┬──────┘                       │
│                              ▼                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Core Operations                                           │
│                                                            │
│                     ┌─────────────┐                        │
│                     │  Inventory  │                        │
│                     │    Ledger   │                        │
│                     └──────┬──────┘                        │
│                            ▲                               │
│                            │                               │
│                     ┌──────┴──────┐                        │
│                     │    Sales    │                        │
│                     └──────┬──────┘                        │
│                            │                               │
│                            ▼                               │
│                     ┌─────────────┐                        │
│                     │Daily Reports│                        │
│                     └─────────────┘                        │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Read / Communication                                      │
│  ┌───────────┐ ┌────────────┐ ┌──────────────┐            │
│  │ Dashboard │ │  Reports   │ │Notifications │            │
│  └───────────┘ └────────────┘ └──────────────┘            │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                    TypeORM / PostgreSQL                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

The most important architectural principle is:

```text
The database stores the history.
The domain services enforce the rules.
The inventory ledger records stock movement.
The API exposes controlled business operations.
Authorization protects every tenant and branch boundary.
```

This architecture is the implementation foundation for the K.B.Y GLOBAL INVESTMENT MVP.