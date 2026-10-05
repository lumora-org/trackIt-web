# 07 — Users and Business Management

## 1. Purpose

This document defines how the K.B.Y GLOBAL INVESTMENT platform manages:

- Businesses
- Branches
- Users
- User roles
- Manager branch assignments
- Account status
- Administrative user management
- Business isolation
- Branch isolation
- User lifecycle
- Related audit requirements

This module builds directly on the authentication and authorization architecture defined in `06-authentication-and-authorization.md`.

The key principle is:

> Authentication identifies the user. User and business management determines the user's organizational scope.

---

# 2. Organizational Model

The MVP uses the following hierarchy:

```text
Platform
   │
   ├── SUPER_ADMIN
   │
   └── Businesses
          │
          ├── ADMIN
          │
          └── Branches
                 │
                 └── MANAGER
```

For K.B.Y GLOBAL INVESTMENT:

```text
K.B.Y GLOBAL INVESTMENT
│
├── ADMIN
│
├── KBY-IKEJA
│    └── MANAGER
│
├── KBY-YABA
│    └── MANAGER
│
└── KBY-LEKKI
     └── MANAGER
```

A business can have multiple branches.

A business can have multiple managers.

A manager belongs to one branch in the MVP.

---

# 3. Core Entities

The main entities are:

```text
Business
   │
   ├── Users
   │
   └── Branches
          │
          └── Managers
```

Database tables:

```text
businesses
branches
users
```

Authentication-related tables remain:

```text
refresh_tokens
password_reset_tokens
```

---

# 4. Business Entity

The `businesses` table represents a tenant/customer using the platform.

Recommended fields:

```text
id
name
registration_number
email
phone
address
status
created_at
updated_at
deleted_at
```

Example:

```text
K.B.Y GLOBAL INVESTMENT
```

---

# 5. Business Status

Business status:

```text
ACTIVE
INACTIVE
SUSPENDED
```

Meaning:

### ACTIVE

The business can use the platform normally.

### INACTIVE

The business has been disabled administratively.

### SUSPENDED

The business has been explicitly blocked from normal operations.

A suspended business should not allow normal users to authenticate or perform business operations.

---

# 6. Business Ownership

Every business-owned record must contain:

```text
business_id
```

Examples:

```text
branches.business_id
users.business_id
fuel_types.business_id
fuel_prices.business_id
suppliers.business_id
tankers.business_id
fuel_orders.business_id
deliveries.business_id
inventory_transactions.business_id
sales.business_id
daily_reports.business_id
```

This creates the primary tenant boundary.

---

# 7. Creating a Business

Only a `SUPER_ADMIN` should create businesses in the MVP.

Endpoint:

```http
POST /api/v1/businesses
```

Example request:

```json
{
  "name": "K.B.Y GLOBAL INVESTMENT",
  "registrationNumber": "RC1234567",
  "email": "admin@kbyglobal.com",
  "phone": "08000000000",
  "address": "Lagos, Nigeria"
}
```

The backend generates:

```text
id
created_at
updated_at
status
```

The client must not provide:

```text
id
status
created_at
updated_at
deleted_at
```

unless the endpoint specifically supports those operations.

---

# 8. Business Creation Flow

```text
SUPER_ADMIN
     │
     ▼
Create Business
     │
     ▼
Validate unique business information
     │
     ▼
Create business
     │
     ▼
Audit event
     │
     ▼
Return business
```

Business creation should be transactional if it also creates the initial administrator.

---

# 9. Creating the Initial ADMIN

A useful onboarding flow is:

```text
Create Business
      +
Create Initial ADMIN
```

Example:

```http
POST /api/v1/businesses
```

Request:

```json
{
  "name": "K.B.Y GLOBAL INVESTMENT",
  "registrationNumber": "RC1234567",
  "email": "admin@kbyglobal.com",
  "phone": "08000000000",
  "address": "Lagos, Nigeria",
  "admin": {
    "firstName": "KBY",
    "lastName": "Admin",
    "email": "admin@kbyglobal.com",
    "phone": "08000000000"
  }
}
```

The backend should:

