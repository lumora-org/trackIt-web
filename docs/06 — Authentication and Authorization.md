# 06 — Authentication and Authorization

## 1. Purpose

This document defines the authentication and authorization architecture for the **K.B.Y GLOBAL INVESTMENT Fuel Station Management Platform**.

The system must ensure that:

- Only authenticated users can access protected resources.
- Users can only perform actions allowed by their role.
- `ADMIN` users can only access their own business.
- `MANAGER` users can only access their assigned branch.
- `SUPER_ADMIN` users can manage platform-level operations.
- Authentication tokens cannot be used to bypass tenant or branch restrictions.
- Sensitive authentication data is securely stored.
- Important authentication and authorization events are auditable.

The authorization model is based on four layers:

```text
Authentication
      ↓
Role Authorization
      ↓
Business/Tenant Authorization
      ↓
Branch/Resource Authorization
```

A user passing one layer does not automatically pass the others.

---

# 2. User Roles

The platform has three primary roles.

| Role | Scope | Purpose |
|---|---|---|
| `SUPER_ADMIN` | Platform | Platform administration |
| `ADMIN` | Business | Business owner/operator |
| `MANAGER` | Branch | Branch-level operations |

## 2.1 SUPER_ADMIN

The `SUPER_ADMIN` represents the platform operator.

A `SUPER_ADMIN`:

- manages businesses
- manages platform users
- can inspect business data when explicitly authorized
- can create/manage business administrators
- can assist with platform-level administration
- can access platform-wide operational information

A `SUPER_ADMIN` is not automatically treated as an employee of a business.

Therefore:

```text
business_id = NULL
branch_id   = NULL
```

for a normal `SUPER_ADMIN`.

Every cross-business administrative action should be audited.

---

# 3. ADMIN

An `ADMIN` belongs to exactly one business.

Example:

```text
User
├── role: ADMIN
├── business_id: KBY
└── branch_id: NULL
```

An `ADMIN` can:

- manage branches
- manage managers
- manage fuel types
- manage fuel prices
- manage suppliers
- manage tankers
- create fuel orders
- monitor deliveries
- view inventory
- view sales
- review daily reports
- approve/reject reports
- view dashboards
- generate reports

An `ADMIN` must never access another business's data.

---

# 4. MANAGER

A `MANAGER` belongs to exactly one business and one branch.

Example:

```text
User
├── role: MANAGER
├── business_id: KBY
└── branch_id: KBY-IKEJA
```

A manager can:

- view their branch inventory
- record sales
- view branch sales
- receive/confirm deliveries when permitted
- submit daily reports
- view branch operational information

A manager must not:

- access another branch
- access another business
- create another administrator
- change system roles
- modify fuel prices
- approve their own daily report
- access platform administration

---

# 5. User Scope Rules

The following rules are mandatory.

### SUPER_ADMIN

```text
business_id = NULL
branch_id = NULL
```

### ADMIN

```text
business_id != NULL
branch_id = NULL
```

### MANAGER

```text
business_id != NULL
branch_id != NULL
```

These rules should be enforced at both the application and database levels where practical.

---

# 6. Authentication Architecture

Authentication uses:

```text
JWT Access Token
+
Refresh Token
```

The access token is short-lived.

The refresh token is long-lived and stored securely.

Recommended flow:

```text
Login
  ↓
Validate credentials
  ↓
Generate access token
  ↓
Generate refresh token
  ↓
Hash refresh token
  ↓
Store hash in database
  ↓
Return tokens
```

---

# 7. Access Token

The access token is a JWT.

Recommended lifetime:

```text
15 minutes
```

This can be configured through environment variables.

Example:

```env
JWT_ACCESS_EXPIRES_IN=15m
```

The access token is used for normal API requests.

Example:

```http
Authorization: Bearer <access-token>
```

---

# 8. JWT Payload

The JWT payload should contain only information needed for authorization.

Recommended payload:

```typescript
export interface JwtPayload {
  sub: string;
  role: UserRole;
  businessId: string | null;
  branchId: string | null;
}
```

Example ADMIN:

