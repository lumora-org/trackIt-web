# K.B.Y GLOBAL INVESTMENT
## Fuel Station Operations, Inventory & Revenue Management Platform

**Document:** Product Requirements Document (PRD)  
**Version:** 1.0  
**Status:** Draft / MVP Planning  
**Product:** K.B.Y GLOBAL INVESTMENT Fuel Station Management Platform  
**Primary Goal:** Digitize and centralize fuel station operations, inventory tracking, sales reporting, revenue calculation, and branch accountability.

---

# 1. Executive Summary

K.B.Y GLOBAL INVESTMENT is a multi-branch fuel station management platform designed to help fuel station owners centrally manage their branches, fuel deliveries, inventory, sales, revenue, and daily operational reports.

The platform will provide a centralized system where the business owner can monitor fuel movement from the point of purchase/order through tanker delivery to individual branches and finally to fuel sales.

The system will replace or reduce dependence on manual records, spreadsheets, paper-based reports, phone calls, and informal communication between branch managers and the business owner.

The core objective is to provide the business owner with a reliable and centralized answer to:

> **How much fuel did we purchase, where was it delivered, how much has each branch sold, how much fuel should remain, and how much revenue should have been generated?**

The first version of the platform will focus on fuel inventory, tanker deliveries, branch sales, daily reporting, revenue calculation, user management, and administrative visibility.

---

# 2. Product Vision

To provide fuel station owners with a simple, reliable, and scalable digital platform for managing multiple branches, tracking fuel inventory, monitoring sales, and maintaining financial and operational accountability.

The long-term vision is to evolve the platform into a complete fuel station management and business intelligence system.

---

# 3. Problem Statement

Managing multiple fuel station branches can become difficult when operational information is distributed across:

- Paper records
- Excel spreadsheets
- WhatsApp messages
- Phone calls
- Manual calculations
- Individual branch records
- Informal reports

This makes it difficult for the business owner to quickly determine:

- How much fuel each branch currently has
- How much fuel each branch received
- How much fuel each branch sold
- How much revenue each branch generated
- Whether reported figures are accurate
- Which branch is performing best
- Whether a tanker delivered the expected quantity
- Whether a manager submitted their daily report
- Whether there are inventory discrepancies
- How much fuel remains across the entire business

The platform will centralize these activities.

---

# 4. Product Objectives

## 4.1 Primary Objectives

The platform should:

1. Centralize all branch information.
2. Allow administrators to manage multiple branches.
3. Track fuel orders and tanker deliveries.
4. Track actual fuel quantities received by branches.
5. Maintain branch-level fuel inventory.
6. Allow managers to record daily fuel sales.
7. Automatically calculate revenue.
8. Allow managers to submit daily reports.
9. Allow administrators to review and approve reports.
10. Provide real-time or near-real-time operational visibility.
11. Maintain an audit trail of important activities.
12. Provide reports and exports for business analysis.

---

# 5. Target Users

The platform will initially support three primary roles.

## 5.1 Super Admin

The Super Admin represents the platform owner/operator.

The Super Admin manages the software platform rather than the day-to-day operation of an individual fuel station business.

### Responsibilities

- Manage business accounts
- Create and manage administrators
- Activate/deactivate business accounts
- View platform-wide statistics
- Monitor platform activity
- Manage system configuration
- View audit logs
- Manage subscription information in future versions

### Restrictions

The Super Admin should not automatically have permission to modify operational records unless explicitly granted by the system.

---

# 6. Admin / Business Owner

The Admin represents the owner or authorized operator of a fuel station business.

The Admin has operational control over the business and its branches.

### Responsibilities

- Manage branches
- Create and manage branch managers
- Register suppliers
- Register tankers
- Create fuel orders
- Assign deliveries to branches
- Record deliveries
- Configure fuel prices
- Monitor inventory
- Monitor sales
- Review daily reports
- Approve/reject reports
- View branch performance
- Generate reports
- Monitor discrepancies