```text
BEGIN
  Create business
  Create ADMIN
  Assign ADMIN.business_id
COMMIT
```

The password should preferably be established through an invitation/password-setup flow rather than transmitting a permanent password in the business creation request.

---

# 10. Business Isolation

An `ADMIN` can only access:

```text
user.business_id = admin.business_id
```

Example:

```text
Business A
    ADMIN A
       ↓
Business A resources only
```

The following must fail:

```text
ADMIN A
   ↓
Business B branch
```

This rule applies to every business-owned endpoint.

---

# 11. Business API

Recommended endpoints:

```text
GET    /api/v1/businesses
POST   /api/v1/businesses
GET    /api/v1/businesses/:id
PATCH  /api/v1/businesses/:id
PATCH  /api/v1/businesses/:id/status
```

Deletion should not be exposed as a normal hard-delete endpoint.

Use deactivation/soft deletion where appropriate.

---

# 12. SUPER_ADMIN Business Access

`SUPER_ADMIN` can:

```text
List businesses
Create businesses
View businesses
Update businesses
Suspend businesses
Activate businesses
```

Every action should be audited.

Example audit:

```json
{
  "action": "BUSINESS_SUSPENDED",
  "resourceType": "BUSINESS",
  "resourceId": "business-uuid"
}
```

---

# 13. ADMIN Business Access

An `ADMIN` can view and manage their own business.

Example:

```http
GET /api/v1/businesses/me
```

This endpoint is preferable to making the client repeatedly provide a business ID.

The backend derives:

```typescript
businessId = user.businessId;
```

---

# 14. Business Profile Endpoint

Recommended:

```http
GET /api/v1/businesses/me
PATCH /api/v1/businesses/me
```

Example response:

```json
{
  "id": "business-uuid",
  "name": "K.B.Y GLOBAL INVESTMENT",
  "registrationNumber": "RC1234567",
  "email": "admin@kbyglobal.com",
  "phone": "08000000000",
  "address": "Lagos, Nigeria",
  "status": "ACTIVE"
}
```

---

# 15. Business Update Rules

An ADMIN can update business profile information.

However, sensitive administrative properties should remain protected.

For example, an ADMIN should not arbitrarily change:

```text
business.id
business.status = SUSPENDED
business.created_at
business.deleted_at
```

Status management should have its own endpoint.

---

# 16. Branch Entity

Branches represent physical fuel stations.

Recommended fields:

```text
id
business_id
name
code
address
phone
status
created_at
updated_at
deleted_at
```

Example:

```text
KBY-IKEJA
KBY-YABA
KBY-LEKKI
```

---

# 17. Branch Code

Branch codes must be unique within a business.

Constraint:

```sql
UNIQUE (business_id, code)
```

Therefore:

```text
Business A
  KBY-IKEJA

Business B
  KBY-IKEJA
```

is valid.

But:

```text
Business A
  KBY-IKEJA
  KBY-IKEJA
```

is invalid.

---

# 18. Creating a Branch

Endpoint:

```http
POST /api/v1/branches
```

Request:

```json
{
  "name": "KBY Ikeja",
  "code": "KBY-IKEJA",
  "address": "Ikeja, Lagos",
  "phone": "08000000001"
}
```

The backend derives:

```text
business_id
```

from the authenticated ADMIN.

The client should not control it.

---

# 19. Branch Creation Authorization

Allowed:

```text
SUPER_ADMIN → any business
ADMIN       → own business
MANAGER     → no
```

For a normal ADMIN:

```typescript
businessId = user.businessId;
```

For SUPER_ADMIN:

```text
target business must be explicit
```

---

# 20. Branch API

Recommended:

```text
GET    /api/v1/branches
POST   /api/v1/branches
GET    /api/v1/branches/:id
PATCH  /api/v1/branches/:id
PATCH  /api/v1/branches/:id/status
```

For an ADMIN:

```http
GET /api/v1/branches
```

must only return branches belonging to their business.

---

# 21. Manager Branch Isolation

A manager's branch is authoritative.

Example:

```text
Manager A
business_id = Business A
branch_id   = Branch A
```

