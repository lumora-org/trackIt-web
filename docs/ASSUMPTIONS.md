# Implementation Assumptions & Documentation Contradictions

This file records every point where the documentation is **silent**, **self-contradictory**, or
**ambiguous**, together with the decision taken and how to change it later.

It exists because `PROMPT.md` §30 requires:

> Do not silently invent major business rules.

and §37 requires:

> If something is genuinely unspecified, choose the simplest production-ready solution that fits
> the existing architecture and **document the assumption** before implementing it.

---

## 1. Source-of-truth hierarchy

| Rank | Document | Rationale |
|---|---|---|
| 1 | `docs/04-api-specification.md` | Labelled **"MVP API Contract"**; 100+ self-consistent examples; the backend was built against it. |
| 2 | `docs/03 — Database Design.md` | Authoritative for PostgreSQL enums, column types, and constraints. |
| 3 | `docs/06 — Auth`, `docs/07 — Users`, `docs/05 — Backend` | Detailed where doc 04 is silent. |
| 4 | `docs/02 — Architecture` | Planning doc; superseded by doc 04 on the wire format. |
| 5 | `docs/08`, `docs/09` | Design proposals. Almost every endpoint is labelled *"Recommended"*. |

Where a lower-ranked document contradicts a higher-ranked one, the higher-ranked document wins.

---

## 2. Resolved contradictions

### 2.1 Response envelope

| Document | Shape |
|---|---|
| `04` §6 | `{ data }` / `{ data, meta }` |
| `02` §37 | `{ success, message, data }` / `{ success, false, message, error }` |

**Decision:** `{ data, meta }` is canonical. `unwrapEnvelope()` in `src/api/client.ts` also accepts
the doc 02 shape and tolerates optional `success` / `message` / `error` keys, so neither choice
breaks the client.

*Change if wrong:* `unwrapEnvelope()` and `normalizeApiError()` are the only two functions involved.

### 2.2 Login response shape

`04` §11 wraps in `data` and includes `expiresIn: 900`. `06` §12 shows the same payload **bare**
and without `expiresIn`.

**Decision:** accept both — read `data` first, fall back to the root object, treat `expiresIn` as
optional. Access-token field name is `accessToken` (camelCase) in both documents.

### 2.3 `/auth/me` shape

`04` §16 puts the user at `data` (not `data.user`), unlike `/auth/login`.

**Decision:** typed as `AuthenticatedUser` returned directly from `data`.

### 2.4 Error code field: `code` vs `error`

`04` §7 uses `code`; `02` §37 uses `error`. **Decision:** read `code` first, then `error`.

### 2.5 Money on the wire: `number` vs `string`

`05` §27 notes PostgreSQL `NUMERIC` is commonly serialised as a string; `05` §28 and *every* JSON
example in `04` use bare numbers.

**Decision:** wire types are `number`. All display helpers (`formatCurrency`, `formatLitres`, …)
accept `number | string` and coerce, so a string-serialising backend works without a type change.

### 2.6 Inventory transaction types

`01` §13 lists `DELIVERY, SALE, ADJUSTMENT, TRANSFER (future), CORRECTION`.
`03` §17 defines the SQL enum with `OPENING_BALANCE`, `TRANSFER_IN`, `TRANSFER_OUT`.

**Decision:** use the `03` §17 enum (`src/types/domain.ts`). `TRANSFER_*` are defined but no UI
exposes them — `03` §17 says they "may not be exposed in the initial MVP".

### 2.7 Delivery difference sign

`01` §11 shows an unsigned `150 L`; `03` §42 defines `difference = actual − expected`, i.e. `−150 L`
on a short delivery.

**Decision:** signed. `SIGNED` values render green when positive, red when negative.

### 2.8 Fuel-price endpoints

`08` §45–52 proposes `GET /fuel-prices/current` (array), `/history`, `/scheduled`, `/change`,
`/:id/cancel`. `04` §29–31 specifies `GET /fuel-prices`, `GET /fuel-prices/current/:fuelTypeId`,
`POST /fuel-prices` only.

**Decision:** implement **doc 04**. Price history is derived from `GET /fuel-prices` filtered by
`fuelTypeId` and sorted by `effectiveFrom` — no extra endpoint needed.

### 2.9 Activate/deactivate sub-resource

`08` §12 and `09` §16 define `PATCH /{resource}/:id/status`. Doc 04 omits it for fuel types,
suppliers and tankers, but *does* define `PATCH /users/:id/status`.

**Decision:** not called by the UI. Status changes go through the resource's own `PATCH` endpoint.
If the backend exposes `/status`, add the call in `src/api/*.api.ts` — no UI change needed.

### 2.10 Daily-report resubmit target

`04` §71 defines `POST /daily-reports/:id/resubmit` with `REJECTED → DRAFT`. `02` §30 shows
`REJECTED → CORRECTED → RESUBMITTED`.

**Decision:** `REJECTED → DRAFT`, per doc 04.

### 2.11 Order / sale number format

`01` §9 shows `ORD-000001`; `03` §38 and `09` §8 show `ORD-{YEAR}-{SEQUENCE}`.
`01` §9 and `03` §53 agree on `SALE-2026-000001`.

**Decision:** `ORD-2026-000001` and `SALE-2026-000001`. The frontend **never generates** these
(`09` §8) — it always reads them from the response.

---

## 3. Genuine gaps — documentation is silent

### 3.1 No low-stock / reorder threshold exists

`lowInventoryBranches` (`04` §76) and "Low-stock indicators" (`04` §78) are documented outputs, but
there is **no** `reorder_level` or `minimum_level` column in `03`, and `LOW_INVENTORY` has no
documented trigger.