---

# 7. Branch Manager

A Manager is responsible for operating one specific branch.

### Responsibilities

- View branch information
- View available fuel inventory
- View current fuel price
- Confirm fuel deliveries
- Record fuel sales
- Submit daily sales reports
- View historical reports
- Respond to report rejections
- Report operational discrepancies

### Restrictions

Managers must only have access to data belonging to their assigned branch.

A manager must not be able to:

- View another branch's sales
- Modify another branch's inventory
- View another branch's reports
- Modify fuel orders belonging to another branch
- Access administrative functionality

---

# 8. Core Business Workflow

The primary business workflow is:

```text
Admin
  │
  ▼
Create Fuel Order
  │
  ▼
Assign/Receive Tanker
  │
  ▼
Deliver Fuel to Branch
  │
  ▼
Branch Inventory Increases
  │
  ▼
Manager Sells Fuel
  │
  ▼
Inventory Decreases
  │
  ▼
Manager Submits Daily Report
  │
  ▼
Admin Reviews Report
  │
  ├── Approve
  │
  └── Reject
```

---

# 9. Fuel Order Workflow

The Admin should be able to create a fuel order.

An order should contain information such as:

- Order number
- Supplier
- Fuel type
- Expected quantity
- Destination branch
- Expected delivery date
- Status
- Notes

Example:

```text
Order Number: ORD-000001
Supplier: ABC Petroleum
Fuel Type: PMS
Expected Quantity: 45,000 L
Destination: Ikeja Branch
Expected Delivery: 2026-10-04
Status: PENDING
```

---

# 10. Tanker Management

A tanker represents the vehicle transporting fuel.

The system must not assume that every tanker carries exactly 45,000 litres.

Instead, the system should record:

- Tanker identification number
- Registration number
- Capacity
- Driver information
- Supplier
- Current status
- Associated order

Example:

```text
Tanker ID: TANK-000001
Registration: ABC-123-XY
Capacity: 45,000 L
```

---

# 11. Fuel Delivery

A delivery records the actual fuel delivered to a branch.

The system must distinguish between:

**Expected Quantity**

and

**Actual Delivered Quantity**

Example:

```text
Expected: 45,000 L
Actual:   44,850 L
Difference: 150 L
```

The system should automatically calculate the difference.

A significant discrepancy may require an explanation or administrative review.

---

# 12. Fuel Inventory

Inventory is one of the most important parts of the platform.

The system should use an inventory transaction/ledger model rather than relying solely on daily reports.

The fundamental calculation is:

```text
Opening Stock
+ Fuel Received
- Fuel Sold
+/- Adjustments
= Closing Stock
```

Example:

```text
Opening Stock:     10,000 L
Fuel Received:     45,000 L
                    -------
Available:         55,000 L

Fuel Sold:         12,000 L
                    -------
Closing Stock:     43,000 L
```

Every inventory change should create an inventory transaction.

---

# 13. Inventory Transaction Types

The system should support transaction types such as:

- DELIVERY
- SALE
- ADJUSTMENT
- TRANSFER (future)
- CORRECTION

Each transaction should contain:

- Branch
- Fuel type
- Quantity
- Transaction type
- Reference record
- Date/time
- User
- Notes

Inventory should be auditable.

---

# 14. Fuel Types

The initial MVP may focus on PMS/Petrol.

However, the system should be designed to support multiple fuel types.

Potential future fuel types:

- PMS / Petrol
- AGO / Diesel
- DPK / Kerosene

The system must not hard-code PMS as the only possible fuel type.

---

# 15. Fuel Pricing

Fuel prices must be dynamic.

The platform must never assume that the current price is permanently ₦1,500 per litre.

Administrators should be able to configure fuel prices.

Example:

```text
October 1
PMS = ₦1,500/L

October 10
PMS = ₦1,550/L

October 18
PMS = ₦1,600/L
```

The system should maintain price history.

This ensures that historical sales reports remain accurate even after prices change.

