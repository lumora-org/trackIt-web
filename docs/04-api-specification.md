# K.B.Y GLOBAL INVESTMENT
# API Specification

**Document:** 04-api-specification.md  
**Version:** 1.0  
**Status:** MVP API Contract  
**Backend:** NestJS  
**Database:** PostgreSQL  
**Authentication:** JWT Access Token + Refresh Token  
**API Style:** REST  
**Base Path:** `/api/v1`

---

## 1. Purpose

This document defines the REST API contract for the K.B.Y GLOBAL INVESTMENT fueling-station management platform.

The API translates the product requirements and database design into a concrete backend contract covering:

- Authentication
- User management
- Business management
- Branch management
- Fuel types
- Fuel pricing
- Suppliers
- Tankers
- Fuel orders
- Deliveries
- Inventory
- Sales
- Daily reports
- Notifications
- Dashboard
- Reporting and exports
- Authorization
- Pagination
- Filtering
- Validation
- Error handling
- Audit logging

The API is designed for the MVP and should not expose internal database implementation details unnecessarily.

---

# 2. API Conventions

## 2.1 Base URL

Development:

```text
http://localhost:3000/api/v1
```

Production:

```text
https://<production-domain>/api/v1
```

---

## 2.2 Content Type

Requests containing a body should use:

```http
Content-Type: application/json
```

Successful responses should normally return:

```http
Content-Type: application/json
```

File downloads may return formats such as:

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
text/csv
application/pdf
```

depending on the endpoint.

---

# 3. Authentication

The platform uses:

- Short-lived JWT access tokens
- Long-lived refresh tokens
- Password hashing
- Password reset tokens

Refresh tokens must be stored hashed in the database.

The API must never return:

- `password_hash`
- raw refresh tokens after their initial issuance
- password reset token hashes
- other authentication secrets

---

# 4. Roles

The system has three roles.

| Role | Description |
|---|---|
| `SUPER_ADMIN` | Platform-level operator/developer |
| `ADMIN` | Business owner/operator |
| `MANAGER` | Branch manager |

---

# 5. Authorization Rules

## 5.1 SUPER_ADMIN

Can:

- Manage businesses
- Manage users
- Manage branches
- View platform-wide information
- View audit logs
- Manage system configuration
- Access all business records

---

## 5.2 ADMIN

Can:

- View and manage their business
- Manage branches
- Manage managers
- Manage fuel types
- Manage fuel prices
- Manage suppliers
- Manage tankers
- Create and manage fuel orders
- Receive/view deliveries
- View inventory
- View sales
- Review daily reports
- Approve/reject daily reports
- View dashboards
- Export reports
- View business audit logs

An ADMIN must never access another business's records.

---

## 5.3 MANAGER

Can:

- View their assigned branch
- View branch inventory
- Record sales
- Submit daily reports
- View their submitted reports
- View relevant notifications

A MANAGER must never:

- Access another branch
- Access another business
- Change fuel prices
- Create suppliers
- Create tankers
- Create fuel orders
- Approve reports
- Access platform-level administration

---

# 6. Standard Response Format

Successful single-resource response:

```json
{
  "data": {
    "id": "uuid",
    "name": "Example"
  }
}
```

Successful collection response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Successful action response:

```json
{
  "data": {
    "message": "Operation completed successfully"
  }
}
```

---

# 7. Standard Error Format

All API errors should follow a predictable structure.

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "email must be a valid email address"
    }
  ],
  "timestamp": "2026-10-05T08:30:00.000Z",
  "path": "/api/v1/auth/register"
}
```

---

# 8. Common HTTP Status Codes

| Status | Meaning |
|---:|---|
| `200` | Successful request |
| `201` | Resource created |
| `204` | Successful request with no response body |
| `400` | Invalid request |
| `401` | Authentication required/invalid |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `409` | Conflict |
| `422` | Business validation failure |
| `429` | Too many requests |
| `500` | Internal server error |

---

# 9. Error Codes

Recommended application error codes:

```text
AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
AUTH_REFRESH_TOKEN_INVALID
AUTH_ACCOUNT_INACTIVE

VALIDATION_ERROR
RESOURCE_NOT_FOUND
RESOURCE_ALREADY_EXISTS

BUSINESS_ACCESS_DENIED
BRANCH_ACCESS_DENIED

INSUFFICIENT_INVENTORY
INVALID_FUEL_PRICE
INVALID_DELIVERY_QUANTITY

INVALID_ORDER_STATUS
INVALID_DELIVERY_STATUS

INVALID_REPORT_STATUS
REPORT_ALREADY_EXISTS
REPORT_NOT_SUBMITTABLE
REPORT_NOT_APPROVABLE

DUPLICATE_REQUEST
INVALID_OPERATION
```

---

# 10. Authentication API

## 10.1 Register

```http
POST /auth/register
```

### Authorization

```text
SUPER_ADMIN
```

Normal public registration is not required for the MVP.

### Request

```json
{
  "firstName": "Ahmad",
  "lastName": "Abdulkareem",
  "email": "ahmad@example.com",
  "phone": "+2348000000000",
  "password": "StrongPassword123!"
}
```

### Response

```http
201 Created
```

```json
{
  "data": {
    "id": "uuid",
    "firstName": "Ahmad",
    "lastName": "Abdulkareem",
    "email": "ahmad@example.com",
    "role": "MANAGER",
    "status": "ACTIVE"
  }
}
```

---

# 11. Login

```http
POST /auth/login
```

### Authorization

Public.

### Request

```json
{
  "email": "ahmad@example.com",
  "password": "StrongPassword123!"
}
```

### Response

