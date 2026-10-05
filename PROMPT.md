# K.B.Y GLOBAL INVESTMENT — Frontend Implementation Prompt

You are the lead frontend engineer responsible for building the web platform for **K.B.Y GLOBAL INVESTMENT**, a multi-branch fueling-station management platform.

The frontend codebase is located in this repository.

## IMPORTANT: READ THE DOCUMENTATION FIRST

Before writing, modifying, deleting, or generating application code, you MUST inspect the entire `docs/` directory in this repository.

The documentation is the primary source of truth for:

- Product requirements
- Business rules
- User roles
- Application workflows
- Database concepts
- API expectations
- Fuel management
- Supply chain
- Fuel orders
- Deliveries
- Inventory
- Sales
- Revenue
- Daily reports
- Audit requirements
- Notifications
- Authorization boundaries

Do NOT start implementation based only on this prompt.

First understand the complete project scope from the documentation.

If the documentation and an implementation assumption conflict, the documentation takes precedence.

If something is genuinely unspecified, choose the simplest production-ready solution that fits the existing architecture and document the assumption before implementing it.

---

# 1. Product

The product is a fueling-station management platform for:

**K.B.Y GLOBAL INVESTMENT**

The system manages multiple fueling-station branches and provides centralized operational visibility.

The primary users are:

```text
SUPER_ADMIN
ADMIN
MANAGER
```

The platform must support:

```text
Authentication
User management
Business management
Branch management
Fuel types
Fuel pricing
Suppliers
Tankers
Fuel orders
Deliveries
Inventory
Sales
Revenue
Daily reports
Notifications
Audit visibility
Dashboard / analytics
```

---

# 2. Primary Frontend Goal

Build a professional, production-quality web platform using a:

> **Mobile-first responsive design approach**

The application must work extremely well on:

- Mobile phones
- Tablets
- Laptops
- Desktop monitors

Do NOT build desktop screens first and then attempt to make them responsive.

Design the UI from the smallest viewport upward.

---

# 3. UX Philosophy

The application is used by people operating a real fueling business.

The interface should therefore prioritize:

- Speed
- Clarity
- Simplicity
- Large touch targets
- Minimal unnecessary navigation
- Clear financial information
- Clear inventory information
- Fast data entry
- Strong visual hierarchy
- Useful empty states
- Useful loading states
- Clear errors
- Confirmation for destructive operations

Avoid creating an overly complicated enterprise interface.

The user should be able to understand the current state of the business quickly.

---

# 4. Mobile-First Requirements

Every feature must be designed for mobile first.

Use:

```text
320px+
375px+
390px+
430px+
768px+
1024px+
1280px+
1440px+
```

as practical responsive targets.

The UI must not depend on:

- Hover interactions
- Large desktop-only tables
- Tiny buttons
- Horizontal scrolling wherever avoidable
- Desktop navigation assumptions

For mobile:

Use:

```text
Bottom navigation
Mobile drawer
Stacked cards
Responsive forms
Compact filters
Action sheets
Responsive tables
```

where appropriate.

For desktop:

Use:

```text
Sidebar navigation
Top navigation
Multi-column dashboards
Expanded data tables
Desktop filters
```

---

# 5. Responsive Navigation

The navigation must adapt based on viewport size.

## Mobile

Prefer:

```text
Top bar
+
Bottom navigation
+
More/menu drawer
```

The most important manager actions should be easy to reach.

Example:

```text
Dashboard
Sales
Inventory
Reports
More
```

## Desktop

Use:

```text
Sidebar
Top bar
Main content
```

The sidebar should group related functionality.

Example:

```text
Dashboard

Operations
  Sales
  Inventory
  Deliveries
  Daily Reports

Procurement
  Fuel Orders
  Suppliers
  Tankers

Configuration
  Fuel Types
  Fuel Prices
  Branches
  Users

System
  Notifications
  Audit Logs
```

Navigation must be role-aware.

---

# 6. Role-Based UI

The backend remains the final authority for authorization.

The frontend must still provide role-aware UX.