---

# 16. Sales Management

Managers should record fuel sales.

A sale should include:

- Branch
- Fuel type
- Litres sold
- Price per litre
- Total amount
- Date
- Manager
- Optional notes

The system automatically calculates:

```text
Total Revenue = Litres Sold × Price Per Litre
```

Example:

```text
Litres Sold: 8,500 L
Price: ₦1,500/L

Revenue:
8,500 × ₦1,500

= ₦12,750,000
```

Managers should not manually enter the calculated revenue.

The system should calculate it.

---

# 17. Daily Sales Report

Each branch manager should submit a daily sales report.

A report may contain:

```text
Date
Branch
Opening Stock
Fuel Received
Litres Sold
Closing Stock
Price Per Litre
Expected Revenue
Manager Notes
```

The system should calculate relevant fields automatically.

---

# 18. Daily Report Submission

Managers should be able to:

- Create a report
- Save a draft
- Submit a report
- View submitted reports
- View rejected reports
- Correct rejected reports
- Resubmit reports

Suggested statuses:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
```

---

# 19. Report Approval

The Admin should be able to review submitted reports.

The Admin can:

### Approve

The report becomes officially accepted.

### Reject

The Admin must provide a rejection reason.

Example:

```text
Status: REJECTED

Reason:
Closing stock does not match expected inventory.
Please verify today's sales figures.
```

The manager can correct and resubmit the report.

---

# 20. Branch Management

The Admin should be able to manage branches.

Branch information may include:

- Branch name
- Branch code
- Address
- Contact information
- Status
- Manager
- Opening date

Example:

```text
Branch:
K.B.Y Ikeja

Code:
KBY-IKE-001

Manager:
John Doe

Status:
ACTIVE
```

---

# 21. Manager Management

The Admin should be able to:

- Create manager accounts
- Assign managers to branches
- Change manager assignments
- Activate/deactivate accounts
- Reset manager passwords
- View manager activity

A manager should normally belong to one branch at a time.

---

# 22. Dashboard Requirements

The Admin dashboard should provide an overview of the entire business.

Important metrics include:

### Branches

```text
Total Branches
Active Branches
```

### Inventory

```text
Total Fuel Received
Total Fuel Sold
Current Fuel Stock
```

### Revenue

```text
Today's Revenue
Weekly Revenue
Monthly Revenue
```

### Operations

```text
Pending Reports
Pending Deliveries
Recent Deliveries
```

### Branch Performance

Display branch-level:

- Litres sold
- Revenue
- Current stock
- Number of reports
- Performance trends

---

# 23. Branch Performance

The Admin should be able to compare branches.

Example:

| Branch | Fuel Sold | Revenue | Current Stock |
|---|---:|---:|---:|
| Ikeja | 12,000 L | ₦18,000,000 | 43,000 L |
| Yaba | 8,500 L | ₦12,750,000 | 31,500 L |
| Lekki | 7,000 L | ₦10,500,000 | 28,000 L |

This information should be available through tables and charts.

---

# 24. Notifications

The platform should provide notifications for important events.

Initial notifications may include:

- Daily report submitted
- Daily report rejected
- Daily report approved
- Tanker delivery completed
- Delivery discrepancy detected
- Low fuel inventory
- Missing daily report

Future notification channels:

- In-app
- Email
- SMS
- WhatsApp

---

# 25. Audit Logging

Important actions should be recorded.

Audit records should include:

- User
- Role
- Action
- Resource
- Resource ID
- Timestamp
- Previous value where applicable
- New value where applicable
- IP/device information where appropriate

Examples:

```text
Admin created branch
Manager submitted daily report
Admin rejected daily report
Manager recorded sale
Admin changed fuel price
Admin recorded tanker delivery
```

Audit logs should not be editable by normal users.

---

# 26. Authentication

The system must provide secure authentication.

Required MVP functionality:

- Login
- Logout
- Password hashing
- Access token
- Refresh token
- Forgot password
- Reset password
- Account activation/deactivation

Passwords must never be stored in plain text.

---

# 27. Authorization

The system must implement role-based access control.

Roles:

```text
SUPER_ADMIN
ADMIN
MANAGER
```

Authorization must also consider branch ownership.

For example:

```text
Manager A
   ↓