```json
{
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "refresh-token",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "firstName": "Ahmad",
      "lastName": "Abdulkareem",
      "email": "ahmad@example.com",
      "role": "ADMIN",
      "businessId": "uuid",
      "branchId": null
    }
  }
}
```

---

# 12. Refresh Token

```http
POST /auth/refresh
```

### Request

```json
{
  "refreshToken": "refresh-token"
}
```

### Response

```json
{
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 900
  }
}
```

Refresh-token rotation is recommended.

---

# 13. Logout

```http
POST /auth/logout
```

### Authorization

Authenticated user.

### Request

```json
{
  "refreshToken": "refresh-token"
}
```

### Response

```http
204 No Content
```

The refresh token must be invalidated.

---

# 14. Forgot Password

```http
POST /auth/forgot-password
```

### Authorization

Public.

### Request

```json
{
  "email": "ahmad@example.com"
}
```

The response should not reveal whether the email exists.

### Response

```json
{
  "data": {
    "message": "If the account exists, password reset instructions have been sent."
  }
}
```

---

# 15. Reset Password

```http
POST /auth/reset-password
```

### Request

```json
{
  "token": "password-reset-token",
  "password": "NewStrongPassword123!"
}
```

### Rules

- Token must exist.
- Token must not be expired.
- Token must not have been used.
- Password must satisfy password policy.
- Token must be invalidated after successful reset.

---

# 16. Current User

```http
GET /auth/me
```

### Authorization

Authenticated user.

### Response

```json
{
  "data": {
    "id": "uuid",
    "firstName": "Ahmad",
    "lastName": "Abdulkareem",
    "email": "ahmad@example.com",
    "phone": "+2348000000000",
    "role": "MANAGER",
    "status": "ACTIVE",
    "businessId": "uuid",
    "branchId": "uuid"
  }
}
```

---

# 17. Users API

## 17.1 List Users

```http
GET /users
```

### Authorization

```text
SUPER_ADMIN
ADMIN
```

### Query Parameters

```text
?page=1
&limit=20
&search=ahmad
&role=MANAGER
&status=ACTIVE
&branchId=uuid
```

---

## 17.2 Get User

```http
GET /users/:id
```

### Authorization

```text
SUPER_ADMIN
ADMIN
```

ADMIN may only retrieve users belonging to their business.

---

## 17.3 Create User

```http
POST /users
```

### Authorization

```text
SUPER_ADMIN
ADMIN
```

### Request

```json
{
  "firstName": "John",
  "lastName": "Manager",
  "email": "manager@example.com",
  "phone": "+2348000000000",
  "password": "StrongPassword123!",
  "role": "MANAGER",
  "branchId": "branch-uuid"
}
```

### Rules

When role is `MANAGER`:

```text
businessId = authenticated admin's business
branchId = required
```

ADMIN must not create a user for another business.

---

# 18. Update User

```http
PATCH /users/:id
```

### Authorization

```text
SUPER_ADMIN
ADMIN
```

Example:

```json
{
  "firstName": "John",
  "phone": "+2348111111111",
  "status": "ACTIVE"
}
```

Sensitive role changes should require explicit authorization.

---

# 19. Deactivate User

```http
PATCH /users/:id/status
```

### Request

```json
{
  "status": "INACTIVE"
}
```

Users should normally be deactivated rather than physically deleted.

---

# 20. Businesses API

## 20.1 List Businesses

```http
GET /businesses
```

### Authorization

```text
SUPER_ADMIN
```

---

## 20.2 Create Business

```http
POST /businesses
```

### Request

```json
{
  "name": "K.B.Y GLOBAL INVESTMENT",
  "registrationNumber": "RC123456",
  "email": "info@kbyglobal.com",
  "phone": "+2348000000000",
  "address": "Lagos, Nigeria"
}
```

---

## 20.3 Get Business

```http
GET /businesses/:id
```

---

## 20.4 Update Business

```http
PATCH /businesses/:id
```

---

# 21. Branches API

## 21.1 List Branches

```http
GET /branches
```

### ADMIN

Returns branches belonging to the authenticated business.

### MANAGER

Returns only the manager's assigned branch.

### Query

```text
?page=1
&limit=20
&status=ACTIVE
&search=Ikeja
```

---

# 22. Create Branch

```http
POST /branches
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "name": "KBY Ikeja",
  "code": "KBY-IKEJA",
  "address": "Ikeja, Lagos",
  "phone": "+2348000000000"
}
```

`code` must be unique within the business.

---

# 23. Get Branch

```http
GET /branches/:id
```

---

# 24. Update Branch

```http
PATCH /branches/:id
```

---

# 25. Fuel Types API

## 25.1 List Fuel Types

```http
GET /fuel-types
```

Query:

```text
?page=1
&limit=20
&status=ACTIVE
```

---

# 26. Create Fuel Type

```http
POST /fuel-types
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "name": "Premium Motor Spirit",
  "code": "PMS",
  "description": "Petrol"
}
```

---

# 27. Get Fuel Type

```http
GET /fuel-types/:id
```

---

# 28. Update Fuel Type

```http
PATCH /fuel-types/:id
```

Fuel types with historical operational records should not be physically deleted.

---

# 29. Fuel Pricing API

## 29.1 List Prices

```http
GET /fuel-prices
```

Query:

```text
?fuelTypeId=uuid
&active=true
&from=2026-10-01
&to=2026-10-31
```

---

# 30. Get Current Price

```http
GET /fuel-prices/current/:fuelTypeId
```

### Response

```json
{
  "data": {
    "fuelTypeId": "uuid",
    "pricePerLitre": 1500.00,
    "effectiveFrom": "2026-10-01T00:00:00.000Z",
    "effectiveTo": null
  }
}
```

---

# 31. Create Fuel Price