```json
{
  "sub": "user-uuid",
  "role": "ADMIN",
  "businessId": "business-uuid",
  "branchId": null
}
```

Example MANAGER:

```json
{
  "sub": "user-uuid",
  "role": "MANAGER",
  "businessId": "business-uuid",
  "branchId": "branch-uuid"
}
```

Do not put sensitive information inside the JWT.

Never include:

```text
password
password_hash
refresh_token
financial secrets
security answers
private credentials
```

---

# 9. Refresh Tokens

Access tokens should expire quickly.

Refresh tokens allow the user to obtain a new access token without logging in again.

Recommended lifetime:

```text
7–30 days
```

The exact value should be configurable.

Example:

```env
JWT_REFRESH_EXPIRES_IN=30d
```

## 9.1 Never Store Raw Refresh Tokens

The database must never store the raw refresh token.

Instead:

```text
Raw refresh token
       ↓
Hash
       ↓
Database
```

The client receives:

```text
raw refresh token
```

The database stores:

```text
hashed refresh token
```

---

# 10. Refresh Token Table

The `refresh_tokens` table should contain approximately:

```text
id
user_id
token_hash
expires_at
revoked_at
created_at
last_used_at
```

Recommended additional fields:

```text
ip_address
user_agent
device_name
```

These fields help with security auditing and session management.

---

# 11. Login Flow

Endpoint:

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Flow:

```text
1. Validate request DTO
2. Normalize email
3. Find user
4. Check account status
5. Verify password
6. Create access token
7. Create refresh token
8. Hash refresh token
9. Save refresh-token record
10. Update last_login_at
11. Write audit event
12. Return authentication response
```

---

# 12. Login Response

Example:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "user-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "admin@example.com",
    "role": "ADMIN",
    "businessId": "business-uuid",
    "branchId": null
  }
}
```

The API should not return:

```text
password_hash
refresh token hash
internal security fields
```

---

# 13. Password Hashing

Passwords must never be stored as plaintext.

Recommended hashing algorithm:

```text
Argon2id
```

`bcrypt` is acceptable if Argon2 is not used.

Example architecture:

```text
User password
      ↓
Argon2id
      ↓
password_hash
```

During login:

```text
Submitted password
      ↓
Verify against password_hash
      ↓
Success / failure
```

Never decrypt passwords because passwords should not be encrypted.

They should be hashed.

---

# 14. Logout

Endpoint:

```http
POST /api/v1/auth/logout
```

The server should revoke the current refresh-token session.

Example:

```text
Refresh Token
      ↓
Find token record
      ↓
Set revoked_at
      ↓
Session becomes invalid
```

The access token may technically remain valid until its short expiration time.

This is another reason the access token should be short-lived.

---

# 15. Logout From All Devices

Recommended endpoint:

```http
POST /api/v1/auth/logout-all
```

This revokes all active refresh-token records belonging to the user.

Example:

```sql
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE user_id = :userId
  AND revoked_at IS NULL;
```

This is useful when:

- a device is lost
- the user suspects account compromise
- a password is changed
- an administrator disables an account

---

# 16. Refresh Token Flow

Endpoint:

```http
POST /api/v1/auth/refresh
```

Flow:

```text
Refresh token
      ↓
Validate JWT
      ↓
Find hashed session
      ↓
Check revoked_at
      ↓
Check expiration
      ↓
Check user status
      ↓
Issue new access token
      ↓
Optionally rotate refresh token
```

---

# 17. Refresh Token Rotation

Refresh-token rotation is recommended.

Instead of allowing the same refresh token to live indefinitely:

```text
Old refresh token
       ↓
Revoke
       ↓
Generate new refresh token
       ↓
Store new hash
       ↓
Return new token
```

This reduces the impact of stolen refresh tokens.

A reuse-detection mechanism can also be added later.

---

# 18. Password Reset

Password reset endpoints:

```http
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

## Forgot Password

Request:

```json
{
  "email": "user@example.com"
}
```

The API should return the same generic response whether or not the email exists.

Example:

```json
{
  "message": "If the account exists, a password reset link has been sent."
}
```

This prevents account enumeration.

---

# 19. Password Reset Token

The reset token should be:

```text
random
single-use
short-lived
hashed in database
```

Example lifetime:

```text
15–30 minutes
```

Database:

```text
password_reset_tokens
```

Fields:

```text
id
user_id
token_hash
expires_at
used_at
created_at
```

Never store the raw reset token.

---

# 20. Password Change

Authenticated users should be able to change their password.

Endpoint:

```http
POST /api/v1/auth/change-password
```

Request:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

Flow:

```text
Authenticate user
       ↓
Verify current password
       ↓
Validate new password
       ↓
Hash new password
       ↓
Update password
       ↓
Revoke refresh sessions
       ↓
Audit event
```

Revoking existing sessions is strongly recommended after a password change.

---

# 21. Account Status

Users have:

```text
ACTIVE
INACTIVE
SUSPENDED
```

Only `ACTIVE` users should authenticate.

Example:

```text
INACTIVE → login denied
SUSPENDED → login denied
ACTIVE → login permitted
```

The system should return a generic authentication error rather than exposing unnecessary account details.

---

# 22. JWT Authentication Guard

Protected endpoints use a JWT guard.

Conceptually:

```typescript
@UseGuards(JwtAuthGuard)
```

The guard:

1. extracts the bearer token
2. verifies the JWT
3. loads/validates the user context
4. attaches the authenticated user to the request

Example:

```typescript
request.user
```

contains:

```typescript
{
  id,
  role,
  businessId,
  branchId
}
```

---

# 23. Public Routes

Authentication endpoints such as login and password reset should be public.

A reusable decorator is recommended:

```typescript
@Public()
```

Example:

```typescript
@Public()
@Post('login')
login() {}
```

The global authentication mechanism can then skip routes marked as public.

---

# 24. Role-Based Authorization

Create a reusable decorator:

```typescript
@Roles(UserRole.ADMIN)
```

Example:

```typescript
@Roles(UserRole.ADMIN)
@Post('branches')
createBranch() {}
```

For multiple roles:

```typescript
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
```

The `RolesGuard` checks the authenticated user's role.

---

# 25. Important: RBAC Is Not Enough

This is one of the most important security rules in the entire application.

This is **not sufficient**:

```typescript
@Roles(UserRole.MANAGER)
@Get(':id')
findOne(@Param('id') id: string) {
  return this.service.findOne(id);
}
```

Why?

Because a manager could potentially request:

```text
GET /api/v1/sales/<another-branch-sale-id>
```

and receive another branch's data.

The role is correct.

The authorization is still wrong.

---

# 26. Business/Tenant Authorization

Every business-owned query must enforce the authenticated user's business.

For example:

```typescript
return this.saleRepository.findOne({
  where: {
    id,
    businessId: user.businessId,
  },
});
```

Never do:

```typescript
return this.saleRepository.findOne({
  where: {
    id,
  },
});
```

for a normal tenant-scoped endpoint.

The second implementation can create an IDOR/data-isolation vulnerability.

---

# 27. Manager Branch Authorization

Managers require an additional branch restriction.

Example:

```typescript
return this.saleRepository.findOne({
  where: {
    id,
    businessId: user.businessId,
    branchId: user.branchId,
  },
});
```

This guarantees:

```text
Manager
   ↓
Business
   ↓
Assigned Branch
   ↓
Resource
```

---

# 28. Example Authorization Matrix

| Operation | SUPER_ADMIN | ADMIN | MANAGER |
|---|---:|---:|---:|
| Platform management | ✅ | ❌ | ❌ |
| Business management | ✅ | Own business | ❌ |
| Branch management | ✅ | Own business | ❌ |
| User management | ✅ | Own business | Limited |
| Fuel type management | ✅ | Own business | ❌ |
| Fuel price management | ✅ | Own business | ❌ |
| Supplier management | ✅ | Own business | ❌ |
| Tanker management | ✅ | Own business | ❌ |
| Fuel orders | ✅ | Own business | ❌ |
| Receive delivery | ✅ | Own business | Assigned branch |
| Inventory | ✅ | Own business | Assigned branch |
| Record sales | ✅ | Own business | Assigned branch |
| Daily reports | ✅ | Own business | Assigned branch |
| Approve reports | ✅ | Own business | ❌ |
| Dashboard | Platform | Own business | Own branch |
| Audit logs | Platform | Own business | Limited |