Branch A
```

Manager A cannot access:

```text
Branch B
Branch C
Branch D
```

Even if the manager knows the IDs of those resources.

This is a critical security requirement.

---

# 28. Business Rules

The following rules should be enforced by the system.

### Rule 1 — Dynamic Fuel Pricing

Fuel prices can change over time.

### Rule 2 — Actual Delivery Quantity

Inventory increases by the actual quantity received, not merely the expected quantity.

### Rule 3 — Inventory Integrity

A sale cannot normally exceed available inventory.

### Rule 4 — Automatic Revenue Calculation

Revenue is calculated from:

```text
Litres × Price
```

### Rule 5 — Branch Isolation

Managers can only access their assigned branch.

### Rule 6 — Report Ownership

A manager can only create or modify reports for their assigned branch.

### Rule 7 — Report Approval

Only authorized administrators can approve/reject reports.

### Rule 8 — Auditability

Important inventory and financial operations must be traceable.

### Rule 9 — Historical Accuracy

Historical reports must retain the applicable price used at the time of sale.

### Rule 10 — No Silent Inventory Modification

Inventory adjustments should require authorization and an explanation.

---

# 29. MVP Scope

The first MVP should include:

## Authentication

- Login
- Logout
- Password reset
- Role-based authorization

## Super Admin

- Business management
- Admin management
- Platform dashboard
- Audit logs

## Admin

- Dashboard
- Branch management
- Manager management
- Supplier management
- Tanker management
- Fuel order management
- Delivery management
- Fuel pricing
- Inventory
- Sales monitoring
- Daily report review
- Branch performance
- Basic reports

## Manager

- Dashboard
- Branch inventory
- Fuel delivery confirmation
- Sales recording
- Daily reports
- Report history

## System

- Automatic revenue calculation
- Inventory ledger
- Notifications
- Audit logs
- Excel/PDF reporting where practical

---

# 30. Features Explicitly Outside MVP

The following should be considered future functionality:

- Mobile applications
- Pump/nozzle meter integration
- Automated pump readings
- Cash reconciliation
- Staff payroll
- Expense management
- Supplier payment management
- Customer management
- Loyalty programs
- POS integration
- Payment gateway integration
- SMS integration
- WhatsApp integration
- Accounting software integration
- AI-powered analytics
- Advanced forecasting
- Multi-company SaaS billing

These features should not delay the initial MVP.

---

# 31. Future Pump Meter Integration

A future version should support pump readings.

Example:

```text
Pump 1

Opening Meter:
120,000 L

Closing Meter:
125,000 L

Actual Sales:
5,000 L
```

Multiple pumps can then be aggregated:

```text
Pump 1: 5,000 L
Pump 2: 7,000 L
Pump 3: 4,000 L