When querying sales:

```sql
WHERE
  business_id = Business A
  AND branch_id = Branch A
```

Never trust:

```json
{
  "branchId": "Branch B"
}
```

from a manager.

---

# 22. User Entity

The `users` table contains:

```text
id
business_id
branch_id
first_name
last_name
email
phone
password_hash
role
status
last_login_at
created_at
updated_at
deleted_at
```

---

# 23. User Scope Rules

The following invariants must always hold.

### SUPER_ADMIN

```text
role = SUPER_ADMIN
business_id = NULL
branch_id = NULL
```

### ADMIN

```text
role = ADMIN
business_id != NULL
branch_id = NULL
```

### MANAGER

```text
role = MANAGER
business_id != NULL
branch_id != NULL
```

These are not merely frontend conventions.

They are domain rules.

---

# 24. User Creation

Recommended endpoint:

```http
POST /api/v1/users
```

An ADMIN can create:

```text
MANAGER
```

within their business.

A SUPER_ADMIN can create:

```text
ADMIN
MANAGER
```

subject to explicit target-business selection.

---

# 25. Creating a Manager

Example:

```json
{
  "firstName": "John",
  "lastName": "Manager",
  "email": "john.manager@example.com",
  "phone": "08000000002",
  "role": "MANAGER",
  "branchId": "branch-uuid"
}
```

The backend must verify:

```text
branch exists
branch is active
branch belongs to authenticated ADMIN's business
```

Then:

```text
user.business_id = admin.business_id
user.branch_id = requested branch
```

---

# 26. Never Trust `businessId` During User Creation

Do not accept:

```json
{
  "businessId": "another-business"
}
```

as authoritative for an ADMIN.

Instead:

```text
Authenticated ADMIN
       ↓
user.business_id
       ↓
New Manager
```

This prevents cross-tenant user creation.

---

# 27. Creating an ADMIN

Only `SUPER_ADMIN` should create another ADMIN.

Example:

```json
{
  "firstName": "Business",
  "lastName": "Admin",
  "email": "admin@business.com",
  "role": "ADMIN",
  "businessId": "business-uuid"
}
```

The backend verifies:

```text
SUPER_ADMIN
     ↓
Target business exists
     ↓
Target business active
     ↓
Create ADMIN
```

The new ADMIN receives:

```text
business_id = target business
branch_id = NULL
```

---

# 28. Manager Invitation Flow

For production, managers should preferably be invited rather than assigned a permanent password by an administrator.

Recommended future flow:

```text
ADMIN
  │
  ▼
Create Manager
  │
  ▼
Invitation Token
  │
  ▼
Email
  │
  ▼
Manager opens invitation
  │
  ▼
Sets password
  │
  ▼
Account activated
```

The invitation token should be:

```text
random
short-lived
single-use
hashed in database
```

This can reuse the same secure token pattern used for password reset.

---

# 29. User List

Endpoint:

```http
GET /api/v1/users
```

For ADMIN:

```text
Only users belonging to their business.
```

For MANAGER:

```text
Usually no general user-management access.
```

For SUPER_ADMIN:

```text
Platform-wide users, subject to administrative controls.
```

---

# 30. User Filtering

The user-list endpoint should support filters.

Example:

```http
GET /api/v1/users?role=MANAGER&status=ACTIVE
```

Potential filters:

```text
role
status
branchId
search
```

Pagination should be mandatory for potentially large result sets.

Example:

```http
GET /api/v1/users?page=1&limit=20
```

---

# 31. User Search

Search should support:

```text
first name
last name
email
phone
```

Example:

```http
GET /api/v1/users?search=john
```

The backend should use parameterized queries.

Never construct raw SQL by concatenating search input.

---

# 32. User Profile

Endpoint:

```http
GET /api/v1/users/me
```

This returns the authenticated user's profile.

Example:

```json
{
  "id": "user-uuid",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "08000000000",
  "role": "MANAGER",
  "businessId": "business-uuid",
  "branchId": "branch-uuid",
  "status": "ACTIVE"
}
```

Never expose:

```text
password_hash
refresh token information
password-reset token
internal security metadata
```

---

# 33. Updating User Profile

Users should be able to update ordinary profile information.

Example:

```http
PATCH /api/v1/users/me
```

Allowed fields:

```text
firstName
lastName
phone
```

Potentially:

```text
profile image
```

later.

Not allowed through this endpoint:

```text
role
businessId
branchId
status
password_hash
```

Password has its own endpoint.

---

# 34. Separate Administrative User Updates

Administrative changes should use explicit endpoints.

Examples:

```text
PATCH /users/:id/role
PATCH /users/:id/status
PATCH /users/:id/branch
```

This makes security rules much clearer.

Avoid a generic endpoint such as:

```text
PATCH /users/:id
```

that accepts every possible property.

---

# 35. Changing a User's Role

Endpoint:

```http
PATCH /api/v1/users/:id/role
```

Request:

```json
{
  "role": "MANAGER"
}
```

The service must validate the complete resulting state.

For example, changing:

```text
ADMIN → MANAGER
```

requires a branch assignment.

The operation should not produce:

```text
MANAGER
business_id = Business A
branch_id = NULL
```

---

# 36. Changing Manager Branch

Endpoint:

```http
PATCH /api/v1/users/:id/branch
```

Request:

```json
{
  "branchId": "new-branch-uuid"
}
```

Before changing:

```text
Verify target branch exists
Verify target branch belongs to user's business
Verify target branch is active
Verify actor has permission
```

Then update the manager.

---

# 37. Manager Branch Transfer

A manager moving from:

```text
KBY-IKEJA
```

to:

```text
KBY-YABA
```

should be treated as an important operational event.

Audit:

```text
MANAGER_BRANCH_CHANGED
```

Example metadata:

```json
{
  "previousBranchId": "ikeja-uuid",
  "newBranchId": "yaba-uuid"
}
```

Historical sales and reports remain associated with their original branch.

Changing a manager's current branch must never rewrite historical records.

---

# 38. Account Status Management

Endpoint:

```http
PATCH /api/v1/users/:id/status
```

Request:

```json
{
  "status": "SUSPENDED"
}
```

Possible states:

```text
ACTIVE
INACTIVE
SUSPENDED
```

---

# 39. Suspending a User

When an administrator suspends a user:

```text
1. Update account status
2. Revoke refresh tokens
3. Audit action
```

Existing access tokens may remain valid until expiry unless a token-revocation mechanism is introduced.

Because access tokens are short-lived, this window should remain small.

---

# 40. Activating a User

Example:

```http
PATCH /api/v1/users/:id/status
```

```json
{
  "status": "ACTIVE"
}
```

The user can authenticate again after activation.

---

# 41. User Deactivation vs Deletion

Do not hard-delete users that have operational history.

A manager may have created:

```text
sales
daily_reports
deliveries
audit_logs
```

Deleting the user would damage historical relationships.

Instead:

```text
status = INACTIVE
```

or:

```text
deleted_at = timestamp
```

depending on the specific business requirement.

---

# 42. Historical User References

Operational tables should retain references to the user who performed an action.

Examples:

```text
sales.recorded_by
deliveries.received_by
daily_reports.submitted_by
daily_reports.reviewed_by
audit_logs.user_id
```

If the user is later deactivated, historical records remain intact.

---

# 43. Branch Deactivation

Branches should not normally be deleted.

Instead:

```text
status = INACTIVE
```

An inactive branch:

```text
cannot receive new normal deliveries
cannot record new sales
cannot accept new managers
```

Historical data remains accessible to authorized administrators.

---

# 44. What Happens to a Manager When a Branch Is Deactivated?

The system must prevent an active manager from remaining assigned to an inactive branch.

Recommended process:

```text
Deactivate Branch
       ↓
Check active managers
       ↓
If managers exist:
       ↓
Require reassignment or deactivation
```

Do not silently move the manager to another branch.

The administrator must explicitly decide.

---

# 45. Business Suspension

When a business is suspended:

```text
Business
   ↓
SUSPENDED
```

The platform should prevent normal business operations.

