# SANIA Growth Partner — Internal Ops

Internal operations app for **SANIA Growth Partner**, a marketing agency for HVAC companies
(public site: <https://terencengoh.github.io/sania-marketing/>).

Live app (GitHub Pages): <https://terencengoh.github.io/sania-internal/>

It's a static single-page app (Vite + React + TypeScript) with two modes:

- **DEMO mode** (what's live now): no server and no real accounts. The login page offers **Demo staff** and **Demo client** buttons, and data stays in this browser. *Not real security.*
- **LIVE mode**: real logins and a shared database on **Supabase** (free plan), with roles **owner / staff / client** and an invite-only **Client Portal**. It switches on automatically when the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` GitHub secrets are set. Step-by-step guide: **[SETUP.md](SETUP.md)**.

There is no payment processing. The app itself sends no email or messages: invoices and reports are printed or saved as PDF. In live mode the only emails are Supabase's invite, sign-in link and password-reset emails.

## What's inside

| Area | What it does |
| --- | --- |
| **Dashboard** | MRR, paid this month, outstanding/overdue, open pipeline value and win rate, active campaigns, overdue tasks, follow-ups due, tasks due this week, 6-month invoiced vs paid chart, pipeline by stage. |
| **Leads & pipeline** | HVAC company leads with contact info, source, est. monthly value, services of interest, next follow-up date and a notes/activity log. Kanban board (drag between *New → Contacted → Call booked → Proposal sent → Won / Lost*) or table view. CSV export. **Won → convert to client** creates the client record and links it back to the lead. |
| **Clients** | Retainer, status (Active/Paused/Ended), services, notes, and a client page showing its campaigns, open tasks, invoices, balance due and reports. CSV export. |
| **Campaigns** | Per-client campaigns by channel (Google Ads, Local Services Ads, SEO, Facebook/Meta, Email, Website, Google Business Profile…), status, monthly ad budget, goal and a deliverables checklist with progress. |
| **Task board** | Kanban (*To do → In progress → Review → Done*) with assignees, due dates and priority; filters by person/client; **Overdue** view; list view. Team members are edited in Settings. |
| **Invoices** | Line items, statuses *Draft / Sent / Paid / Void* (+ automatic **Overdue** when a sent invoice passes its due date), auto-numbering, one-click "generate retainer invoices" for a month (drafts only, skips clients already billed), duplicate, record payment date, and a branded **printable invoice / Save as PDF** via print CSS. |
| **Revenue** | MRR (sum of active retainers), run-rate, paid this month, outstanding, overdue, paid vs billed, 12-month invoiced vs paid, per-client totals. All computed only from what you enter. |
| **Client reports** | Monthly report per client: enter spend, impressions, clicks, leads, calls, booked jobs and (optional) client-reported revenue. Calculates cost per lead, cost per booked job, CTR, click→lead rate and ROAS, compares against last month, and prints a branded report/PDF. |
| **Login & roles** | SANIA-branded login. Owner/staff get the internal app. Client users get the **Client Portal**: their campaigns and deliverable progress, Sent/Paid invoices (print/PDF), published monthly reports, and an account page with password change. Sign out everywhere. |
| **Users & access** | Settings → invite client users (from a client's page too) or staff (owner only), change roles, link a client user to a company, remove access, see pending invitations. |
| **Settings & backup** | Agency details shown on documents, invoice prefix/next number/terms, team list, **JSON export/import backup**, **Clear demo data**, delete all. |

## Demo data

On first load the app is filled with **fictional demo data** so every screen can be tried. Every demo
company, person, email (`example.com`), phone number (`555-01xx`) and figure is made up. Demo
records show a dashed **DEMO** tag and a banner appears while any exist.

**Settings → Clear demo data** removes every demo record (and anything you created for a demo client)
and keeps your own entries. **Load demo data** brings it back.

## Where data is stored (important)

In **LIVE mode** data is in your Supabase Postgres database, protected by Row Level Security (`supabase/migrations/`). The rest of this section is about **DEMO mode**, where all data lives in **this browser's `localStorage`** (key `sania-internal:data:v1`) on the device you use.

- It does **not** sync between computers, phones, browsers or browser profiles.
- Clearing site data, using a private/incognito window, or some browser cleanup tools will erase it.
- Use **Settings → Export backup (JSON)** regularly and keep the file somewhere safe; **Import backup**
  restores it (it replaces the current data after a confirmation).
- Only one person can realistically use it at a time (whoever holds the browser). Two tabs in the
  same browser stay in sync.

## Supabase (live mode)

- `supabase/migrations/`: tables for leads, clients, contacts, notes, campaigns, deliverables, tasks, team, invoices, invoice items, reports (with a `published` flag), settings, profiles (role + client link) and invitations, plus all Row Level Security policies.
- `supabase/functions/invite-user/`: Edge Function that sends invite emails. The service-role key stays on the server.
- `supabase/tests/`: PGlite (Postgres in WebAssembly) tests that run the real migrations and prove:
  - a client user can't read another client's data or any internal data (leads, notes, tasks, drafts, unpublished reports)
  - client users can't write anything
  - nobody can raise their own role
  - the app's data maps 1:1 onto the schema
- `src/backend/`: storage abstraction. `local.ts` is demo mode; `supabase.ts` is live mode, which loads with RLS applied and saves only the rows that changed.

Full go-live steps: **[SETUP.md](SETUP.md)**.

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build to dist/
npm run preview   # serve the built app
npm test          # unit tests + database/RLS tests (PGlite, no server needed)
```

Routing uses the URL hash (`#/invoices/…`), so it works on GitHub Pages without server config.

## Deploy

- `.github/workflows/ci.yml` — tests (incl. RLS) + type-check + build on every push/PR.
- `.github/workflows/pages.yml` — two jobs: **build** (uploads `dist/` with
  `actions/upload-pages-artifact`) and **deploy** (`actions/deploy-pages`).
- One-time setup: repo **Settings → Pages → Source: GitHub Actions**, then re-run the
  "Deploy GitHub Pages" workflow.

## Limits / not included

- No email sending, payment collection, ad-platform API sync or call-tracking import — KPIs are typed in.
- Drag-and-drop on the boards needs a mouse; on phones, open a card and change its stage/status.
- Demo mode: single-browser storage and no real security, as described above.
- Live mode: last save wins if two people edit the same record at once. There is no live co-editing.