Total:
16,000 L
```

This can provide stronger verification than manually entering total litres sold.

---

# 32. Reports

The system should eventually provide:

### Daily Sales Report

- Branch
- Date
- Fuel sold
- Revenue
- Opening stock
- Closing stock

### Branch Report

- Total deliveries
- Total sales
- Revenue
- Inventory
- Trends

### Fuel Inventory Report

- Opening stock
- Deliveries
- Sales
- Adjustments
- Closing stock

### Revenue Report

- Daily revenue
- Weekly revenue
- Monthly revenue
- Branch revenue

### Delivery Report

- Supplier
- Tanker
- Expected quantity
- Actual quantity
- Difference
- Destination
- Delivery date

---

# 33. Export Requirements

Reports should eventually support:

- Excel
- PDF
- CSV

Exports should respect the user's permissions.

A Manager should not be able to export another branch's data.

---

# 34. Non-Functional Requirements

## Performance

The system should respond quickly under normal operational load.

Target:

```text
Typical API response:
< 500ms
```

where practical.

---

## Availability

The platform should be designed for reliable daily business operation.

---

## Security

The platform must implement:

- Secure authentication
- Authorization
- Input validation
- Password hashing
- Rate limiting
- Secure HTTP headers
- SQL injection protection
- XSS protection
- CSRF considerations where applicable
- Secure token handling
- Branch-level access control
- Audit logging

---

## Scalability

The architecture should allow the platform to grow from:

```text
1 business
```

to:

```text
100+ businesses
```

without requiring a fundamental architectural rewrite.

---

# 35. Multi-Tenant Architecture

Although the initial system may be built specifically for K.B.Y GLOBAL INVESTMENT, the architecture should be designed with future multi-tenancy in mind.

Conceptually:

```text
Platform
 │
 ├── Business A
 │    ├── Branch 1
 │    ├── Branch 2
 │    └── Branch 3
 │
 ├── Business B
 │    ├── Branch 1
 │    └── Branch 2
 │
 └── Business C
      └── Branch 1
```

This will allow the product to eventually become a SaaS platform for other fuel station owners.

---

# 36. Recommended Technology Stack

## Backend

- NestJS
- TypeScript
- PostgreSQL
- TypeORM
- JWT
- Swagger/OpenAPI
- class-validator
- class-transformer

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Recharts

## Infrastructure

Initial deployment can use:

- Cloud-hosted PostgreSQL
- Cloud-hosted NestJS backend
- Next.js hosting platform
- Object storage for documents where required

The exact cloud provider will be determined during architecture planning.

---

# 37. High-Level System Architecture

```text
                   ┌──────────────────────┐
                   │      SUPER ADMIN     │
                   └──────────┬───────────┘
                              │
                   ┌──────────▼───────────┐
                   │      ADMIN/OWNER     │
                   └──────────┬───────────┘
                              │
               ┌──────────────┼──────────────┐
               │              │              │
               ▼              ▼              ▼
           Branch A        Branch B       Branch C
               │              │              │
            Manager        Manager        Manager
               │              │              │
               └──────────────┼──────────────┘
                              │
                       Backend API
                              │
                       PostgreSQL
```

---

# 38. Core Data Model

The initial system should include entities similar to:

```text
User
Business
Branch
FuelType
FuelPrice
Supplier
Tanker
FuelOrder
FuelOrderItem
Delivery
InventoryTransaction
Sale
DailyReport
Notification
AuditLog
```

Relationships should be finalized in the database design document.

---

# 39. Core Inventory Model

The inventory model is fundamental.

Every inventory movement should be represented as a transaction.

Example:

```text
Inventory Ledger

Date        Type       Quantity      Balance
------------------------------------------------
Oct 01      OPENING     +10,000       10,000
Oct 02      DELIVERY    +45,000       55,000
Oct 02      SALE        -5,000        50,000
Oct 02      SALE        -3,000        47,000
```

Current balance:

```text
47,000 L
```

This ledger provides traceability.

---

# 40. Data Integrity Requirements

The system should prevent:

- Negative inventory unless explicitly authorized
- Duplicate delivery records
- Duplicate sales submissions
- Invalid branch ownership
- Unauthorized inventory adjustments
- Unauthorized report modifications
- Invalid fuel prices
- Invalid quantities
- Invalid user/branch relationships

Financial and inventory operations should use database transactions where appropriate.

---

# 41. Sponsor Demonstration Scenario

The MVP demonstration should follow a realistic scenario.

### Step 1

Create K.B.Y GLOBAL INVESTMENT.

### Step 2

Create three branches:

```text
Ikeja
Yaba
Lekki
```

### Step 3

Create managers for each branch.

### Step 4

Create a fuel order:

```text
45,000 L PMS
```

### Step 5

Assign a tanker.

### Step 6

Record actual delivery:

```text
44,850 L
```

### Step 7

System updates branch inventory.

### Step 8

Manager records:

```text
8,500 L sold
```

### Step 9

System calculates:

```text
8,500 × ₦1,500
=
₦12,750,000
```

### Step 10

Manager submits the daily report.

### Step 11

Admin receives notification.

### Step 12

Admin reviews and approves the report.

### Step 13

Dashboard displays:

```text
Fuel Received: 44,850 L
Fuel Sold:      8,500 L
Remaining:     36,350 L
Revenue:       ₦12.75M
```

This should be the primary sponsor demonstration.

---

# 42. MVP Success Criteria

The MVP will be considered successful if an Admin can complete the following workflow without manual calculations:

```text
Create Branch
      ↓