Recommended:

```text
ADMIN login → denied
MANAGER login → denied
SUPER_ADMIN → still able to administer business
```

Operational records remain intact.

---

# 46. Business Deactivation

For a business that is no longer active:

```text
status = INACTIVE
```

Historical records remain available according to retention policies.

The system should not delete:

```text
sales
deliveries
inventory transactions
daily reports
audit logs
```

just because a business becomes inactive.

---

# 47. Business Deletion

Hard deletion should generally not be supported in the normal application UI.

The data is operational and financially relevant.

If a true deletion process is ever required, it should be:

```text
explicit
restricted
audited
transactional
policy-driven
```

and likely handled as a controlled administrative/data-retention operation rather than a normal API endpoint.

---

# 48. Branch Access Guard

A reusable branch authorization mechanism should be available.

Conceptually:

```typescript
BranchAccessGuard
```

It verifies:

```text
authenticated user
        ↓
target branch
        ↓
business relationship
        ↓
manager branch relationship
```

However, the service layer must still enforce resource-level authorization.

A guard should not become the only authorization mechanism.

---

# 49. Business Access Guard

Similarly:

```typescript
BusinessAccessGuard
```

can provide reusable protection for endpoints where a business ID is explicitly part of the route.

For example:

```http
GET /api/v1/businesses/:businessId/branches
```

The guard verifies whether the current user can access the requested business.

---

# 50. Tenant-Safe Repository Queries

Every business-scoped repository method should make scope explicit.

Good:

```typescript
findById(
  businessId: string,
  id: string,
)
```

Then:

```typescript
return repository.findOne({
  where: {
    id,
    businessId,
  },
});
```

Less safe:

```typescript
findById(id: string)
```

because callers may forget to apply tenant filtering.

---

# 51. Service Method Design

Recommended:

```typescript
branchesService.findOne(
  user,
  branchId,
);
```

instead of:

```typescript
branchesService.findOne(branchId);
```

The service needs authorization context.

Similarly:

```typescript
salesService.findOne(user, saleId);
inventoryService.getBalance(user, branchId, fuelTypeId);
dailyReportsService.submit(user, reportId);
```

This reduces the chance of authorization being skipped.

---

# 52. User Creation Transaction

Creating a user should be transactional when multiple records are involved.

Example invitation workflow:

```text
BEGIN
  Create user
  Create invitation token
  Audit
COMMIT

Send email
```

The email should preferably be sent after the database transaction succeeds.

If email delivery fails, the user can be resent an invitation without corrupting the user record.

---

# 53. Unique Email

User emails should be globally unique across the platform.

Recommended:

```sql
UNIQUE (LOWER(email))
```

Therefore:

```text
admin@example.com
ADMIN@EXAMPLE.COM
```

cannot represent two separate accounts.

This simplifies authentication.

---

# 54. Branch Code Uniqueness

Branch codes are business-scoped.

Constraint:

```sql
UNIQUE (business_id, code)
```

This allows:

```text
Business A → KBY-IKEJA
Business B → KBY-IKEJA
```

while preventing duplicates within the same business.

---

# 55. Business Registration Number

If a registration number is collected, it should be unique where the business rules require it.

Example:

```text
registration_number
```

could have:

```sql
UNIQUE
```

if every registered business must have a unique registration number.

For the MVP, this can remain nullable if the platform may support businesses without a registration number.

---

# 56. User Management Permissions

Recommended MVP rules:

| Action | SUPER_ADMIN | ADMIN | MANAGER |
|---|---:|---:|---:|
| Create business | ✅ | ❌ | ❌ |
| View all businesses | ✅ | ❌ | ❌ |
| Update any business | ✅ | ❌ | ❌ |
| View own business | ✅ | ✅ | Limited |
| Update own business | ✅ | ✅ | ❌ |
| Create branch | ✅ | ✅ | ❌ |
| Update branch | ✅ | ✅ | ❌ |
| Deactivate branch | ✅ | ✅ | ❌ |
| Create ADMIN | ✅ | ❌ | ❌ |
| Create MANAGER | ✅ | ✅ | ❌ |
| View business users | ✅ | ✅ | ❌ |
| Update user role | ✅ | Limited | ❌ |
| Change manager branch | ✅ | ✅ | ❌ |
| Suspend user | ✅ | ✅ | ❌ |
| Activate user | ✅ | ✅ | ❌ |
| Update own profile | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |

---

# 57. ADMIN Cannot Create Another ADMIN

For the MVP:

```text
ADMIN
  └── MANAGER
```

not:

```text
ADMIN
  └── ADMIN
```

This prevents accidental administrative privilege proliferation.

If the business later needs multiple administrators, the policy can be changed.

---

# 58. Manager Permissions

Managers should be operational users.

They can perform branch operations but should not control organizational configuration.

Manager responsibilities include:

```text
Record sales
View inventory
Receive permitted deliveries
Submit daily reports
View branch history
Update own profile
Change own password
```

Managers should not:

```text
Create users
Change roles
Change branch assignment
Change fuel prices
Create suppliers
Create tankers
Create businesses
Approve reports
```

---

# 59. Audit Requirements

The following must be audited.

### Business

```text
BUSINESS_CREATED
BUSINESS_UPDATED
BUSINESS_ACTIVATED
BUSINESS_SUSPENDED
```

### Branch

```text
BRANCH_CREATED
BRANCH_UPDATED
BRANCH_ACTIVATED
BRANCH_DEACTIVATED
```

### Users

```text
USER_CREATED
USER_UPDATED
USER_ACTIVATED
USER_DEACTIVATED
USER_SUSPENDED
USER_ROLE_CHANGED
USER_BRANCH_CHANGED
```

### Authentication

```text
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
PASSWORD_CHANGED
PASSWORD_RESET
```

---

# 60. Audit Example

Manager reassignment:

```json
{
  "action": "USER_BRANCH_CHANGED",
  "resourceType": "USER",
  "resourceId": "manager-uuid",
  "oldValues": {
    "branchId": "ikeja-uuid"
  },
  "newValues": {
    "branchId": "yaba-uuid"
  }
}
```

This makes administrative changes traceable.

---

# 61. API Design

## Business

```text
GET    /api/v1/businesses
POST   /api/v1/businesses
GET    /api/v1/businesses/:id
PATCH  /api/v1/businesses/:id
PATCH  /api/v1/businesses/:id/status
GET    /api/v1/businesses/me
PATCH  /api/v1/businesses/me
```

## Branch

```text
GET    /api/v1/branches
POST   /api/v1/branches
GET    /api/v1/branches/:id
PATCH  /api/v1/branches/:id
PATCH  /api/v1/branches/:id/status
```

## Users

```text
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
PATCH  /api/v1/users/:id/status
PATCH  /api/v1/users/:id/role
PATCH  /api/v1/users/:id/branch
```

---

# 62. Recommended DTO Structure

Business:

```text
CreateBusinessDto
UpdateBusinessDto
UpdateBusinessStatusDto
```

Branch:

```text
CreateBranchDto
UpdateBranchDto
UpdateBranchStatusDto
```

User:

```text
CreateUserDto
UpdateMyProfileDto
UpdateUserDto
UpdateUserRoleDto
UpdateUserBranchDto
UpdateUserStatusDto
```

Do not create one giant DTO containing every possible property.

---

# 63. Recommended Module Structure

```text
src/
├── businesses/
│   ├── businesses.module.ts
│   ├── businesses.controller.ts
│   ├── businesses.service.ts
│   ├── businesses.repository.ts
│   ├── entities/
│   │   └── business.entity.ts
│   └── dto/
│       ├── create-business.dto.ts
│       ├── update-business.dto.ts
│       └── update-business-status.dto.ts
│
├── branches/
│   ├── branches.module.ts
│   ├── branches.controller.ts
│   ├── branches.service.ts
│   ├── branches.repository.ts
│   ├── entities/
│   │   └── branch.entity.ts
│   └── dto/
│       ├── create-branch.dto.ts
│       ├── update-branch.dto.ts
│       └── update-branch-status.dto.ts
│
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.service.ts
    ├── users.repository.ts
    ├── entities/
    │   └── user.entity.ts
    └── dto/
        ├── create-user.dto.ts
        ├── update-user.dto.ts
        ├── update-my-profile.dto.ts
        ├── update-user-role.dto.ts
        ├── update-user-branch.dto.ts
        └── update-user-status.dto.ts
```