```http
POST /fuel-prices
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "fuelTypeId": "uuid",
  "pricePerLitre": 1500,
  "effectiveFrom": "2026-10-05T00:00:00.000Z"
}
```

### Rules

The API must prevent overlapping price periods for the same:

```text
business + fuelType
```

Historical prices must remain unchanged.

---

# 32. Suppliers API

## 32.1 List Suppliers

```http
GET /suppliers
```

Query:

```text
?page=1
&limit=20
&search=NNPC
&status=ACTIVE
```

---

# 33. Create Supplier

```http
POST /suppliers
```

### Request

```json
{
  "name": "Example Petroleum Supplier",
  "code": "SUP-001",
  "contactPerson": "John Doe",
  "phone": "+2348000000000",
  "email": "supplier@example.com",
  "address": "Lagos, Nigeria"
}
```

---

# 34. Get Supplier

```http
GET /suppliers/:id
```

---

# 35. Update Supplier

```http
PATCH /suppliers/:id
```

---

# 36. Tankers API

## 36.1 List Tankers

```http
GET /tankers
```

---

# 37. Create Tanker

```http
POST /tankers
```

### Request

```json
{
  "registrationNumber": "ABC-123-LA",
  "tankerCode": "TANK-001",
  "capacityLitres": 45000,
  "driverName": "John Driver",
  "driverPhone": "+2348000000000"
}
```

### Validation

```text
capacityLitres > 0
```

Registration number must be unique within the business.

---

# 38. Get Tanker

```http
GET /tankers/:id
```

---

# 39. Update Tanker

```http
PATCH /tankers/:id
```

---

# 40. Fuel Orders API

## 40.1 List Fuel Orders

```http
GET /fuel-orders
```

Query:

```text
?page=1
&limit=20
&status=SUBMITTED
&branchId=uuid
&supplierId=uuid
&from=2026-10-01
&to=2026-10-31
```

---

# 41. Create Fuel Order

```http
POST /fuel-orders
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "supplierId": "supplier-uuid",
  "destinationBranchId": "branch-uuid",
  "expectedDeliveryAt": "2026-10-06T10:00:00.000Z",
  "notes": "Morning delivery",
  "items": [
    {
      "fuelTypeId": "fuel-type-uuid",
      "expectedQuantityLitres": 45000,
      "unitCost": 1200
    }
  ]
}
```

---

# 42. Get Fuel Order

```http
GET /fuel-orders/:id
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "orderNumber": "ORD-2026-000001",
    "status": "SUBMITTED",
    "supplier": {
      "id": "uuid",
      "name": "Example Supplier"
    },
    "destinationBranch": {
      "id": "uuid",
      "name": "KBY Ikeja"
    },
    "items": [
      {
        "fuelTypeId": "uuid",
        "fuelTypeName": "PMS",
        "expectedQuantityLitres": 45000,
        "unitCost": 1200
      }
    ]
  }
}
```

---

# 43. Submit Fuel Order