## SUPER_ADMIN

Platform-level functionality.

Potential access:

```text
Businesses
Branches
Users
System administration
Audit logs
Platform dashboard
```

## ADMIN

Business owner/operator.

Access includes:

```text
Dashboard
Branches
Managers
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
Reports
Audit visibility
```

## MANAGER

Branch-scoped.

Access includes:

```text
Dashboard
Sales
Inventory
Deliveries
Daily Reports
Notifications
```

A manager must not be presented with another branch's data.

Do not rely on hiding buttons for security.

The backend determines authorization.

---

# 7. Business and Branch Context

The frontend must clearly communicate the active business and branch context.

For managers:

```text
Business:
K.B.Y GLOBAL INVESTMENT

Branch:
KBY-IKEJA
```

The manager should not be able to manually switch to another branch.

For administrators, branch filters may be available.

---

# 8. Dashboard

The dashboard should be one of the most polished areas of the application.

The dashboard should provide a quick operational overview.

Possible cards:

```text
Today's Revenue
Fuel Sold
Fuel Received
Current Inventory
Pending Deliveries
Pending Reports
Low Inventory
```

Example:

```text
Today's Revenue

₦118,500,000
```

```text
Fuel Sold

78,500 L
```

```text
Fuel Received

110,000 L
```

```text
Pending Reports

3
```

Use charts where they genuinely help.

Possible charts:

```text
Revenue by Day
Sales by Fuel Type
Branch Revenue
Inventory by Fuel Type
```

Do not overload the dashboard with charts.

---

# 9. Sales UX

Sales is a critical manager workflow.

The flow should be extremely fast.

Example mobile flow:

```text
Sales
  ↓
Select Fuel
  ↓
Enter Litres
  ↓
Show Current Price
  ↓
Show Total Revenue
  ↓
Confirm
  ↓
Sale Successful
```

Example:

```text
PMS

Current Price
₦1,500 / L

Litres
[ 8,500 ]

Estimated Total
₦12,750,000

[ Record Sale ]
```

The frontend must NOT allow users to override the backend price.

The backend is authoritative.

After success show:

```text
Sale Recorded

SALE-2026-000001

8,500 L
₦1,500/L
₦12,750,000
```

---

# 10. Inventory UX

Inventory should be easy to understand at a glance.

Example:

```text
Current Inventory

PMS
86,500 L

AGO
42,000 L

DPK
15,500 L
```

Each fuel type should allow viewing:

```text
Current stock
Recent movements
Deliveries
Sales
Adjustments
```

Inventory history should clearly show:

```text
Date
Type
Quantity
Balance
Reference
```

Positive and negative movements must be visually distinguishable.

---

# 11. Delivery Receiving UX

Receiving a tanker is an operationally important workflow.

The mobile interface should make it easy for a manager to:

```text
Select delivery
Review order
View tanker
View driver
View expected quantity
Enter actual quantity
See variance
Add discrepancy reason
Accept / dispute
```

Example:

```text
PMS

Expected
45,000 L

Actual
44,850 L

Variance
-150 L

Reason
[ Short delivery ]

[ Receive Delivery ]
[ Dispute ]
```

The UI should clearly warn the manager when there is a discrepancy.

---

# 12. Fuel Orders UX

Administrators should be able to:

```text
Create order
Select supplier
Select destination branch
Add fuel types
Enter quantities
Enter procurement cost
Set expected delivery date
Submit
Confirm
Track status
```

Order status should have clear visual indicators.

Example:

```text
DRAFT
SUBMITTED
CONFIRMED
IN TRANSIT
PARTIALLY DELIVERED
DELIVERED
CANCELLED
```

Use consistent status badges throughout the application.

---

# 13. Fuel Pricing UX

Pricing is historical and time-based.

The interface should make this understandable.

Example:

```text
PMS

Current Price
₦1,600 / L

Price History

Oct 18
₦1,600

Oct 10
₦1,550

Oct 01
₦1,500
```

When creating a price:

```text
Fuel
PMS

Price
₦1,600

Effective From
18 Oct 2026
```

