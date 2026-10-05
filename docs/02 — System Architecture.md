# K.B.Y GLOBAL INVESTMENT
## Fuel Station Operations, Inventory & Revenue Management Platform

**Document:** System Architecture  
**Version:** 1.0  
**Status:** Architecture / MVP Planning  
**Related Document:** `01-product-requirements.md`

---

# 1. Architecture Overview

The K.B.Y GLOBAL INVESTMENT platform will use a modular web application architecture consisting of:

```text
┌──────────────────────────────────────────────────────────────┐
│                         USERS                                │
│                                                              │
│     Super Admin        Admin / Owner        Manager          │
└──────────────┬────────────────┬─────────────────┬────────────┘
               │                │                 │
               └────────────────┼─────────────────┘
                                │
                         HTTPS / REST API
                                │
                ┌───────────────▼────────────────┐
                │          NEXT.JS FRONTEND      │
                │                                │
                │ Dashboard / Forms / Reports    │
                │ Tables / Charts / Auth UI      │
                └───────────────┬────────────────┘
                                │
                            REST API
                                │
                ┌───────────────▼────────────────┐
                │          NESTJS API            │
                │                                │
                │ Auth                          │
                │ Users                         │
                │ Businesses                     │
                │ Branches                       │
                │ Fuel                           │
                │ Orders                         │
                │ Deliveries                     │
                │ Inventory                      │
                │ Sales                          │
                │ Reports                        │
                │ Notifications                  │
                │ Audit                          │
                └───────────────┬────────────────┘
                                │
                        TypeORM / PostgreSQL
                                │
                ┌───────────────▼────────────────┐
                │          POSTGRESQL            │
                │                                │
                │ Operational Data               │
                │ Inventory Ledger               │
                │ Audit Data                     │
                └────────────────────────────────┘
```

---

# 2. Architectural Goals

The architecture must prioritize:

1. Data integrity
2. Security
3. Branch isolation
4. Inventory accuracy
5. Auditability
6. Maintainability
7. Scalability
8. Testability
9. Clear separation of responsibilities
10. Future SaaS capability

---

# 3. Recommended Technology Stack

## Frontend

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod
TanStack Query
Recharts
```

## Backend

```text
NestJS
TypeScript
PostgreSQL
TypeORM
JWT
Passport
class-validator
class-transformer
Swagger/OpenAPI
```

## Infrastructure

Initial architecture:

```text
Frontend
    ↓
Cloud-hosted Next.js

Backend
    ↓
Cloud-hosted NestJS

Database
    ↓
Managed PostgreSQL

File Storage
    ↓
Object Storage
```

The exact cloud provider can be selected later.

---

# 4. Architectural Style

The backend will use a:

> **Modular Monolith**

architecture.

This is the preferred architecture for the MVP.

It provides strong separation between business domains without introducing the operational complexity of microservices.

```text
                    NestJS Application
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
     Identity          Operations          Reporting
        │                  │                  │
     Auth/User        Inventory/Sales       Reports
     Roles            Orders/Delivery       Analytics
```

---

# 5. Why Not Microservices?

Microservices are not necessary for the first version.

They would introduce:

- Multiple deployments
- Service discovery
- Network communication
- Distributed transactions
- More monitoring
- More infrastructure
- Greater development complexity

The MVP should instead use a well-structured modular monolith.

If the platform eventually becomes large enough, individual modules can be extracted into services.

---

# 6. Multi-Tenant Architecture

Although the first business is:

```text
K.B.Y GLOBAL INVESTMENT
```

the platform should be designed so that multiple businesses can eventually use it.

The conceptual structure is:

```text
Platform
│
├── Business A
│   ├── Branch A1
│   ├── Branch A2
│   └── Branch A3
│
├── Business B
│   ├── Branch B1
│   └── Branch B2
│
└── Business C
    └── Branch C1
```

Each operational record should belong to a business either directly or indirectly.

---

# 7. Tenant Isolation

The application must never trust a business ID supplied by the frontend.

For example, this request must not be sufficient:

```http
GET /api/branches/business/123
```

The backend must determine the authenticated user's business from the authenticated identity.

The server should enforce:

```text
Authenticated User
        ↓
