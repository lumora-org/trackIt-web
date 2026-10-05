# trackIt-web

Frontend for **K.B.Y GLOBAL INVESTMENT** — a multi-branch fuel station management platform.

Managers run a branch: record sales, check inventory, receive deliveries, submit daily reports.
Administrators configure the business: fuel types, prices, suppliers, tankers, fuel orders.
Super administrators operate the platform.

---

## Stack

| Concern       | Choice                                            |
| ------------- | ------------------------------------------------- |
| Framework     | Next.js 16 (App Router, Turbopack)                |
| Language      | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling       | Tailwind CSS v4, mobile-first                     |
| Server state  | TanStack Query v5                                 |
| Forms         | React Hook Form + Zod                             |
| API mocking   | MSW v3                                            |
| Tests         | Vitest + Testing Library                          |
| Lint / format | ESLint 9 (flat config) + Prettier                 |

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app ships with a **mock API** enabled by default, so it runs without a backend.
Demo accounts (password `Password123!` for all):

| Role          | Email                      | Scope          |
| ------------- | -------------------------- | -------------- |
| `SUPER_ADMIN` | `superadmin@kbyglobal.com` | Platform       |
| `ADMIN`       | `admin@kbyglobal.com`      | Whole business |
| `MANAGER`     | `manager@kbyglobal.com`    | KBY Ikeja only |

### Connecting the real backend

```bash
# .env.local
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

No component changes are required — only the base URL moves.

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest run
npm run verify       # typecheck + lint + test
```

## Documentation

The `docs/` folder is the source of truth. Read it before changing anything.

- `PROMPT.md` — the implementation brief and the 20-step build order
- `docs/01`–`docs/09` — product requirements, architecture, database, API contract, auth, and each
  business module
- `docs/ASSUMPTIONS.md` — **every** place the docs are silent or self-contradictory, and the
  decision taken. Update this when behaviour changes.

## Conventions

- **Mobile-first.** Design from 320px up; add breakpoints, never subtract them.
- **The backend is authoritative.** The UI never computes an authoritative price, total, balance,
  or authorization decision. It renders what the API returns.
- **Role-aware UX, not security.** `src/lib/permissions.ts` decides what to _render_; the backend
  decides what is _allowed_.
- **Every screen has four states:** loading, success, empty, error — see `src/components/ui/states.tsx`.
- **Money and quantities are formatted centrally** in `src/lib/format.ts` (₦, thousands separators,
  3-decimal litres). Never format inline.
- **No `any`.** TypeScript strict mode is enforced in CI.

## License

See [LICENSE](./LICENSE).