The frontend should warn users about scheduled/future pricing.

---

# 14. Daily Reports UX

Managers should have a very simple daily-report workflow.

Example:

```text
Daily Report
05 October 2026

Opening Stock
86,500 L

Fuel Received
45,000 L

Fuel Sold
20,000 L

Closing Stock
111,500 L

Revenue
₦30,000,000

Notes
[ ... ]

[ Submit Report ]
```

These values should primarily come from backend calculations.

Do not allow the frontend to become the source of truth.

Show:

```text
DRAFT
SUBMITTED
UNDER REVIEW
APPROVED
REJECTED
```

with clear status indicators.

---

# 15. Notifications

Implement a notification center.

Examples:

```text
Delivery received
Delivery discrepancy
Daily report submitted
Daily report approved
Daily report rejected
Low inventory
```

Unread notifications should be visually obvious.

Example:

```text
🔔 3
```

Notifications should support:

```text
Mark as read
Mark all as read
Open related resource
```

---

# 16. Tables

Desktop can use tables.

Mobile should not simply render enormous desktop tables.

For mobile, transform records into cards.

Example:

Desktop:

```text
| Order | Supplier | Branch | Quantity | Status |
```

Mobile:

```text
ORD-2026-000001

Supplier A
KBY-IKEJA

45,000 L

IN TRANSIT
```

Use responsive data presentation.

---

# 17. Forms

Forms must:

- Have clear labels
- Use appropriate input types
- Validate immediately where useful
- Show server errors
- Preserve user input after validation failures
- Disable submit buttons during requests
- Prevent accidental duplicate submissions
- Display success feedback

Use reusable form components.

---

# 18. Loading States

Every API-driven screen must handle:

```text
Loading
Success
Empty
Error
```

Do not leave blank screens while requests are running.

Use:

```text
Skeletons
Spinners
Progress indicators
```

where appropriate.

---

# 19. Empty States

Do not simply display:

```text
No data
```

Use meaningful messages.

Example:

```text
No Fuel Orders

You haven't created any fuel orders yet.

[ Create Fuel Order ]
```

---

# 20. Error Handling

API errors must be translated into useful user-facing messages.

Example:

Instead of:

```text
400 Bad Request
```

show:

```text
Unable to record sale.

There is not enough PMS inventory available.
```

Authentication errors should redirect to login where appropriate.

Do not expose stack traces to users.

---

# 21. Authentication

Implement:

```text
Login
Logout
Forgot Password
Reset Password
Refresh Token
Session handling
```

Authentication tokens must be handled securely.

Never store sensitive secrets in source code.

Follow the backend's authentication contract.

---

# 22. API Client

Create a centralized API client.

Do not scatter raw `fetch()` or HTTP calls throughout components.

Recommended structure:

```text
src/
├── api/
│   ├── client.ts
│   ├── auth.api.ts
│   ├── sales.api.ts
│   ├── inventory.api.ts
│   ├── deliveries.api.ts
│   ├── fuel-orders.api.ts
│   ├── daily-reports.api.ts
│   └── notifications.api.ts
```

The API client should handle:

```text
Base URL
Authentication
Refresh token
Headers
Error normalization
Request cancellation where useful
```

---

# 23. State Management

Use the simplest state management solution appropriate for the chosen frontend framework.

Do not introduce unnecessary global state.

Separate:

```text
Server state
UI state
Authentication state
Form state
```

Prefer a dedicated server-state/query solution if the selected stack supports one.

---

# 24. Components

Build reusable components.

Examples:

```text
Button
Input
Select
DatePicker
Modal
Drawer
Card
Badge
Table
Pagination
EmptyState
ErrorState
LoadingState
ConfirmDialog
Toast
StatCard
CurrencyDisplay
QuantityDisplay
StatusBadge
```

Business-specific components:

```text
FuelCard
InventoryCard
SaleForm
DeliveryReceiveForm
FuelOrderForm
DailyReportSummary
RevenueChart
```

---

# 25. Formatting

Currency:

```text
₦
```