```http
POST /fuel-orders/:id/submit
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

Status:

```text
DRAFT → SUBMITTED
```

---

# 44. Confirm Fuel Order

```http
POST /fuel-orders/:id/confirm
```

Status:

```text
SUBMITTED → CONFIRMED
```

---

# 45. Mark Fuel Order In Transit

```http
POST /fuel-orders/:id/in-transit
```

Status:

```text
CONFIRMED → IN_TRANSIT
```

---

# 46. Cancel Fuel Order

```http
POST /fuel-orders/:id/cancel
```

### Request

```json
{
  "reason": "Supplier could not fulfill order."
}
```

---

# 47. Deliveries API

## 47.1 List Deliveries

```http
GET /deliveries
```

Query:

```text
?page=1
&limit=20
&branchId=uuid
&status=RECEIVED
&from=2026-10-01
&to=2026-10-31
```

---

# 48. Record Delivery

```http
POST /deliveries
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "fuelOrderId": "order-uuid",
  "tankerId": "tanker-uuid",
  "destinationBranchId": "branch-uuid",
  "deliveredAt": "2026-10-06T10:30:00.000Z",
  "items": [
    {
      "fuelTypeId": "fuel-type-uuid",
      "expectedQuantityLitres": 45000,
      "actualQuantityLitres": 44850,
      "discrepancyReason": "Minor delivery shortage"
    }
  ],
  "notes": "Received and verified."
}
```

---

# 49. Delivery Processing Rules

When a delivery is received:

1. Validate the fuel order.
2. Validate tanker.
3. Validate destination branch.
4. Validate fuel types.
5. Validate actual quantities.
6. Calculate discrepancies.
7. Create delivery.
8. Create delivery items.
9. Create inventory transactions.
10. Update order status.
11. Write audit log.
12. Generate notifications where required.

All operations must happen in one database transaction.

Only:

```text
actualQuantityLitres
```

is added to inventory.

Expected quantity must never be used as the authoritative inventory movement.

---

# 50. Get Delivery

```http
GET /deliveries/:id
```

---

# 51. Receive Delivery

If deliveries are created before physical confirmation, the API may expose:

```http
POST /deliveries/:id/receive
```

### Request

```json
{
  "items": [
    {
      "fuelTypeId": "uuid",
      "actualQuantityLitres": 44850,
      "discrepancyReason": "Minor shortage"
    }
  ]
}
```

This operation creates the authoritative inventory movement.

---

# 52. Dispute Delivery

```http
POST /deliveries/:id/dispute
```

### Request

```json
{
  "reason": "Received quantity differs significantly from supplier documentation."
}
```

---

# 53. Inventory API

Inventory is ledger-driven.

The API must not expose a manually editable "stock balance" field.

---

# 54. Get Branch Inventory

```http
GET /inventory
```

### Authorization

```text
ADMIN
MANAGER
SUPER_ADMIN
```

### Query

```text
?branchId=uuid
&fuelTypeId=uuid
```

Managers are automatically restricted to their assigned branch.

### Response

```json
{
  "data": [
    {
      "branchId": "uuid",
      "branchName": "KBY Ikeja",
      "fuelTypeId": "uuid",
      "fuelTypeName": "PMS",
      "currentQuantityLitres": 32000
    }
  ]
}
```

---

# 55. Inventory Ledger

```http
GET /inventory/transactions
```

Query:

```text
?branchId=uuid
&fuelTypeId=uuid
&type=DELIVERY
&from=2026-10-01
&to=2026-10-31
&page=1
&limit=50
```

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "transactionType": "DELIVERY",
      "quantityLitres": 44850,
      "balanceAfter": 44850,
      "referenceType": "DELIVERY",
      "referenceId": "delivery-uuid",
      "occurredAt": "2026-10-06T10:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

# 56. Inventory Summary

```http
GET /inventory/summary
```

Example response:

```json
{
  "data": {
    "branchId": "uuid",
    "asOf": "2026-10-05T23:59:59.999Z",
    "fuel": [
      {
        "fuelTypeId": "uuid",
        "fuelType": "PMS",
        "currentQuantityLitres": 32000
      },
      {
        "fuelTypeId": "uuid",
        "fuelType": "AGO",
        "currentQuantityLitres": 12000
      }
    ]
  }
}
```

---

# 57. Manual Inventory Adjustment

```http
POST /inventory/adjustments
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "branchId": "branch-uuid",
  "fuelTypeId": "fuel-type-uuid",
  "quantityLitres": -100,
  "reason": "Physical stock count discrepancy"
}
```

The adjustment creates an immutable inventory transaction.

It must not directly modify historical transactions.

---

# 58. Sales API

## 58.1 List Sales

```http
GET /sales
```

Query:

```text
?page=1
&limit=20
&branchId=uuid
&fuelTypeId=uuid
&from=2026-10-01
&to=2026-10-31
```

---

# 59. Record Sale

```http
POST /sales
```

### Authorization

```text
MANAGER
ADMIN
SUPER_ADMIN
```

Managers can only record sales for their assigned branch.

### Request

```json
{
  "branchId": "branch-uuid",
  "fuelTypeId": "fuel-type-uuid",
  "litresSold": 8500,
  "soldAt": "2026-10-05T15:30:00.000Z"
}
```

The client must not be trusted to submit the final amount.

---

# 60. Sale Processing

The backend must:

1. Authenticate user.
2. Validate branch access.
3. Validate fuel type.
4. Lock/check inventory.
5. Determine applicable fuel price.
6. Calculate total amount.
7. Create sale.
8. Create negative inventory transaction.
9. Create audit log.
10. Commit the transaction.

Calculation:

```text
totalAmount = litresSold × unitPrice
```

Example:

```text
8,500 × ₦1,500 = ₦12,750,000
```

---

# 61. Sale Response

```json
{
  "data": {
    "id": "uuid",
    "saleNumber": "SALE-2026-000001",
    "branchId": "uuid",
    "fuelTypeId": "uuid",
    "litresSold": 8500,
    "unitPrice": 1500,
    "totalAmount": 12750000,
    "soldAt": "2026-10-05T15:30:00.000Z"
  }
}
```

---

# 62. Get Sale

```http
GET /sales/:id
```

---

# 63. Void Sale

```http
POST /sales/:id/void
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "reason": "Duplicate sale entry"
}
```

Voiding a sale must not silently delete its inventory history.

A corresponding inventory correction transaction must be generated according to the business rules.

---

# 64. Daily Reports API

## 64.1 List Reports

```http
GET /daily-reports
```

Query:

```text
?page=1
&limit=20
&branchId=uuid
&status=SUBMITTED
&from=2026-10-01
&to=2026-10-31
```

---

# 65. Get Daily Report

```http
GET /daily-reports/:id
```

---

# 66. Generate Daily Report

```http
POST /daily-reports
```

### Authorization

```text
MANAGER
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "branchId": "branch-uuid",
  "reportDate": "2026-10-05",
  "managerNotes": "Normal business operations."
}
```

The backend calculates:

```text
openingStockLitres
totalReceivedLitres
totalSoldLitres
closingStockLitres
totalRevenue
```

The client must not be trusted to submit these calculated values.

---

# 67. Daily Report Response

```json
{
  "data": {
    "id": "uuid",
    "branchId": "uuid",
    "reportDate": "2026-10-05",
    "status": "DRAFT",
    "openingStockLitres": 45000,
    "totalReceivedLitres": 0,
    "totalSoldLitres": 8500,
    "closingStockLitres": 36500,
    "totalRevenue": 12750000,
    "managerNotes": "Normal business operations."
  }
}
```

---

# 68. Submit Daily Report

```http
POST /daily-reports/:id/submit
```

### Authorization

```text
MANAGER
```

Status:

```text
DRAFT → SUBMITTED
```

The API must validate the report before submission.

---

# 69. Approve Daily Report

```http
POST /daily-reports/:id/approve
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

Status:

```text
SUBMITTED → APPROVED
```

The response should include reviewer information.

---

# 70. Reject Daily Report