Business Membership
        ↓
Allowed Business
        ↓
Allowed Branch
        ↓
Resource
```

This prevents cross-business data access.

---

# 8. User Architecture

Users will have:

```text
User
 ├── Role
 ├── Business
 └── Branch (for Manager)
```

Conceptually:

```text
SUPER_ADMIN
    │
    └── Platform-wide access

ADMIN
    │
    └── Business
         │
         ├── Branch A
         ├── Branch B
         └── Branch C

MANAGER
    │
    └── One assigned branch
```

---

# 9. Authorization Model

Authorization will have two levels.

## Level 1 — Role Authorization

Example:

```text
@Roles(Role.ADMIN)
```

or:

```text
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
```

## Level 2 — Resource/Branch Authorization

A manager requesting:

```text
GET /sales/:saleId
```

must pass:

```text
Is authenticated?
        ↓
Is Manager?
        ↓
Does sale belong to manager's branch?
        ↓
Allow
```

This is more important than role checking alone.

---

# 10. Backend Module Architecture

Recommended structure:

```text
src/
│
├── main.ts
├── app.module.ts
│
├── config/
│
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── pipes/
│   ├── middleware/
│   ├── constants/
│   ├── enums/
│   └── utils/
│
├── auth/
│
├── users/
│
├── businesses/
│
├── branches/
│
├── fuel/
│
├── suppliers/
│
├── tankers/
│
├── fuel-orders/
│
├── deliveries/
│
├── inventory/
│
├── sales/
│
├── daily-reports/
│
├── notifications/
│
├── reports/
│
└── audit/
```

---

# 11. Auth Module

Responsibilities:

- Login
- Logout
- Refresh token
- Forgot password
- Reset password
- Password hashing
- JWT generation
- Authentication strategies

Structure:

```text
auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── dto/
├── guards/
├── strategies/
└── interfaces/
```

---

# 12. Users Module

Responsibilities:

- User creation
- User lookup
- User update
- Account activation
- Account deactivation
- Role management
- Manager assignment

The Users module should not contain authentication logic.

Authentication belongs in `AuthModule`.

---

# 13. Businesses Module

Responsibilities:

- Business creation
- Business profile
- Business activation/deactivation
- Business configuration

Example:

```text
Business
 ├── name
 ├── registrationNumber
 ├── address
 ├── phone
 ├── email
 └── status
```

---

# 14. Branches Module

Responsibilities:

- Create branch
- Update branch
- Activate/deactivate branch
- Assign manager
- View branch details

Every branch belongs to exactly one business.

```text
Business
   │
   └── Branch
```

---

# 15. Fuel Module

The Fuel module handles:

- Fuel types
- Fuel prices
- Price history

Example:

```text
FuelType
    │
    └── FuelPrice
           │
           ├── Effective From
           └── Effective Until
```

Historical prices must remain available.

---

# 16. Suppliers Module

Responsibilities:

- Supplier registration
- Supplier details
- Supplier status
- Supplier history

Suppliers can be reused across multiple orders.

---

# 17. Tankers Module

Responsibilities:

- Register tanker
- Update tanker
- Driver information
- Tanker capacity
- Tanker status

A tanker should have a unique registration/identifier.

---

# 18. Fuel Orders Module

The Fuel Order module represents a request/order for fuel.

Workflow:

```text
DRAFT
  ↓
SUBMITTED
  ↓
CONFIRMED
  ↓
IN_TRANSIT
  ↓
DELIVERED
```

Potential terminal states:

```text
CANCELLED
```

---

# 19. Delivery Module

A delivery represents the actual physical arrival of fuel.

Important fields:

```text
Expected Quantity
Actual Quantity
Difference
Delivery Date
Branch
Tanker
Fuel Order
```

The delivery module is responsible for initiating an inventory increase.

---

# 20. Inventory Module

This is one of the most critical modules in the entire system.

Inventory must be ledger-based.

Do not make:

```text
Branch.currentFuel = 43000
```

the only source of truth.

Instead, maintain:

```text
InventoryTransaction
```

records.

---

# 21. Inventory Ledger

Example:

```text
Inventory Ledger

