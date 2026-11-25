# SANIA Growth Partner — Internal Ops

Internal operations app for **SANIA Growth Partner**, a marketing agency for HVAC companies
(public site: <https://terencengoh.github.io/sania-marketing/>).

Live app (GitHub Pages): <https://terencengoh.github.io/sania-internal/>

It's a static single-page app (Vite + React + TypeScript). There is **no server, no account, no
paid service, and no payment processing**. The app never sends email or messages: invoices and
reports are printed or saved as PDF from the browser, and you send them yourself.

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
| **Settings & backup** | Agency details shown on documents, invoice prefix/next number/terms, team list, **JSON export/import backup**, **Clear demo data**, delete all. |

## Demo data

On first load the app is filled with **fictional demo data** so every screen can be tried. Every demo
company, person, email (`example.com`), phone number (`555-01xx`) and figure is made up. Demo
records show a dashed **DEMO** tag and a banner appears while any exist.

**Settings → Clear demo data** removes every demo record (and anything you created for a demo client)
and keeps your own entries. **Load demo data** brings it back.

## Where data is stored (important)

All data lives in **this browser's `localStorage`** (key `sania-internal:data:v1`) on the device you use.

- It does **not** sync between computers, phones, browsers or browser profiles.
- Clearing site data, using a private/incognito window, or some browser cleanup tools will erase it.
- Use **Settings → Export backup (JSON)** regularly and keep the file somewhere safe; **Import backup**
  restores it (it replaces the current data after a confirmation).
- Only one person can realistically use it at a time (whoever holds the browser). Two tabs in the
  same browser stay in sync.

## Upgrading later (multi-user / synced storage)

When you need shared, synced data (e.g. a team member on another computer), the data layer is in one
place — `src/store.tsx` (load/save + `upsert`/`remove`) — so it can be swapped for a hosted database
without rewriting the screens. One common path:

1. Create a project with a hosted Postgres provider such as **Supabase** (check their current pricing
   and free-tier limits yourself before signing up).
2. Create tables matching `src/types.ts` (`leads`, `clients`, `campaigns`, `tasks`, `invoices`,
   `reports`, `settings`) — or one `jsonb` column per record to start.
3. Turn on authentication and Row Level Security so only your team can read/write.
4. Replace the `localStorage` calls in `src/store.tsx` with the Supabase JS client, and import your
   latest JSON backup to seed the database.
5. Never put a service-role/secret key in this front-end; only the public anon key belongs in a
   static site.

Other options with the same shape: Firebase/Firestore, PocketBase, or a small API of your own.

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build to dist/
npm run preview   # serve the built app
```

Routing uses the URL hash (`#/invoices/…`), so it works on GitHub Pages without server config.

## Deploy

- `.github/workflows/ci.yml` — type-check + build on every push/PR.
- `.github/workflows/pages.yml` — two jobs: **build** (uploads `dist/` with
  `actions/upload-pages-artifact`) and **deploy** (`actions/deploy-pages`).
- One-time setup: repo **Settings → Pages → Source: GitHub Actions**, then re-run the
  "Deploy GitHub Pages" workflow.

## Limits / not included

- No email sending, payment collection, ad-platform API sync or call-tracking import — KPIs are typed in.
- Drag-and-drop on the boards needs a mouse; on phones, open a card and change its stage/status.
- Single-browser storage as described above.