```http
POST /daily-reports/:id/reject
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Request

```json
{
  "reason": "Closing stock does not match the physical stock count."
}
```

Status:

```text
SUBMITTED → REJECTED
```

---

# 71. Resubmit Rejected Report

```http
POST /daily-reports/:id/resubmit
```

### Authorization

```text
MANAGER
```

Status:

```text
REJECTED → DRAFT
```

The manager can correct and submit the report again.

---

# 72. Notifications API

## 72.1 List Notifications

```http
GET /notifications
```

Query:

```text
?page=1
&limit=20
&status=UNREAD
&type=REPORT_SUBMITTED
```

A user may only retrieve their own notifications.

---

# 73. Mark Notification Read

```http
PATCH /notifications/:id/read
```

---

# 74. Mark All Notifications Read

```http
PATCH /notifications/read-all
```

---

# 75. Dashboard API

The dashboard API provides aggregated information rather than raw database records.

---

# 76. Admin Dashboard

```http
GET /dashboard/admin
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

### Optional Query

```text
?from=2026-10-01
&to=2026-10-05
&branchId=uuid
```

### Response

```json
{
  "data": {
    "summary": {
      "totalBranches": 3,
      "totalFuelReceivedLitres": 135000,
      "totalFuelSoldLitres": 42500,
      "totalRevenue": 63750000,
      "lowInventoryBranches": 1
    },
    "branches": [
      {
        "branchId": "uuid",
        "branchName": "KBY Ikeja",
        "fuelSoldLitres": 15000,
        "revenue": 22500000
      }
    ]
  }
}
```

---

# 77. Manager Dashboard

```http
GET /dashboard/manager
```

The manager dashboard is automatically scoped to the authenticated manager's branch.

### Response

```json
{
  "data": {
    "branch": {
      "id": "uuid",
      "name": "KBY Ikeja"
    },
    "inventory": [],
    "today": {
      "litresSold": 8500,
      "revenue": 12750000
    },
    "dailyReport": {
      "status": "DRAFT"
    }
  }
}
```

---

# 78. Inventory Dashboard

```http
GET /dashboard/inventory
```

### Authorization

```text
ADMIN
SUPER_ADMIN
```

Provides:

- Current inventory
- Inventory by branch
- Inventory by fuel type
- Low-stock indicators
- Recent deliveries
- Recent sales

---

# 79. Sales Reports

```http
GET /reports/sales
```

Query:

```text
?from=2026-10-01
&to=2026-10-31
&branchId=uuid
&fuelTypeId=uuid
```

### Response

```json
{
  "data": {
    "summary": {
      "totalLitresSold": 125000,
      "totalRevenue": 187500000
    },
    "byFuelType": [
      {
        "fuelTypeId": "uuid",
        "fuelType": "PMS",
        "litresSold": 100000,
        "revenue": 150000000
      }
    ]
  }
}
```

---

# 80. Inventory Reports

```http
GET /reports/inventory
```

Query:

```text
?from=2026-10-01
&to=2026-10-31
&branchId=uuid
&fuelTypeId=uuid
```

Returns:

- Opening stock
- Deliveries
- Sales
- Adjustments
- Closing stock

---

# 81. Delivery Reports

```http
GET /reports/deliveries
```

Returns:

- Number of deliveries
- Expected quantities
- Actual quantities
- Discrepancies
- Suppliers
- Branches
- Tankers

---

# 82. Daily Report Summary

```http
GET /reports/daily-reports
```

Query:

```text
?from=2026-10-01
&to=2026-10-31
&branchId=uuid
&status=APPROVED
```

---

# 83. Export Sales Report

```http
GET /reports/sales/export
```

Query:

```text
?format=xlsx
&from=2026-10-01
&to=2026-10-31
&branchId=uuid
```

Supported MVP format:

```text
xlsx
```

The exported report must respect the authenticated user's business/branch permissions.

---

# 84. Export Inventory Report

```http
GET /reports/inventory/export
```

Example:

```text
?format=xlsx
&from=2026-10-01
&to=2026-10-31
```

---

# 85. Export Daily Reports

```http
GET /reports/daily-reports/export
```

---

# 86. Audit Logs

## 86.1 List Audit Logs

```http
GET /audit-logs
```

### Authorization

```text
SUPER_ADMIN
ADMIN
```

ADMIN can only access audit logs belonging to their business.

### Query

```text
?page=1
&limit=50
&userId=uuid
&action=SALE_CREATED
&resourceType=SALE
&from=2026-10-01
&to=2026-10-31
```

---

# 87. Get Audit Log

```http
GET /audit-logs/:id
```

Audit logs are read-only.

Normal users must never be allowed to modify or delete audit records.

---

# 88. Audit Actions

Recommended audit actions include:

```text
USER_CREATED
USER_UPDATED
USER_DEACTIVATED

BUSINESS_CREATED
BUSINESS_UPDATED

BRANCH_CREATED
BRANCH_UPDATED

FUEL_TYPE_CREATED
FUEL_TYPE_UPDATED

FUEL_PRICE_CREATED

SUPPLIER_CREATED
SUPPLIER_UPDATED

TANKER_CREATED
TANKER_UPDATED

FUEL_ORDER_CREATED
FUEL_ORDER_SUBMITTED
FUEL_ORDER_CONFIRMED
FUEL_ORDER_CANCELLED

DELIVERY_CREATED
DELIVERY_RECEIVED
DELIVERY_DISPUTED

INVENTORY_ADJUSTED

SALE_CREATED
SALE_VOIDED

DAILY_REPORT_CREATED
DAILY_REPORT_SUBMITTED
DAILY_REPORT_APPROVED
DAILY_REPORT_REJECTED

LOGIN_SUCCESS
LOGIN_FAILED
PASSWORD_RESET
```

---

# 89. Pagination

All list endpoints should support:

```text
page
limit
```

Example:

```http
GET /sales?page=2&limit=50
```

Defaults:

```text
page = 1
limit = 20
```

Recommended maximum:

```text
limit = 100
```

The backend must enforce the maximum.

---

# 90. Search

Search parameters should be supported where meaningful.

Example:

```http
GET /branches?search=ikeja
```