**Decision:** the dashboard renders whatever `lowInventoryBranches` the API returns and does not
attempt to compute it. There is no low-stock client-side UI. If the backend later returns a
threshold, the `StatCard` is already in place.

### 3.2 No delivery variance tolerance

`04` §49 says "validate actual quantities" but no threshold, percentage, or litre value is given.
`DISPUTED` has no documented trigger.

**Decision:** the receiving UI shows expected, actual, and computed variance, and prompts for a
discrepancy reason whenever variance ≠ 0. It does **not** auto-block on a threshold, because no
threshold is defined. The server remains authoritative.

### 3.3 `UNDER_REVIEW` daily-report state is unreachable

Present in the `03` §18 enum and the `05` §57 diagram, but **no endpoint sets it** and none clears it.

**Decision:** `UNDER_REVIEW` is typed and rendered by `StatusBadge`, but no transition targets it.

### 3.4 No dispute-resolution path

`DISPUTED` is terminal in `05` §60 — there is no documented route back to `RECEIVED`.

**Decision:** disputed deliveries are read-only in the UI.

### 3.5 Branch fields listed in the PRD do not exist

`01` §20 lists a branch "Manager" and "Opening date". Neither is a column in `03` §27; the manager
comes from `users.branch_id`.

**Decision:** the branch form has name, code, address, phone, status only.

### 3.6 Audit log has no `role` column

`01` §25 requires the role on an audit record; `03` §60 defines `action` as `VARCHAR(100)` and has no
`role` column.

**Decision:** the audit table shows the actor id and joins the name client-side where the user list
is already loaded. No `role` is invented.

### 3.7 `GET /dashboard/inventory` has no documented response

`04` §78 lists contents in prose only — no field names, no query parameters.

**Decision:** the dashboard uses `GET /dashboard/admin` and `GET /dashboard/manager`, which *are*
documented with full examples. `/dashboard/inventory` is not called.

### 3.8 No polling / caching guidance

No document specifies a refresh interval. `05` §117 warns only that **current inventory must not
come from a stale cache**.

**Decision:** `staleTime` 30 s, `refetchOnWindowFocus` on, notifications poll every 60 s, and
inventory queries are never cached beyond `staleTime`. These are assumptions, not requirements.

### 3.9 Token storage is undocumented

No document mentions cookies or web storage. The only documented transport is
`Authorization: Bearer <access-token>` (`06` §7) with both tokens in the JSON body (`04` §11).

**Decision (confirmed with the product owner):** access token in **memory only**, refresh token in
an **httpOnly, Secure, SameSite cookie** so JavaScript can never read it. The client registers a
refresh-token reader with the API client and transparently retries once on a `401`.

*Note:* `04` §13 requires `refreshToken` in the **logout body**, which is incompatible with a
strictly cookie-only design. The mock reads the cookie; if the real backend demands the body field,
the refresh token must be supplied by the server component that owns the cookie.

### 3.10 Zero documented validation rules for suppliers and tankers

`09` documents no DTOs at all. Only `capacityLitres > 0` (tankers) and per-business uniqueness are
specified (`03` §36).

**Decision:** client-side validation covers the documented constraints plus obviously-safe format
checks (required fields, email shape, phone shape). The server remains authoritative; server field
errors are mapped onto form fields via `ApiError.fieldError()`.

### 3.11 No notification response example

`04` §72–74 give endpoints and filters but no payload. Field names are inferred from the `03` §59
table in camelCase.

**Decision:** `resourceType`, `resourceId`, `readAt` are modelled as possibly absent.

### 3.12 Empty fuel order

`09` never states whether a `DRAFT` order must contain at least one item.

**Decision:** the create form requires ≥ 1 line item (an order with nothing in it is not a real
procurement commitment), but this is flagged as an **assumption**, not a documented rule.

### 3.13 Who may receive a delivery

`01` §29 and §7 give managers "fuel delivery confirmation". `04` §48 restricts `POST /deliveries`
to `ADMIN` / `SUPER_ADMIN` and lists **no roles** for `/receive` or `/dispute`.

**Decision:** the mock allows `SUPER_ADMIN`, `ADMIN`, and branch-scoped `MANAGER` on
`/receive` and `/dispute`, matching the PRD's intent. The real backend is authoritative — a `403`
is surfaced as an error, never hidden.

### 3.14 Numeric precision in the browser

`03` §8–9 forbid float arithmetic for money and quantities; `05` §27 warns against naive JS floats.

**Decision:** the frontend never does *authoritative* arithmetic — every total, price, and balance
comes from the API. Display-only multiplication (e.g. litres × unit price on the sale preview) uses
`toAmount()` and is always labelled "Estimated"; the backend recomputes on submit.

---

## 4. Out of MVP scope

Per `01` §30, deliberately **not** built: mobile apps, pump/meter integration, automated pump
readings, cash reconciliation, payroll, expenses, supplier payments, customer management, loyalty,
POS integration, payment gateways, SMS/WhatsApp, accounting integrations, AI analytics, advanced
forecasting, SaaS billing.

---

## 5. Mock API

No backend is available yet, so `src/mocks/` implements the doc 04 contract with seeded data.

- Enabled by default; disable with `NEXT_PUBLIC_USE_MOCK_API=false`.
- In mock mode the API base URL is **relative**, because the MSW worker serves `/api/v1/*` from the
  page's own origin.
- Mock handlers deliberately enforce the documented authorization rules, so the frontend cannot
  appear to work in a place the real backend would return `403`.
- No business data from `src/mocks/data.ts` may be imported by anything under `src/app/`
  (PROMPT.md §29 bans hardcoded business data).