Transaction             Quantity
----------------------------------
Opening Balance          +10,000
Delivery                 +45,000
Sale                      -5,000
Sale                      -3,000
Adjustment                -1,000
----------------------------------
Current Balance           46,000
```

The ledger allows the system to answer:

> Why is this branch currently holding 46,000 litres?

---

# 22. Inventory Transaction Model

Each transaction should contain:

```text
id
businessId
branchId
fuelTypeId
transactionType
quantity
referenceType
referenceId
occurredAt
createdBy
notes
```

Example:

```text
transactionType = DELIVERY
referenceType = DELIVERY
referenceId = delivery-123
quantity = 44850
```

A sale would become:

```text
transactionType = SALE
referenceType = SALE
referenceId = sale-456
quantity = -8500
```

---

# 23. Inventory Source of Truth

The authoritative inventory value should be derived from the ledger.

Conceptually:

```text
Current Stock
=
SUM(all valid inventory transactions)
```

For performance, the system may later maintain a cached/current balance.

However:

> The ledger remains the authoritative audit trail.

---

# 24. Inventory Transaction Rules

Inventory transactions should be immutable wherever possible.

A transaction should not simply be edited.

Instead of:

```text
Change:
-5,000 → -6,000
```

create a correction:

```text
Original:
-5,000

Adjustment:
-1,000
```

This preserves history.

---

# 25. Sales Module

The Sales module handles:

- Recording sales
- Calculating revenue
- Creating inventory transactions
- Sales history

The workflow should be transactional.

```text
Create Sale
     ↓
Validate Quantity
     ↓
Determine Price
     ↓
Calculate Revenue
     ↓
Create Sale
     ↓
Create Inventory Transaction
     ↓
Commit Transaction
```

If any step fails:

```text
ROLLBACK
```

---

# 26. Sale Price Architecture

When a sale is created, the system should store the actual price used.

Example:

```text
Sale

litres:
8500

unitPrice:
1500

totalAmount:
12750000
```

Even if the fuel price later becomes:

```text
₦1,600
```

the historical sale remains:

```text
₦1,500/L
```

This protects historical financial accuracy.

---

# 27. Sales and Inventory Transaction

A sale and its inventory transaction should be created within the same database transaction.

```text
BEGIN TRANSACTION

Create Sale
Create InventoryTransaction

COMMIT
```

If inventory deduction fails:

```text
ROLLBACK
```

No partial sale should exist.

---

# 28. Daily Reports Module

The Daily Reports module should summarize operational activity.

It should not independently manipulate inventory.

For example:

```text
Daily Report
     │
     ├── Opening Stock
     ├── Deliveries
     ├── Sales
     ├── Closing Stock
     └── Revenue
```

These values should be calculated from the underlying records wherever possible.

---

# 29. Daily Report Architecture

A manager submits:

```text
Date
Branch
Manager Notes
```

The system derives:

```text
Opening Stock
Deliveries
Sales
Closing Stock
Revenue
```

This minimizes manual manipulation.

---

# 30. Report Approval Workflow

```text
DRAFT
   ↓
SUBMITTED
   ↓
UNDER_REVIEW
   ↓
APPROVED
```

Alternative:

```text
SUBMITTED
   ↓
REJECTED
   ↓
CORRECTED
   ↓
RESUBMITTED
```

Approval actions should be audited.

---

# 31. Reporting Module

The Reports module should not duplicate operational data.

It should query:

```text
Sales
InventoryTransactions
Deliveries
DailyReports
Branches
FuelPrices
```

and produce aggregated results.

Examples:

```text
Daily Sales
Monthly Revenue
Branch Performance
Fuel Movement
Delivery Variance
Inventory Position
```

---

# 32. Notification Module

Notifications should be event-driven internally.

Example:

```text
Manager submits report
        ↓
ReportSubmittedEvent
        ↓
NotificationService
        ↓
Create Admin Notification
```

Future channels can subscribe to the same event:

```text
In-App
Email
SMS
WhatsApp
```

This prevents business modules from becoming tightly coupled to notification delivery.

---

# 33. Audit Module

The Audit module records important business actions.

Example:

```text
AuditLog