Search should normally operate on:

- Name
- Code
- Email
- Phone
- Registration number

depending on the resource.

---

# 91. Date Filtering

Date filtering uses ISO 8601.

Example:

```text
from=2026-10-01
to=2026-10-31
```

For timestamps:

```text
from=2026-10-01T00:00:00Z
to=2026-10-31T23:59:59Z
```

The backend stores timestamps in UTC.

---

# 92. Business Scoping

Every business-owned resource must be automatically scoped to the authenticated user's business.

The backend must never trust:

```json
{
  "businessId": "some-other-business"
}
```

from a normal client request.

For ADMIN and MANAGER operations, business context should normally be derived from the authenticated user.

Example:

```text
authenticatedUser.businessId
```

rather than accepting an arbitrary business ID.

---

# 93. Branch Scoping

Managers are branch-scoped.

For every manager request involving branch data:

```text
requestedBranchId === authenticatedUser.branchId
```

must be enforced server-side.

A manager must not be able to bypass this by changing:

```text
branchId
```

in the request body or query string.

---

# 94. Ownership Checks

Every resource access must perform appropriate ownership checks.

Example:

```text
ADMIN
    ↓
businessId
    ↓
branchId
    ↓
resource
```

The API must not rely only on:

```http
GET /sales/:id
```

with the assumption that the UUID itself provides authorization.

The backend must verify that the sale belongs to an accessible business/branch.

---

# 95. DTO Structure

NestJS DTOs should be organized by module.

Recommended structure:

```text
src/
├── auth/
│   ├── dto/
│   │   ├── login.dto.ts
│   │   ├── refresh-token.dto.ts
│   │   ├── forgot-password.dto.ts
│   │   └── reset-password.dto.ts
│
├── users/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   └── update-user-status.dto.ts
│
├── businesses/
│   └── dto/
│
├── branches/
│   └── dto/
│
├── fuel-types/
│   └── dto/
│
├── fuel-prices/
│   └── dto/
│
├── suppliers/
│   └── dto/
│
├── tankers/
│   └── dto/
│
├── fuel-orders/
│   └── dto/
│
├── deliveries/
│   └── dto/
│
├── inventory/
│   └── dto/
│
├── sales/
│   └── dto/
│
├── daily-reports/
│   └── dto/
│
├── notifications/
│   └── dto/
│
├── dashboard/
│
├── reports/
│
└── audit-logs/
```

---

# 96. DTO Validation

NestJS `ValidationPipe` should be enabled globally.

Recommended configuration:

```typescript
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
```

This prevents clients from injecting unexpected properties.

---

# 97. Example DTO

```typescript
export class CreateSaleDto {
  @IsUUID()
  branchId: string;

  @IsUUID()
  fuelTypeId: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  litresSold: number;

  @IsOptional()
  @IsISO8601()
  soldAt?: string;
}
```

The DTO validates structure.

The service layer validates business rules.

---

# 98. Business Validation vs DTO Validation

DTO validation:

```text
IsUUID
IsEmail
IsNumber
Min
Max
IsEnum
IsISO8601
```

Business validation:

```text
Does branch belong to business?
Does manager own branch?
Does fuel type belong to business?
Is there enough inventory?
Is the fuel price valid for the sale date?
Is the order in a valid status?
Can this report be approved?
```

Business rules must never be implemented solely in the DTO.

---

# 99. Inventory Concurrency

Inventory-sensitive operations must use database transactions.

For a sale:

```text
BEGIN

Lock/check relevant inventory

Verify available quantity

Determine price

Create sale

Create inventory transaction

Write audit log

COMMIT
```

Two simultaneous requests must not be able to sell the same litres of fuel.

Example:

```text
Available PMS = 1,000 L

Request A = 700 L
Request B = 500 L
```

Only one transaction may succeed.

The other must receive:

```http
422 Unprocessable Entity
```

with:

```json
{
  "code": "INSUFFICIENT_INVENTORY",
  "message": "Insufficient PMS inventory."
}
```

---

# 100. Sale Price Resolution

When recording a sale, the backend determines:

```text
business
+
fuelType
+
soldAt
```

and finds the applicable price.

Example:

```text
Oct 1 → ₦1,500
Oct 10 → ₦1,550
Oct 18 → ₦1,600
```

A sale occurring on:

```text
Oct 12
```

must use:

```text
₦1,550
```

The selected price is copied into:

```text
sales.unit_price
```

Historical sales must never change because the current fuel price changes.

---

# 101. Inventory Transaction Rules

The following transaction types are supported:

```text
OPENING_BALANCE
DELIVERY
SALE
ADJUSTMENT
TRANSFER_IN
TRANSFER_OUT
CORRECTION
```

Quantity conventions:

| Type | Quantity |
|---|---:|
| OPENING_BALANCE | Positive |
| DELIVERY | Positive |
| SALE | Negative |
| TRANSFER_IN | Positive |
| TRANSFER_OUT | Negative |
| ADJUSTMENT | Positive/Negative |
| CORRECTION | Positive/Negative |

The ledger is append-only.

---

# 102. No Direct Stock Editing

The API must not expose:

```http
PATCH /inventory/:id
```

to modify current stock.

Instead:

```http
POST /inventory/adjustments
```

creates an inventory transaction.

This preserves the audit trail.

---

# 103. Idempotency

Financial/operational write endpoints should support idempotency.

Recommended header:

```http
Idempotency-Key: 8b5b6f3a-...
```

Initially recommended for:

```text
POST /sales
POST /deliveries
POST /fuel-orders
POST /inventory/adjustments
```

If the same request is retried with the same key, the server should not create a duplicate operation.

---

# 104. Transactions

The following operations must execute atomically.