---

# 64. Important Service Boundaries

`UsersService` owns:

```text
User CRUD
User status
Role changes
Branch assignment
User profile
```

`BusinessesService` owns:

```text
Business CRUD
Business status
Business profile
```

`BranchesService` owns:

```text
Branch CRUD
Branch status
Branch validation
```

`AuthService` owns:

```text
Login
Logout
Refresh
Password changes
Password reset
Authentication
```

Do not put all of these into one giant service.

---

# 65. Cross-Module Rules

The modules depend on one another in controlled ways.

```text
Auth
  ↓
Users
  ↓
Businesses / Branches
```

Operational modules later depend on:

```text
Users
Businesses
Branches
```

For example:

```text
SalesService
   ↓
AuthenticatedUser
   ↓
businessId
branchId
```

This allows operational modules to enforce scope consistently.

---

# 66. Important Database Constraints

Recommended constraints include:

```sql
CHECK (
  (role = 'SUPER_ADMIN' AND business_id IS NULL AND branch_id IS NULL)
  OR
  (role = 'ADMIN' AND business_id IS NOT NULL AND branch_id IS NULL)
  OR
  (role = 'MANAGER' AND business_id IS NOT NULL AND branch_id IS NOT NULL)
)
```

However, the manager/branch/business relationship also requires validating that the branch belongs to the same business.

That relationship should be enforced through application logic and appropriate database design.

---

# 67. Manager Business/Branch Consistency

The most important invariant is:

```text
users.business_id
       =
branches.business_id
```

when:

```text
users.role = MANAGER
```

The system must never allow:

```text
Manager
business_id = Business A
branch_id = Branch belonging to Business B
```

A manager assignment operation must always verify this.

---

# 68. User Lifecycle

A typical manager lifecycle:

```text
INVITED
   ↓
ACTIVE
   ↓
SUSPENDED
   ↓
ACTIVE
   ↓
INACTIVE
```

The database currently uses:

```text
ACTIVE
INACTIVE
SUSPENDED
```

Invitation state can be represented separately if the invitation workflow is implemented.

---

# 69. Recommended Future Enhancement: Invitations

The MVP can initially create users administratively.

A stronger production workflow should introduce:

```text
user_invitations
```

with:

```text
id
business_id
branch_id
email
role
token_hash
expires_at
accepted_at
created_by
created_at
```

This avoids administrators handling passwords.

---

# 70. Recommended Future Enhancement: Multiple Managers

The MVP assumes:

```text
one manager → one branch
```

but the database should not prevent:

```text
branch → multiple managers
```

The existing design already supports this because multiple users can have the same:

```text
business_id
branch_id
role = MANAGER
```

Therefore:

```text
KBY-IKEJA
├── Manager A
└── Manager B
```

is possible without changing the schema.

---

# 71. Recommended Future Enhancement: Multiple ADMINs

The current business rule recommends one primary ADMIN initially.

If the business later needs multiple administrators, the schema already supports:

```text
Business A
├── Admin A
├── Admin B
└── Admin C
```

because multiple users can share:

```text
business_id
role = ADMIN
branch_id = NULL
```

Only the authorization policy would need to change.

---

# 72. Security Checklist

Before considering this module complete:

```text
[ ] Business isolation enforced
[ ] Branch isolation enforced
[ ] Role checks enforced
[ ] Manager branch assignment validated
[ ] Business ID never trusted from manager request
[ ] Branch ID never trusted from manager request
[ ] Role cannot be changed through profile endpoint
[ ] Status cannot be changed through profile endpoint
[ ] Password hash never returned
[ ] Users are not hard-deleted casually
[ ] Branches are not hard-deleted casually
[ ] Business suspension revokes normal access
[ ] User suspension revokes refresh sessions
[ ] Administrative actions audited
[ ] Role changes audited
[ ] Branch changes audited
[ ] Pagination implemented
[ ] Search uses parameterized queries
[ ] DTOs use whitelist validation
```