actorId
actorRole
businessId
branchId
action
resourceType
resourceId
oldValue
newValue
timestamp
ipAddress
```

Audit logs should be append-only for normal users.

---

# 34. Common Backend Layer

Shared functionality belongs in:

```text
common/
```

Recommended components:

```text
common/
├── decorators/
│   ├── roles.decorator.ts
│   ├── current-user.decorator.ts
│   └── audit-log.decorator.ts
│
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── branch-access.guard.ts
│
├── interceptors/
│
├── filters/
│
├── pipes/
│
├── enums/
│
└── utils/
```

---

# 35. API Architecture

The API should use versioning.

Example:

```text
/api/v1/auth
/api/v1/users
/api/v1/businesses
/api/v1/branches
/api/v1/fuel
/api/v1/orders
/api/v1/deliveries
/api/v1/inventory
/api/v1/sales
/api/v1/reports
```

This allows future API versions without breaking existing clients.

---

# 36. REST API Convention

Example:

```http
GET    /api/v1/branches
POST   /api/v1/branches
GET    /api/v1/branches/:id
PATCH  /api/v1/branches/:id
DELETE /api/v1/branches/:id
```

For sales:

```http
GET    /api/v1/sales
POST   /api/v1/sales
GET    /api/v1/sales/:id
```

---

# 37. API Response Structure

Use a consistent structure.

Success:

```json
{
  "success": true,
  "message": "Sale recorded successfully",
  "data": {
    "id": "..."
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Insufficient fuel inventory",
  "error": "INSUFFICIENT_INVENTORY"
}
```

Pagination:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

# 38. Frontend Architecture

Recommended Next.js structure:

```text
src/
├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── admin/
│   ├── manager/
│   └── super-admin/
│
├── components/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── charts/
│   └── layout/
│
├── features/
│   ├── auth/
│   ├── branches/
│   ├── fuel/
│   ├── orders/
│   ├── deliveries/
│   ├── inventory/
│   ├── sales/
│   └── reports/
│
├── lib/
│   ├── api/
│   ├── auth/
│   └── utils/
│
├── hooks/
├── types/
└── config/
```

---

# 39. Frontend Role-Based Navigation

The UI should adapt based on role.

## Super Admin

```text
Dashboard
Businesses
Admins
Users
Platform Reports
Audit Logs
Settings
```

## Admin

```text
Dashboard
Branches
Managers
Fuel
Suppliers
Tankers
Orders
Deliveries
Inventory
Sales
Daily Reports
Reports
Notifications
Settings
```

## Manager

```text
Dashboard
Inventory
Deliveries
Sales
Daily Reports
Report History
Notifications
Profile
```

---

# 40. Frontend State Management

Use server-state management for API data.

Recommended:

```text
TanStack Query
```

It will handle:

- Fetching
- Caching
- Refetching
- Mutations
- Loading states
- Error states

Avoid putting all API data into a global Redux-style store unnecessarily.

---

# 41. Authentication Flow

Recommended flow:

```text
User
  │
  ▼
Login
  │
  ▼
NestJS
  │
  ├── Validate credentials
  │
  ├── Generate access token
  │
  └── Generate refresh token
  │
  ▼
Frontend
```

The frontend then uses the access token for API requests.

Refresh tokens should be handled securely.

---

# 42. Recommended Token Strategy

Use:

```text
Short-lived Access Token
+
Long-lived Refresh Token
```

Example:

```text
Access Token:
15 minutes

Refresh Token:
7-30 days
```

Exact values can be configured later.

Refresh token rotation should be considered.

---

# 43. Authentication Security

Passwords:

```text
Argon2
```

or:

```text
bcrypt
```

JWT:

```text
Strong secret/private key
```

Never:

```text
JWT_SECRET=secret
```

in production.

Production secrets should be provided through secure environment configuration.

---

# 44. Database Transaction Boundaries

Transactions are particularly important for:

### Delivery

```text
Create delivery
+
Create inventory transaction
```

### Sale

```text
Create sale
+
Create inventory transaction
```

### Inventory correction

```text
Create adjustment
+
Audit action
```

### Report approval

```text
Update report
+
Audit approval
```

---

# 45. Sale Transaction Example

The backend should execute conceptually:

```text
BEGIN

1. Load branch inventory
2. Lock relevant inventory rows
3. Verify sufficient stock
4. Determine applicable fuel price
5. Calculate revenue
6. Create sale
7. Create inventory transaction
8. Create audit event

COMMIT
```

This prevents two simultaneous requests from selling the same fuel.

---

# 46. Concurrency Protection

Consider:

```text
Inventory = 5,000 L
```

Manager submits:

```text
Sale A = 4,000 L
Sale B = 3,000 L
```

Both requests arrive simultaneously.

Without proper database locking:

```text
5,000 - 4,000 - 3,000
```

could incorrectly be accepted.

The system must ensure that only valid transactions succeed.

Possible mechanisms:

- Database transactions
- Row locking
- Serializable/appropriate isolation
- Atomic inventory validation

---

# 47. Database Architecture

PostgreSQL should be the primary relational database.

Logical structure:

```text
Identity
├── users
├── roles
└── refresh_tokens

Business
├── businesses
├── branches
└── business_users

Fuel
├── fuel_types
└── fuel_prices

Supply
├── suppliers
├── tankers
├── fuel_orders
└── deliveries

Operations
├── inventory_transactions
├── sales
└── daily_reports

System
├── notifications
└── audit_logs
```

---

# 48. Important Database Principle

Avoid excessive duplication.

For example, don't store:

```text
Branch.currentStock
DailyReport.closingStock
Inventory.currentStock
```

as independent authoritative values.

Instead:

```text
Inventory Ledger
       ↓
Calculated Stock
       ↓
Daily Report
       ↓
Dashboard
```

Cached values can be added later for performance.

---

# 49. Database IDs

Use UUIDs for public-facing entity IDs.

Example:

```text
550e8400-e29b-41d4-a716-446655440000
```

This reduces predictable sequential IDs and makes enumeration harder.

However, UUIDs are not a replacement for authorization.

---

# 50. Soft Deletion

Operational records should generally not be physically deleted.

For example:

A branch that closes should become:

```text
INACTIVE
```

rather than disappearing from historical reports.

The same principle applies to:

- Users
- Tankers
- Suppliers
- Fuel types
- Branches

Financial and inventory records should generally be immutable.

---

# 51. Data Ownership Rules

Every operational resource must have an ownership path.

For example:

```text
Sale
 ↓
Branch
 ↓
Business
```

or:

```text
Delivery
 ↓
Branch
 ↓
Business
```

This makes authorization checks straightforward.

---

# 52. Authorization Helper

The backend should have reusable authorization logic such as:

```text
assertBusinessAccess(user, businessId)

assertBranchAccess(user, branchId)

assertResourceAccess(user, resource)
```

This prevents every controller from implementing authorization differently.

---

# 53. Audit Strategy

Auditing should happen at the service/business-operation level rather than relying exclusively on HTTP controllers.

Example:

```text
SalesService.recordSale()
       │
       ├── Database operation
       └── Audit operation
```

This means the action remains auditable even if the service is later called from another interface.

---

# 54. Event Architecture

The MVP does not need a message broker.

Use internal application events initially.

Example:

```text
SaleCreatedEvent
DeliveryCompletedEvent
ReportSubmittedEvent
ReportApprovedEvent
ReportRejectedEvent
LowInventoryDetectedEvent
```

These events can trigger:

- Notifications
- Audit records
- Analytics updates

Later they can be moved to Redis/RabbitMQ/Kafka if scale requires it.

---

# 55. Background Jobs

Background jobs may eventually handle:

- Notification delivery
- Report generation
- Scheduled reminders
- Daily summaries
- Low-stock checks
- Export generation

For the MVP, these can be implemented using a queue such as:

```text
BullMQ + Redis
```

only when actually needed.

---

# 56. File Storage

If the platform eventually supports:

- Delivery documents
- Invoices
- Receipts
- Supplier documents
- PDF reports

files should be stored in object storage.

Do not store large files directly inside PostgreSQL.

The database should store:

```text
fileName
fileUrl
mimeType
size
uploadedBy
createdAt
```

---

# 57. Observability

Production deployment should include:

### Logging

Structured application logs.

### Error monitoring

Capture unexpected application failures.

### Metrics

Track:

- API response time
- Error rate
- Database performance
- Queue failures

### Audit logs

Track business operations separately from technical logs.

---

# 58. Environment Configuration

Use separate configurations:

```text
.env.development
.env.test
.env.production
```

Never commit secrets.

Required configuration categories:

```text
DATABASE
JWT
REFRESH_TOKEN
FRONTEND_URL
CORS
STORAGE
EMAIL
REDIS
```

---

# 59. CORS

Only trusted frontend origins should be allowed.

Development:

```text
http://localhost:3000
```

Production:

```text
https://app.example.com
```

Do not use unrestricted:

```text
*
```

for authenticated production APIs.

---

# 60. API Documentation

Swagger/OpenAPI should document:

- Authentication
- Request bodies
- Responses
- Error responses
- Roles
- Pagination
- Query filters

The Swagger interface should be protected or disabled in production depending on deployment requirements.

---

# 61. Testing Architecture

The project should use multiple testing levels.

## Unit Tests

Test:

- Services
- Calculations
- Business rules
- Inventory logic

## Integration Tests

Test:

- Database interactions
- Transactions
- Authorization
- Inventory operations

## E2E Tests

Test:

```text
Login
 ↓
Create Branch
 ↓
Create Order
 ↓
Record Delivery
 ↓
Record Sale
 ↓
Submit Report
 ↓
Approve Report
```

---

# 62. Critical Tests

The following tests are mandatory before MVP release.

### Inventory

```text
Delivery increases inventory.
Sale decreases inventory.
```

### Overselling

```text
Sale > available stock
→ rejected
```

### Concurrent sales

```text
Two simultaneous sales
→ inventory remains correct
```

### Branch isolation

```text
Manager A
→ cannot access Branch B
```

### Business isolation

```text
Business A
→ cannot access Business B
```

### Historical price

```text
Old sale
→ retains old price
```

---

# 63. Deployment Architecture

Initial production deployment:

```text
                  INTERNET
                     │
                     ▼
              Next.js Frontend
                     │
                     │ HTTPS
                     ▼
              NestJS Backend
                     │
                     ▼
             Managed PostgreSQL
                     │
             ┌───────┴───────┐
             │               │
          Redis           Storage
       (optional)        (optional)
```

---

# 64. CI/CD

The repository should eventually have:

```text
Pull Request
     ↓
Lint
     ↓
Type Check
     ↓
Unit Tests
     ↓
Integration Tests
     ↓
Build
     ↓
Deploy
```

Production deployment should only happen after required checks pass.

---

# 65. Repository Structure

Recommended monorepo:

```text
kby-global-platform/
│
├── apps/
│   ├── backend/
│   └── frontend/
│
├── packages/
│   ├── shared-types/
│   ├── eslint-config/
│   └── tsconfig/
│
├── docs/
│   ├── 01-product-requirements.md
│   ├── 02-system-architecture.md
│   ├── 03-database-design.md
│   ├── 04-api-specification.md
│   ├── 05-ui-ux-design.md
│   └── 06-mvp-roadmap.md
│
├── .github/
│   └── workflows/
│
├── docker-compose.yml
├── README.md
└── package.json
```

---

# 66. Recommended Development Architecture

For the MVP:

```text
                    Git Repository
                         │
             ┌───────────┴───────────┐
             │                       │
         Frontend                 Backend
          Next.js                 NestJS
             │                       │
             └───────────┬───────────┘
                         │
                     PostgreSQL
```

A monorepo will make it easier to share:

- Types
- Validation schemas where appropriate
- Configuration
- Documentation
- CI/CD

---

# 67. Security Architecture Summary

Security must follow:

```text
Authentication
      ↓
Authorization
      ↓
Business Isolation
      ↓
Branch Isolation
      ↓
Resource Ownership
      ↓
Input Validation
      ↓
Database Constraints
      ↓
Audit Logging
```

Security cannot depend solely on frontend restrictions.

The backend must enforce every permission.

---

# 68. Critical Security Threats

The system should specifically defend against:

- Broken access control
- IDOR/BOLA
- Privilege escalation
- Mass assignment
- SQL injection
- JWT attacks
- Session/token theft
- Password attacks
- Rate-limit bypass
- Duplicate transactions
- Race conditions
- Inventory manipulation
- Report manipulation
- Cross-business data access
- Sensitive information leakage

---

# 69. MVP Architectural Priorities

Not every component deserves equal attention.

Priority should be:

```text
1. Inventory integrity
2. Authorization
3. Data ownership/isolation
4. Sales calculations
5. Delivery tracking
6. Daily reports
7. Auditability
8. Dashboard
9. Notifications
10. Advanced analytics
```

The first four are the most critical.

---

# 70. Architectural Decision Summary

| Decision | Choice |
|---|---|
| Frontend | Next.js |
| Backend | NestJS |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | TypeORM |
| API | REST |
| Architecture | Modular Monolith |
| Authentication | JWT |
| Authorization | RBAC + Resource/Branch Authorization |
| State Management | TanStack Query |
| UI | Tailwind + shadcn/ui |
| Charts | Recharts |
| Validation | class-validator / Zod |
| Documentation | Swagger/OpenAPI |
| Inventory | Immutable Ledger |
| IDs | UUID |
| Testing | Jest + E2E |
| Queue | Optional BullMQ/Redis |
| Storage | Object Storage |
| Deployment | Cloud-hosted |

---

# 71. Architectural Principles

The development team should follow these principles.

### Principle 1

**The backend is the authority.**

Never trust frontend calculations or permissions.

### Principle 2

**Every litre must be accountable.**

Fuel movement must be traceable.

### Principle 3

**Inventory is ledger-driven.**

Do not make manually editable stock values the source of truth.

### Principle 4

**Financial records are historical.**

Changing today's fuel price must not change yesterday's sale.

### Principle 5

**Managers are branch-scoped.**

A manager should never automatically gain access to another branch.

### Principle 6

**Business data is tenant-scoped.**

One business must never access another business's operational data.

### Principle 7

**Operational records should be auditable.**

Important actions must have a traceable actor and timestamp.

### Principle 8

**Keep the MVP simple.**

Use a modular monolith before considering microservices.

---

# 72. Primary End-to-End Architecture

The complete operational flow is:

```text
                    SUPER ADMIN
                         │
                         ▼
                    BUSINESS
                         │
                         ▼
                      BRANCH
                         │
              ┌──────────┴──────────┐
              │                     │
           MANAGER                ADMIN
              │                     │
              │              Creates Fuel Order
              │                     │
              │                     ▼
              │                  TANKER
              │                     │
              │                     ▼
              │                 DELIVERY
              │                     │
              │                     ▼
              │              INVENTORY +44,850L
              │                     │
              ▼                     │
          SALES  ───────────────────┘
              │
              │ -8,500L
              ▼
          INVENTORY
              │
              ▼
           REVENUE
              │
              ▼
       DAILY SALES REPORT
              │
              ▼
            ADMIN
              │
        ┌─────┴─────┐
        ▼           ▼
     APPROVE      REJECT
        │           │
        ▼           ▼
      AUDIT      CORRECTION
```

---

# 73. Architecture Completion Criteria

The architecture is considered ready for implementation when the development team has finalized:

1. Product requirements
2. Entity relationships
3. Database schema
4. API contracts
5. Authentication flow
6. Authorization rules
7. Inventory transaction model
8. Sales transaction model
9. Daily report workflow
10. Frontend navigation
11. Deployment strategy
12. Testing strategy

The next required document is:

**`03-database-design.md`**

This document should convert the architecture into the actual PostgreSQL schema, including:

- Complete entities
- Columns
- Data types
- Primary keys
- Foreign keys
- Relationships
- Indexes
- Unique constraints
- Enums
- Inventory ledger design
- Transaction rules
- Multi-tenant constraints
- Audit structure
- Entity relationship diagram

It should be finalized before implementation begins.