### Delivery

```text
Delivery
+
Delivery Items
+
Inventory Transactions
+
Audit Log
```

### Sale

```text
Sale
+
Inventory Transaction
+
Audit Log
```

### Report Approval

```text
Daily Report
+
Audit Log
+
Notification
```

### Report Rejection

```text
Daily Report
+
Audit Log
+
Notification
```

---

# 105. Notifications

Notifications should be generated for important workflow events.

Examples:

### Daily report submitted

```text
MANAGER submits report
        ↓
ADMIN receives notification
```

### Report approved

```text
ADMIN approves report
        ↓
MANAGER receives notification
```

### Report rejected

```text
ADMIN rejects report
        ↓
MANAGER receives notification
```

### Delivery received

```text
Delivery received
        ↓
Relevant ADMIN users notified
```

---

# 106. Swagger

Swagger should be available in development.

Recommended URL:

```text
/api/docs
```

Example NestJS setup:

```typescript
const config = new DocumentBuilder()
  .setTitle('K.B.Y GLOBAL INVESTMENT API')
  .setDescription('Fueling Station Management Platform API')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'access-token',
  )
  .build();
```

Controllers should use:

```typescript
@ApiBearerAuth('access-token')
```

where authentication is required.

---

# 107. Swagger Tags

Recommended tags:

```text
Auth
Users
Businesses
Branches
Fuel Types
Fuel Prices
Suppliers
Tankers
Fuel Orders
Deliveries
Inventory
Sales
Daily Reports
Notifications
Dashboard
Reports
Audit Logs
```

---

# 108. Security Requirements

The API must implement:

- Password hashing using Argon2 or bcrypt
- JWT authentication
- Refresh-token rotation
- Token expiration
- Password reset expiration
- Role-based authorization
- Business-level authorization
- Branch-level authorization
- DTO validation
- Rate limiting on authentication endpoints
- CORS configuration
- Secure HTTP headers
- Audit logging
- No sensitive information in error responses
- No password/token values in logs
- Parameterized database queries
- Transactional inventory operations

---

# 109. Authentication Rate Limiting

At minimum, rate-limit:

```text
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/refresh
```

This reduces:

- Brute-force attacks
- Credential stuffing
- Token abuse
- Password-reset abuse

---

# 110. API Versioning

The API should use URI versioning:

```text
/api/v1
```

Example:

```text
/api/v1/auth/login
/api/v1/sales
/api/v1/inventory
```

Breaking changes should result in:

```text
/api/v2
```

rather than silently changing the existing contract.

---

# 111. MVP Endpoint Summary

## Authentication

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
```

## Users

```text
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
PATCH  /users/:id/status
```

## Businesses

```text
GET    /businesses
GET    /businesses/:id
POST   /businesses
PATCH  /businesses/:id
```

## Branches

```text
GET    /branches
GET    /branches/:id
POST   /branches
PATCH  /branches/:id
```

## Fuel Types

```text
GET    /fuel-types
GET    /fuel-types/:id
POST   /fuel-types
PATCH  /fuel-types/:id
```

## Fuel Prices

```text
GET    /fuel-prices
GET    /fuel-prices/current/:fuelTypeId
POST   /fuel-prices
```

## Suppliers

```text
GET    /suppliers
GET    /suppliers/:id
POST   /suppliers
PATCH  /suppliers/:id
```

## Tankers

```text
GET    /tankers
GET    /tankers/:id
POST   /tankers
PATCH  /tankers/:id
```

## Fuel Orders

```text
GET    /fuel-orders
GET    /fuel-orders/:id
POST   /fuel-orders
POST   /fuel-orders/:id/submit
POST   /fuel-orders/:id/confirm
POST   /fuel-orders/:id/in-transit
POST   /fuel-orders/:id/cancel
```

## Deliveries

```text
GET    /deliveries
GET    /deliveries/:id
POST   /deliveries
POST   /deliveries/:id/receive
POST   /deliveries/:id/dispute
```

## Inventory

```text
GET    /inventory
GET    /inventory/summary
GET    /inventory/transactions
POST   /inventory/adjustments
```

## Sales

```text
GET    /sales
GET    /sales/:id
POST   /sales
POST   /sales/:id/void
```

## Daily Reports

```text
GET    /daily-reports
GET    /daily-reports/:id
POST   /daily-reports
POST   /daily-reports/:id/submit
POST   /daily-reports/:id/approve
POST   /daily-reports/:id/reject
POST   /daily-reports/:id/resubmit
```

## Notifications

```text
GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
```

## Dashboard

```text
GET    /dashboard/admin
GET    /dashboard/manager
GET    /dashboard/inventory
```

## Reports

```text
GET    /reports/sales
GET    /reports/sales/export
GET    /reports/inventory
GET    /reports/inventory/export
GET    /reports/deliveries
GET    /reports/daily-reports
GET    /reports/daily-reports/export
```

## Audit

```text
GET    /audit-logs
GET    /audit-logs/:id
```

---

# 112. Explicitly Excluded From MVP

The following APIs should not be implemented unless the product requirements are expanded:

```text
Payments
Expenses
Cash Reconciliation
Pumps
Pump Readings
Nozzles
Staff Shifts
Customers
Loyalty Accounts
Fuel Transfers
Subscriptions
Invoices
Accounting Entries
```

Future APIs can be added without changing the core inventory architecture.

---

# 113. Recommended NestJS Module Structure

The API should map closely to the business domains:

```text
src/
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
├── audit-logs/
│
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── pipes/
│   ├── enums/
│   └── utils/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── app.module.ts
└── main.ts
```

---

# 114. Recommended Common Components

## Guards

```text
JwtAuthGuard
RolesGuard
BusinessAccessGuard
BranchAccessGuard
```

## Decorators

```text
@CurrentUser()
@Roles()
@BusinessScoped()
@BranchScoped()
```

## Interceptors

```text
AuditInterceptor
```

where appropriate.

## Filters

```text
HttpExceptionFilter
```

## Pipes

```text
ValidationPipe
ParseUUIDPipe
```

---

# 115. Core Request Flow

A protected request should generally follow:

```text
HTTP Request
     ↓
