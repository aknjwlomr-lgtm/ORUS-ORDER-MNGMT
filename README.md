# 🎂 Alpha Bakery Order Manager

A **mobile-first PWA** to receive, manage, track and analyse cake orders for **Alpha Bakery**.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma 6 · Supabase (PostgreSQL) · NextAuth v5 · Recharts.

---

## Features

- 🔐 **Secure login** with role-based access — **Admin** (full control) and **Staff** (limited).
- 📅 **Calendar landing page** — month view with per-day order badges, status dots, search & filters, and a day detail panel with a daily summary.
- ➕ **New Order** — a 6-section form (Customer · Cake · Delivery · Pricing · Production · Confirm) with live total/balance calculation, existing-customer lookup & auto-fill, validation, and auto-generated order numbers (`ALPHA-ORD-0001`).
- 📋 **Orders** — searchable, filterable list; full order detail with **timeline**, payments, edit and a printable **receipt**.
- 🔔 **Reminders** — grouped Today / Overdue / Upcoming / Completed, with complete/snooze/miss actions.
- 📊 **Reports** — dashboard cards + charts (daily orders, category/flavor split, payment-mode collection, delivery vs pickup, status split) and **CSV export**.
- 💬 **WhatsApp-ready** — Call & WhatsApp buttons open `tel:` / `wa.me` with pre-filled confirmation / payment / delivery messages.
- 📱 **PWA** — installable, themed, mobile bottom-nav + desktop sidebar. Currency is **₹ (INR)**.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string** — copy the **Transaction pooler** (port `6543`) and the **direct** connection (port `5432`).
3. Copy `.env.example` to `.env` and fill them in:
```env
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
AUTH_SECRET="..."   # run: npx auth secret
AUTH_TRUST_HOST="true"
```

### 3. Create the database tables (no SQL needed — Prisma does it)
```bash
npx prisma migrate dev --name init
```

### 4. Seed demo data (2 users, 5 customers, 12 orders, reminders)
```bash
npm run db:seed
```

### 5. Run
```bash
npm run dev
```
Open <http://localhost:3000>.

### Demo logins
| Role  | Email                | Password   |
|-------|----------------------|------------|
| Admin | admin@alpha.bakery   | `admin123` |
| Staff | staff@alpha.bakery   | `staff123` |

---

## Handy scripts
| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Create/apply migrations (`prisma migrate dev`) |
| `npm run db:push` | Push schema without a migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |

---

## Notes & next steps
- **Icons:** a placeholder `public/icon.svg` is used for the PWA. Generate proper `192×192` / `512×512` PNGs (e.g. [realfavicongenerator.net](https://realfavicongenerator.net)) for full install coverage.
- **WhatsApp** uses click-to-chat links (`wa.me`). Wire up the WhatsApp Business API later for automated sending.
- **Reference image upload** is stubbed (URL field); add Supabase Storage for real file uploads.
- **Reports** export to CSV today; PDF/Excel can be added with `jsPDF` / `SheetJS`.
- User-management UI (admin creating staff) can be added under a `/users` route — the `User` model and role checks are already in place.