The exact permission matrix can become more granular later.

---

# 29. Authorization Layers

The backend should conceptually evaluate requests like this:

```text
                    Request
                       │
                       ▼
               ┌──────────────┐
               │ JWT Valid?   │
               └──────┬───────┘
                      Yes
                       │
                       ▼
               ┌──────────────┐
               │ Role Allowed?│
               └──────┬───────┘
                      Yes
                       │
                       ▼
               ┌──────────────┐
               │ Business     │
               │ Authorized?  │
               └──────┬───────┘
                      Yes
                       │
                       ▼
               ┌──────────────┐
               │ Branch       │
               │ Authorized?  │
               └──────┬───────┘
                      Yes
                       │
                       ▼
                    Action
```

---

# 30. Resource-Level Authorization

Some actions require more than business/branch checks.

Example:

A manager may own a report because it belongs to their branch, but they should not be allowed to approve it.

Therefore:

```text
Resource ownership
+
Operation permission
```

must both be evaluated.

Example:

```text
MANAGER
→ Can submit report

MANAGER
→ Cannot approve report

ADMIN
→ Can approve report
```

---

# 31. Preventing Client-Supplied Scope Abuse

Do not trust:

```json
{
  "businessId": "another-business",
  "branchId": "another-branch"
}
```

from the client.

For a manager, the authoritative values come from:

```typescript
request.user.businessId
request.user.branchId
```

not the request body.

For example, avoid:

```typescript
createSale(dto: CreateSaleDto)
```

where:

```typescript
dto.businessId
dto.branchId
```

controls ownership.

Instead:

```typescript
createSale(user: AuthenticatedUser, dto: CreateSaleDto)
```

and derive:

```typescript
businessId = user.businessId;
branchId = user.branchId;
```

---

# 32. SUPER_ADMIN Scope

`SUPER_ADMIN` is different because the platform administrator may legitimately need to inspect multiple businesses.

However, the target business should be explicit.

Example:

```http
GET /api/v1/admin/businesses/:businessId/reports
```

The system should:

1. verify `SUPER_ADMIN`
2. validate target business
3. perform the operation
4. create an audit record

The action should clearly identify:

```text
actor = SUPER_ADMIN
target business = KBY
action = VIEW_REPORT
```

---

# 33. Preventing Privilege Escalation

A user must not be able to change their own role through a normal profile update.

For example, this must not be accepted:

```json
{
  "role": "ADMIN"
}
```

through:

```http
PATCH /api/v1/users/me
```

Profile DTOs and administrative user-management DTOs must be separate.

For example:

```text
UpdateMyProfileDto
CreateUserDto
UpdateUserRoleDto
```

This prevents mass-assignment vulnerabilities.

---

# 34. Role Assignment

Changing a user's role should be an explicit administrative operation.

Example:

```http
PATCH /api/v1/users/:id/role
```

Request:

```json
{
  "role": "MANAGER"
}
```

Only authorized administrators should access this endpoint.

The service must also validate role-specific scope.

For example:

```text
MANAGER
→ business_id required
→ branch_id required

ADMIN
→ business_id required
→ branch_id must be NULL

SUPER_ADMIN
→ business_id NULL
→ branch_id NULL
```

---

# 35. Manager Branch Assignment

When assigning a manager:

```text
1. Validate manager role
2. Validate target business
3. Validate target branch
4. Confirm branch belongs to business
5. Assign branch
6. Audit change
```

Never allow:

```text
business_id = Business A
branch_id   = Business B branch
```

This would break tenant isolation.

---

# 36. Authorization Service

A dedicated authorization service is recommended for complex rules.

Example:

```text
AuthorizationService
```

Potential methods:

```typescript
assertBusinessAccess(
  user: AuthenticatedUser,
  businessId: string,
): void;

assertBranchAccess(
  user: AuthenticatedUser,
  branchId: string,
): void;

assertResourceAccess(
  user: AuthenticatedUser,
  resource: Resource,
): void;
```

This keeps authorization rules consistent.

---

# 37. Current User Decorator

A reusable decorator should expose the authenticated user.

Example:

```typescript
@Get('me')
getProfile(@CurrentUser() user: AuthenticatedUser) {
  return this.usersService.getProfile(user.id);
}
```

This avoids repeatedly accessing:

```typescript
request.user
```

inside controllers.

---

# 38. Authentication Endpoints

The MVP authentication API should include:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/change-password
GET    /api/v1/auth/me
```

---

# 39. User Endpoints

Recommended:

```text
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
PATCH  /api/v1/users/:id/status
PATCH  /api/v1/users/:id/role
DELETE /api/v1/users/:id
```

The exact permission matrix will be defined in the Users API specification.

---

# 40. Authentication Error Handling

Do not expose unnecessary information.

Avoid:

```text
"Email exists but password is wrong."
```

Prefer:

```text
"Invalid email or password."
```

Similarly, password reset should not reveal whether an email exists.

---

# 41. HTTP Status Codes

Recommended:

### `401 Unauthorized`

Use when authentication is missing or invalid.

Examples:

```text
Missing token
Invalid token
Expired token
Invalid credentials
```

### `403 Forbidden`

Use when the user is authenticated but not allowed to perform the operation.

Example:

```text
MANAGER attempting to approve a report
```

### `404 Not Found`

For resource lookups where exposing resource existence is not a security concern.

For tenant-isolated resources, returning `404` instead of `403` can be useful to avoid revealing that another tenant's resource exists.

---

# 42. Account Security

Recommended protections:

```text
Rate-limit login
Rate-limit password reset
Rate-limit refresh endpoint
Require strong passwords
Hash passwords using Argon2id
Hash refresh tokens
Hash password-reset tokens
Use short-lived access tokens
Rotate refresh tokens
Revoke sessions after password changes
Never log credentials
Never return password hashes
```

---

# 43. Login Rate Limiting

The login endpoint should be rate-limited.

Example conceptual policy:

```text
5 failed attempts
within a short time window
→ temporary throttling
```

The exact values should be configurable.

This protects against brute-force attacks.

---

# 44. Password Policy

MVP recommendation:

```text
Minimum: 8 characters
```

A stronger policy may require:

```text
12+ characters
```

Avoid overly complicated rules that encourage users to choose predictable passwords.

The system should reject common/compromised passwords if a password screening mechanism is introduced later.

---

# 45. Email Normalization

Email addresses should be normalized before lookup.

For example:

```text
John.Doe@Example.com
```

should consistently map to the application's normalized representation.

PostgreSQL should enforce case-insensitive uniqueness.

Recommended:

```sql
UNIQUE (LOWER(email))
```

---

# 46. Authentication Audit Events

The following events should be audited:

```text
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
LOGOUT_ALL
TOKEN_REFRESH
PASSWORD_CHANGED
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_COMPLETED
ACCOUNT_SUSPENDED
ACCOUNT_ACTIVATED
ROLE_CHANGED
BRANCH_ASSIGNMENT_CHANGED
```

Failed login auditing should not store passwords or tokens.

---

# 47. Session Management

The platform should treat each refresh-token record as a session.

Example:

```text
User
 ├── Chrome / Windows
 ├── Mobile
 └── Other device
```

This allows future functionality such as:

```text
GET /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:id
```

Although session management can be kept simple for the first MVP, the database design should not prevent it.

---

# 48. Authentication Configuration

Environment variables:

```env
NODE_ENV=development

JWT_ACCESS_SECRET=replace-with-secure-secret
JWT_ACCESS_EXPIRES_IN=15m

JWT_REFRESH_SECRET=replace-with-different-secure-secret
JWT_REFRESH_EXPIRES_IN=30d