Create Manager
      ↓
Create Fuel Order
      ↓
Assign Tanker
      ↓
Record Delivery
      ↓
Update Inventory
      ↓
Manager Records Sale
      ↓
Calculate Revenue
      ↓
Submit Daily Report
      ↓
Admin Reviews Report
      ↓
Admin Approves Report
      ↓
View Dashboard
```

The system must maintain accurate inventory throughout the process.

---

# 43. Acceptance Criteria

## Authentication

- Users can securely log in.
- Users receive permissions according to their roles.
- Unauthorized users cannot access protected resources.

## Branches

- Admin can create branches.
- Admin can assign managers.
- Managers can only access their branch.

## Deliveries

- Admin can create fuel orders.
- Admin can record actual deliveries.
- Inventory increases according to actual quantity received.

## Sales

- Manager can record litres sold.
- System calculates revenue automatically.
- Inventory decreases accordingly.

## Reports

- Manager can submit a daily report.
- Admin can approve/reject reports.
- Rejected reports include a reason.
- Managers can resubmit corrected reports.

## Dashboard

- Admin can view branch statistics.
- Admin can view inventory.
- Admin can view sales.
- Admin can view revenue.

## Audit

- Important operations are recorded.
- Audit records identify the responsible user and timestamp.

---

# 44. Security Acceptance Criteria

The MVP must pass tests for:

- Role-based access control
- Branch-level authorization
- IDOR/BOLA
- Mass assignment
- SQL injection
- JWT security
- Password security
- Input validation
- Unauthorized inventory modification
- Unauthorized report modification
- Unauthorized access to another business
- Rate limiting
- Sensitive data exposure

---

# 45. Development Phases

## Phase 0 — Product Planning

Deliverables:

- PRD
- System architecture
- Database design
- API specification
- UI/UX wireframes

---

## Phase 1 — Project Foundation

Deliverables:

- Backend project
- Frontend project
- Database
- Environment configuration
- Swagger
- Logging
- Basic CI/CD

---

## Phase 2 — Authentication & Authorization

Deliverables:

- Login
- Logout
- Password reset
- JWT
- RBAC
- Branch-level authorization

---

## Phase 3 — Business & Branch Management

Deliverables:

- Business
- Branches
- Managers
- User management

---

## Phase 4 — Fuel & Supplier Management

Deliverables:

- Fuel types
- Fuel prices
- Price history
- Suppliers
- Tankers

---

## Phase 5 — Orders & Deliveries

Deliverables:

- Fuel orders
- Tanker assignment
- Delivery recording
- Delivery discrepancy tracking

---

## Phase 6 — Inventory

Deliverables:

- Inventory ledger
- Inventory transactions
- Stock calculations
- Inventory history

---

## Phase 7 — Sales

Deliverables:

- Sales recording
- Automatic revenue calculation
- Inventory deduction

---

## Phase 8 — Daily Reports

Deliverables:

- Report creation
- Report submission
- Approval/rejection
- Resubmission

---

## Phase 9 — Dashboard & Analytics

Deliverables:

- Admin dashboard
- Manager dashboard
- Branch statistics
- Sales charts
- Inventory charts

---

## Phase 10 — Reports & Export

Deliverables:

- Daily reports
- Branch reports
- Inventory reports
- Revenue reports
- Excel/PDF/CSV export

---

## Phase 11 — Security & QA

Deliverables:

- Unit tests
- Integration tests
- E2E tests
- Security testing
- Performance testing
- Access-control testing

---

## Phase 12 — Sponsor Demo

Deliverables:

- Production-like environment
- Demo accounts
- Sample data
- Demonstration workflow
- Presentation dashboard
- Product pitch

---

# 46. Future Product Vision

After the MVP, K.B.Y GLOBAL INVESTMENT can evolve into a comprehensive fuel station management platform.

Potential future capabilities:

```text
                    K.B.Y PLATFORM
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
     Inventory          Sales           Finance
        │                 │                 │
     Tankers           Pumps          Expenses
     Deliveries        Nozzles         Payments
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                     Analytics
                          │
                Business Intelligence