JWT Authentication
     ↓
Current User
     ↓
Role Authorization
     ↓
Business/Branch Authorization
     ↓
DTO Validation
     ↓
Controller
     ↓
Service
     ↓
Database Transaction
     ↓
Audit
     ↓
Response
```

---

# 116. Example: Manager Sale

```text
POST /api/v1/sales
        │
        ▼
JWT Guard
        │
        ▼
Roles Guard
(MANAGER)
        │
        ▼
Branch Access Check
        │
        ▼
CreateSaleDto validation
        │
        ▼
SalesService
        │
        ├── Check fuel type
        │
        ├── Lock inventory
        │
        ├── Check available litres
        │
        ├── Resolve historical price
        │
        ├── Calculate total
        │
        ├── Create sale
        │
        ├── Create inventory transaction
        │
        └── Create audit log
        │
        ▼
COMMIT
        │
        ▼
201 Created
```

---

# 117. Example: Delivery

```text
POST /api/v1/deliveries
        │
        ▼
Authentication
        │
        ▼
ADMIN authorization
        │
        ▼
Validate order
        │
        ▼
Validate tanker
        │
        ▼
Validate destination branch
        │
        ▼
Validate actual quantities
        │
        ▼
Create delivery
        │
        ▼
Create delivery items
        │
        ▼
Create positive inventory transactions
        │
        ▼
Update fuel order status
        │
        ▼
Audit
        │
        ▼
Notify
        │
        ▼
COMMIT
```

---

# 118. Example: Daily Report

```text
POST /api/v1/daily-reports
        │
        ▼
Manager authentication
        │
        ▼
Branch ownership check
        │
        ▼
Load sales
        │
        ▼
Load deliveries
        │
        ▼
Load inventory
        │
        ▼
Calculate totals
        │
        ▼
Create report
        │
        ▼
Manager submits
        │
        ▼
Admin reviews
        │
        ├── APPROVE
        │
        └── REJECT
```

---

# 119. API Design Principles

The API must follow these principles:

### 1. Backend is authoritative

Never trust calculated values supplied by the frontend.

### 2. Authorization is server-side

Never rely on hidden frontend controls to protect resources.

### 3. Inventory is ledger-driven

Stock changes happen through inventory transactions.

### 4. Historical prices are immutable

Changing today's price must not change yesterday's sales.

### 5. Financial/operational writes are transactional

Related writes must succeed or fail together.

### 6. Audit important actions

Operational changes must be traceable.

### 7. Business isolation is mandatory

One business must never access another business's records.

### 8. Branch isolation is mandatory for managers

Managers can only operate on their assigned branch.

### 9. Historical records are preserved

Prefer voiding/correction over deletion.

### 10. APIs should remain domain-oriented

Avoid creating one generic "transactions" endpoint for unrelated business concepts.

---

# 120. MVP Definition of Done

The API specification is considered implemented when:

- Authentication works.
- JWT authorization works.
- Refresh tokens work.
- Password reset works.
- Role authorization works.
- Business isolation works.
- Branch isolation works.
- Admin can manage branches.
- Admin can manage managers.
- Admin can manage fuel types.
- Admin can manage fuel prices.
- Admin can manage suppliers.
- Admin can manage tankers.
- Admin can create fuel orders.
- Deliveries update inventory.
- Sales reduce inventory.
- Sales use the correct historical price.
- Overselling is prevented transactionally.
- Daily reports are generated from operational data.
- Managers can submit reports.
- Admins can approve/reject reports.
- Notifications work for key workflow events.
- Dashboards return business/branch summaries.
- Reports can be filtered and exported.
- Audit logs capture important operations.
- Swagger documents the API.
- DTO validation is enabled globally.
- API errors follow a consistent structure.
- Idempotency is supported for critical write operations.
- Historical operational data cannot be casually deleted.

---

# 121. Final MVP API Architecture

The complete API can be viewed as:

```text
                    ┌──────────────────────┐
                    │      AUTH / JWT      │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ ROLE + ACCESS GUARDS │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
       ┌─────▼─────┐     ┌─────▼─────┐     ┌────▼─────┐
       │   ADMIN   │     │  MANAGER  │     │ SUPER    │
       │ OPERATIONS │     │  BRANCH   │     │  ADMIN   │
       └─────┬─────┘     └─────┬─────┘     └────┬─────┘
             │                 │                 │
             └─────────────────┼─────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │     DOMAIN APIs      │
                    ├──────────────────────┤
                    │ Businesses           │
                    │ Branches             │
                    │ Fuel                  │
                    │ Suppliers             │
                    │ Tankers               │
                    │ Fuel Orders           │
                    │ Deliveries            │
                    │ Inventory             │
                    │ Sales                 │
                    │ Daily Reports        │
                    │ Notifications         │
                    │ Dashboard             │
                    │ Reports               │
                    │ Audit Logs             │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │ PostgreSQL / TypeORM │
                    └──────────────────────┘
```

The central business flow is:

```text
Fuel Order
     ↓
Delivery
     ↓
Inventory Ledger
     ↓
Sales
     ↓
Inventory Ledger
     ↓
Daily Report
     ↓
Admin Review
     ↓
Dashboard / Reports
```

This flow is the foundation of the K.B.Y GLOBAL INVESTMENT MVP.