PASSWORD_RESET_EXPIRES_IN=30m
```

Production secrets must come from a secure secret-management mechanism rather than source control.

---

# 49. Recommended Auth Module Structure

```text
src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── refresh-token.strategy.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── refresh-token.guard.ts
├── decorators/
│   ├── public.decorator.ts
│   └── current-user.decorator.ts
├── dto/
│   ├── login.dto.ts
│   ├── refresh-token.dto.ts
│   ├── forgot-password.dto.ts
│   ├── reset-password.dto.ts
│   └── change-password.dto.ts
├── interfaces/
│   ├── jwt-payload.interface.ts
│   └── authenticated-user.interface.ts
└── services/
    ├── token.service.ts
    └── password.service.ts
```

---

# 50. Common Authorization Components

```text
src/common/
├── decorators/
│   ├── current-user.decorator.ts
│   ├── public.decorator.ts
│   └── roles.decorator.ts
│
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   ├── business-access.guard.ts
│   └── branch-access.guard.ts
│
└── interfaces/
    └── authenticated-user.interface.ts
```

---

# 51. Authenticated User Interface

Recommended:

```typescript
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  businessId: string | null;
  branchId: string | null;
}
```

This object should be created from trusted server-side authentication information.

---

# 52. Example Protected Endpoint

A manager-only sales endpoint:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MANAGER)
@Post('sales')
createSale(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: CreateSaleDto,
) {
  return this.salesService.create(user, dto);
}
```

The service then enforces:

```text
user.businessId
user.branchId
```

rather than trusting the request body.

---

# 53. Example Service Authorization

Conceptually:

```typescript
async create(
  user: AuthenticatedUser,
  dto: CreateSaleDto,
) {
  if (user.role !== UserRole.MANAGER) {
    throw new ForbiddenException();
  }

  if (!user.businessId || !user.branchId) {
    throw new ForbiddenException();
  }

  // Continue with business and branch validation...
}
```

The actual implementation should centralize reusable checks rather than duplicating this logic everywhere.

---

# 54. Authentication Request Lifecycle

A normal protected request:

```text
Client
  │
  │ Authorization: Bearer JWT
  ▼
NestJS
  │
  ▼
JwtAuthGuard
  │
  ▼
JWT Strategy
  │
  ▼
AuthenticatedUser
  │
  ▼
RolesGuard
  │
  ▼
Controller
  │
  ▼
Service
  │
  ▼
Business/Branch Authorization
  │
  ▼
Database
```

Every protected business operation follows this security boundary.

---

# 55. Security Principle: Never Trust IDs From the Client

IDs are references, not authorization.

A request such as:

```http
GET /api/v1/branches/123
```

does not mean the user is allowed to see branch `123`.

The backend must establish:

```text
Does this branch exist?
        +
Does this branch belong to user's business?
        +
Is user's role allowed?
        +
If manager, is this their branch?
```

Only then should the resource be returned.

---

# 56. Security Principle: Authorization Must Happen Server-Side

The frontend may hide:

```text
ADMIN buttons
MANAGER buttons
SUPER_ADMIN pages
```

but this is only a user-interface feature.

It is not security.

A malicious client can call the API directly.

Therefore:

```text
Frontend authorization = UX
Backend authorization = Security
```

The backend must always enforce the rules.

---

# 57. MVP Authentication Sequence

Implementation should proceed in this order:

### Phase 1 — Foundation

```text
User entity
UserRole enum
AccountStatus enum
ConfigModule
ValidationPipe
```

### Phase 2 — Password Security

```text
Argon2 service
Password hashing
Password verification
```

### Phase 3 — JWT

```text
JWT configuration
JWT strategy
JWT guard
CurrentUser decorator
```

### Phase 4 — Login

```text
Login DTO
AuthService.login()
AuthController.login()
```

### Phase 5 — Refresh Sessions

```text
refresh_tokens table
Refresh token service
Refresh endpoint
Token rotation
```

### Phase 6 — Logout

```text
Logout
Logout all
Session revocation
```

### Phase 7 — Password Recovery