Use Nigerian formatting.

Example:

```text
₦12,750,000.00
```

Fuel quantities:

```text
8,500 L
```

Use consistent decimal formatting.

Dates should be human-readable while preserving timezone correctness.

---

# 26. Accessibility

The platform must support:

- Keyboard navigation
- Screen readers
- Proper labels
- Focus states
- Semantic HTML
- Sufficient contrast
- Accessible dialogs
- Accessible form errors

Touch targets should be large enough for mobile interaction.

---

# 27. Security

Never trust frontend authorization.

Never store:

```text
passwords
API secrets
private keys
```

in frontend code.

Never expose environment variables that should remain server-side.

Do not trust:

```text
businessId
branchId
role
price
totalAmount
```

received from the user interface.

The backend is authoritative.

---

# 28. Performance

Optimize for mobile networks.

Use:

```text
Lazy loading
Code splitting
Image optimization
Pagination
Debounced search
Request caching
Optimistic UI only where safe
```

Do not fetch thousands of records just to display the first page.

---

# 29. Project Quality

The frontend should include:

```text
ESLint
Prettier
TypeScript strict mode
Reusable components
Unit tests
Integration tests
E2E tests for critical flows
```

Avoid:

```text
any
duplicated API logic
duplicated UI logic
giant components
business logic inside presentation components
hardcoded business data
```

---

# 30. Documentation-Driven Development

Before implementing a feature:

1. Read the relevant documentation.
2. Identify the business rules.
3. Identify the API requirements.
4. Identify authorization requirements.
5. Identify the required UI states.
6. Implement.
7. Test.
8. Update documentation if implementation exposes a genuine missing requirement.

Do not silently invent major business rules.

---

# 31. Implementation Order

Implement incrementally in this order:

```text
1. Project foundation
2. Authentication
3. Application shell/navigation
4. Role-based routing
5. Business/branch context
6. Dashboard
7. Fuel types
8. Fuel pricing
9. Suppliers
10. Tankers
11. Fuel orders
12. Deliveries
13. Inventory
14. Sales
15. Daily reports
16. Notifications
17. Reports/analytics
18. Audit visibility
19. Responsive polish
20. Testing
```

Do not implement all modules in one uncontrolled change.

---

# 32. Git Discipline

Make changes in logical commits.

Example:

```text
feat: add authentication flow
feat: add responsive dashboard shell
feat: add fuel management
feat: add supplier management
feat: add fuel orders
feat: add delivery receiving
feat: add inventory management
feat: add sales workflow
feat: add daily reports
```

Do not mix unrelated features in one commit.

---

# 33. Definition of Done

A frontend feature is not complete merely because it renders.

It is complete when:

- The relevant documentation has been understood.
- The UI is mobile-first.
- Desktop responsiveness works.
- Loading state exists.
- Empty state exists.
- Error state exists.
- Authorization is respected.
- API integration works.
- Validation exists.
- Success feedback exists.
- Accessibility is considered.
- Tests exist for important behavior.
- No TypeScript errors remain.
- No lint errors remain.
- The implementation does not violate documented business rules.

---

# 34. First Task

Before implementing the application:

1. Inspect the repository.
2. Inspect the entire `docs/` folder.
3. Identify the frontend framework already configured.
4. Inspect package.json.
5. Inspect existing source files.
6. Inspect environment configuration.
7. Determine the current project state.
8. Create a concise implementation plan.
9. Identify documentation gaps or contradictions.
10. Only then begin implementation.

Do not replace the existing stack without a strong reason.

If the repository is empty, choose a modern production-ready TypeScript frontend stack suitable for a mobile-first business management application.

---

# 35. Final Instruction

You are not simply generating UI screens.

You are implementing a real operational platform.

Understand the business first.

Respect the documentation.

Respect the backend API contract.

Respect authorization boundaries.

Build mobile-first.

Keep the UI simple for branch managers.

Keep administrative workflows powerful but understandable.

Do not invent functionality that is outside the documented MVP unless clearly marked as a future enhancement.

Start by reviewing the `docs/` directory.