---

# 73. E2E Test Scenarios

## Business isolation

```text
Create Business A
Create Business B

Create ADMIN A
Create ADMIN B

ADMIN A requests Business B
→ 403 or 404
```

## Branch isolation

```text
Business A
├── Branch A
└── Branch B

Manager A → Branch A

Manager A requests Branch B
→ denied
```

## Manager creation

```text
ADMIN A
   ↓
Create manager
   ↓
Branch A
   ↓
Success
```

Attempt:

```text
ADMIN A
   ↓
Create manager
   ↓
Branch B belonging to Business B
   ↓
Denied
```

## Privilege escalation

```text
MANAGER
   ↓
PATCH /users/me
{
  "role": "ADMIN"
}
   ↓
Denied
```

## Role consistency

Attempt:

```text
ADMIN
   ↓
Change role to MANAGER
   ↓
branchId missing
   ↓
Denied
```

---

# 74. Example Operational Scenario

Suppose K.B.Y GLOBAL INVESTMENT has:

```text
Business:
K.B.Y GLOBAL INVESTMENT

Branches:
KBY-IKEJA
KBY-YABA
KBY-LEKKI
```

Users:

```text
SUPER_ADMIN
Platform Operator

ADMIN
KBY Business Administrator

MANAGER
Ikeja Manager

MANAGER
Yaba Manager

MANAGER
Lekki Manager
```

The database relationship becomes:

```text
K.B.Y GLOBAL INVESTMENT
│
├── ADMIN
│
├── KBY-IKEJA
│    └── Manager
│
├── KBY-YABA
│    └── Manager
│
└── KBY-LEKKI
     └── Manager
```

A sale created by the Ikeja manager automatically belongs to:

```text
business_id = KBY
branch_id   = KBY-IKEJA
recorded_by = Ikeja Manager
```

The manager does not need to supply these authoritative values.

---

# 75. Final Design Decision

The MVP will use:

```text
Business
    │
    ├── ADMIN users
    │
    └── Branches
          │
          └── MANAGER users
```

with:

```text
SUPER_ADMIN
    ↓
Platform-wide authority

ADMIN
    ↓
Business-wide authority

MANAGER
    ↓
Branch-level operational authority
```

The most important architectural rule is:

> **Users inherit organizational scope from their authenticated identity. Clients do not get to choose their business or branch.**

This protects the platform from one of the most dangerous classes of multi-tenant application vulnerabilities: cross-business and cross-branch data access.

---

# 76. Module Completion Criteria

The Users and Business Management module is considered complete when:

```text
[ ] Businesses can be created
[ ] Businesses can be activated/deactivated/suspended
[ ] Branches can be created
[ ] Branches are business-scoped
[ ] Users can be created
[ ] ADMIN users are business-scoped
[ ] MANAGER users are branch-scoped
[ ] User roles are validated
[ ] Manager branch assignment is validated
[ ] User status is manageable
[ ] Business profile can be managed
[ ] Branch profile can be managed
[ ] Users can manage their own profile
[ ] Users can change passwords
[ ] Administrative changes are audited
[ ] Tenant isolation is tested
[ ] Branch isolation is tested
[ ] Privilege escalation is tested
[ ] DTO validation is implemented
[ ] Pagination is implemented
[ ] API documentation is implemented
```

---

## Final Principle

The organizational model of K.B.Y GLOBAL INVESTMENT is intentionally simple:

```text
                PLATFORM
                   │
             SUPER_ADMIN
                   │
          ┌────────┴────────┐
          │                 │
      BUSINESS A        BUSINESS B
          │
       ADMIN
          │
     ┌────┼────┐
     │    │    │
  BRANCH BRANCH BRANCH
     │    │    │
  MANAGER MANAGER MANAGER
```

This gives the MVP a clean security boundary without introducing unnecessary complexity.

The next business modules can now safely build on this foundation.