```text
Forgot password
Reset password
Email delivery
One-time reset tokens
```

### Phase 8 — RBAC

```text
Roles decorator
RolesGuard
Permission matrix
```

### Phase 9 — Tenant Authorization

```text
Business isolation
Branch isolation
Resource authorization
```

### Phase 10 — Audit/Security Hardening

```text
Login audit
Role-change audit
Password-change audit
Rate limiting
Security testing
```

---

# 58. Authentication Testing Requirements

At minimum, automated tests should verify:

### Login

```text
Valid credentials → success
Wrong password → 401
Unknown email → 401
Inactive user → 401
Suspended user → 401
```

### JWT

```text
Missing token → 401
Invalid token → 401
Expired token → 401
Valid token → success
```

### Roles

```text
ADMIN endpoint + ADMIN → success
ADMIN endpoint + MANAGER → 403
MANAGER endpoint + MANAGER → success
SUPER_ADMIN endpoint + ADMIN → 403
```

### Tenant isolation

```text
Business A user → Business A data → success
Business A user → Business B data → denied
```

### Branch isolation

```text
Manager Branch A → Branch A → success
Manager Branch A → Branch B → denied
```

### Privilege escalation

```text
Manager attempts role=ADMIN → denied
Manager attempts businessId change → denied
Manager attempts branchId change → denied
```

### Password reset

```text
Valid token → reset succeeds
Expired token → denied
Used token → denied
Invalid token → denied
```

---

# 59. Critical Security Tests

The following scenarios should specifically be included in E2E/security testing.

### IDOR test

```text
Manager A knows Sale B UUID
        ↓
GET /sales/{Sale-B-ID}
        ↓
Must not receive Sale B
```

### Cross-business manipulation

```text
ADMIN Business A
        ↓
PATCH Business B resource
        ↓
Must be denied
```

### Branch manipulation

```text
Manager Branch A
        ↓
POST sale with branchId = Branch B
        ↓
Must not create sale in Branch B
```

### Role escalation

```text
MANAGER
        ↓
PATCH /users/me
{
  "role": "ADMIN"
}
        ↓
Must fail
```

### Price manipulation

```text
MANAGER
        ↓
POST sale
{
  "unitPrice": 1
}
        ↓
Backend ignores client price
        ↓
Uses applicable server-side price
```

---

# 60. Final Security Model

The K.B.Y GLOBAL INVESTMENT backend should enforce:

```text
                    ┌──────────────┐
                    │   REQUEST    │
                    └──────┬───────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Authentication  │
                  │     JWT         │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │      Role       │
                  │      RBAC       │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Business     │
                  │   Isolation     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │     Branch      │
                  │   Isolation     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Resource     │
                  │   Permission    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Business Logic  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    Database     │
                  └─────────────────┘
```

The most important rule is:

> **A valid JWT proves who the user is. It does not prove what the user is allowed to access.**

The backend must separately enforce role, business, branch, and resource-level authorization.

---

# 61. Final Authentication API

The MVP authentication surface is:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/change-password
GET    /api/v1/auth/me
```

This provides the foundation required by the remaining K.B.Y GLOBAL INVESTMENT modules.

---

# 62. Architectural Decision

For the MVP, use:

```text
NestJS
    +
JWT access tokens
    +
Hashed refresh tokens
    +
Argon2id
    +
RBAC
    +
Business isolation
    +
Branch isolation
    +
Resource authorization
    +
Audit logging
```

Do **not** start with OAuth, microservices, an external identity provider, or an overly complicated permission engine.

The business is currently small enough that a well-designed modular NestJS authentication system is more appropriate.

The architecture can later integrate external identity providers without changing the fundamental authorization model.

---

## Final Principle

Authentication answers:

> **Who are you?**

Authorization answers:

> **What are you allowed to do?**

Tenant isolation answers:

> **Which business can you access?**

Branch isolation answers:

> **Which branch can you access?**

Resource authorization answers:

> **Can you perform this exact operation on this exact record?**

K.B.Y GLOBAL INVESTMENT should enforce all five questions before allowing sensitive operations.