```

Eventually the platform could support:

- Pump integration
- Automated meter readings
- Cash reconciliation
- Expense management
- Supplier management
- Accounting integration
- Mobile applications
- WhatsApp/SMS notifications
- AI-powered business analytics
- Demand forecasting
- Loss detection
- Multi-company SaaS functionality

---

# 47. Product Positioning

The platform should be positioned as:

> **A centralized fuel station operations, inventory, sales, and accountability platform.**

Rather than simply:

> "A fuel sales reporting system."

The value proposition is:

> **Know what came in, where it went, what was sold, what remains, and what the business should have earned.**

---

# 48. Long-Term Business Opportunity

Although the initial implementation is for K.B.Y GLOBAL INVESTMENT, the architecture should allow the platform to become a commercial SaaS product.

Potential model:

```text
Fuel Station Owner
        │
        ▼
Subscribe to Platform
        │
        ▼
Create Business
        │
        ├── Branch 1
        ├── Branch 2
        ├── Branch 3
        └── Branch N
```

Potential pricing could eventually be based on:

- Number of branches
- Number of users
- Features
- Monthly subscription
- Enterprise plan

This should not complicate the MVP but should influence architectural decisions.

---

# 49. Final Product Principle

The most important principle of the platform is:

> **Every litre should be accountable.**

A litre should be traceable from:

```text
Supplier
   ↓
Fuel Order
   ↓
Tanker
   ↓
Delivery
   ↓
Branch Inventory
   ↓
Sale
   ↓
Revenue
```

This principle should guide the database architecture, business logic, user permissions, audit system, reporting system, and future integrations.

---

# 50. Definition of MVP

The K.B.Y GLOBAL INVESTMENT MVP is complete when:

1. Super Admin can manage business accounts.
2. Admin can manage branches and managers.
3. Admin can create fuel orders.
4. Admin can manage tankers and deliveries.
5. The system records actual delivered fuel.
6. Branch inventory is automatically updated.
7. Managers can record fuel sales.
8. Revenue is calculated automatically.
9. Inventory is automatically reduced after sales.
10. Managers can submit daily reports.
11. Admin can approve/reject reports.
12. Admin can monitor all branches from one dashboard.
13. The system maintains an audit trail.
14. Users cannot access data outside their permissions.
15. Reports can be generated from the recorded operational data.
16. The complete process can be demonstrated end-to-end to a sponsor.

---

# 51. Next Documentation Artifacts

This PRD should serve as the foundation for the following documents:

```text
01-product-requirements.md
        ↓
02-system-architecture.md
        ↓
03-database-design.md
        ↓
04-api-specification.md
        ↓
05-ui-ux-design.md
        ↓
06-mvp-roadmap.md
        ↓
GitHub Issues
        ↓
Implementation
```

The next document should be **`02-system-architecture.md`**, which will translate these requirements into the actual technical architecture for the NestJS backend, Next.js frontend, PostgreSQL database, authentication/authorization, inventory engine, APIs, and deployment infrastructure.