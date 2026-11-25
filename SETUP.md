# Going live: real logins with Supabase

Right now the app runs in **DEMO mode**. There are no real accounts, the login page has "Demo staff" and "Demo client" buttons, and data stays in each browser's localStorage. **Demo mode is not real security.**

This guide switches it to **LIVE mode**:

- real email + password logins (plus email sign-in links and password reset)
- a shared database
- roles: **owner**, **staff**, **client**
- client accounts by invitation only

Nothing here costs money on Supabase's **Free plan**. Check the current limits on <https://supabase.com/pricing>; for example, inactive free projects can be paused.

You'll need about 30–45 minutes. Do the steps in order.

---

## 0. Before you start: export your current data

If you've entered real leads, clients or invoices in the demo app, open it in the **same browser** you used and go to **Settings → Export backup (JSON)**. Keep the file; you'll import it in step 8.

## 1. Create the Supabase project (free)

1. Go to <https://supabase.com> and sign up (GitHub sign-in works).
2. **New project**:
   - Name: `sania-internal`.
   - Pick a region close to you (for example East US).
   - Set a strong **database password** and save it in your password manager.
   - Choose the **Free** plan.
3. Wait for the project to finish setting up.

## 2. Create the database tables and security rules

1. In the Supabase dashboard open **SQL Editor → New query**.
2. Open [`supabase/migrations/20261124000001_schema.sql`](supabase/migrations/20261124000001_schema.sql) from this repo, copy everything, paste it in, and click **Run**. It should say "Success. No rows returned".
3. New query again. Paste [`supabase/migrations/20261124000002_auth_rls.sql`](supabase/migrations/20261124000002_auth_rls.sql) and click **Run**.

Using the Supabase CLI instead? Run `npx supabase link --project-ref <ref>` and then `npx supabase db push` from the repo folder.

## 3. Lock sign-ups and set the site address

1. Go to **Authentication → Sign In / Providers**:
   - **Email** must be enabled.
   - Turn **OFF** "Allow new users to sign up". Access is invite-only.
2. Go to **Authentication → URL Configuration**:
   - **Site URL**: `https://terencengoh.github.io/sania-internal/`
   - **Redirect URLs**: add `https://terencengoh.github.io/sania-internal/`. Also add `http://localhost:5173/` if you'll run it on your computer.
3. Optional but recommended: Supabase's built-in email sender is meant for testing and has low sending limits. For real client invites, set up your own SMTP under **Project Settings → Authentication → SMTP**. See <https://supabase.com/docs/guides/auth/auth-smtp>.

## 4. Create your owner login

1. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
2. In **SQL Editor**, run this with your email:

   ```sql
   update public.profiles set role = 'owner' where email = 'you@example.com';
   select email, role from public.profiles;  -- should show: owner
   ```

## 5. Add the two GitHub secrets

1. In Supabase go to **Project Settings → API Keys** (older dashboards: **Project Settings → API**). Copy:
   - the **Project URL**, which looks like `https://abcdefgh.supabase.co`
   - the **anon / public** key, or the **publishable** key (starts with `sb_publishable_`).
2. In GitHub open **terencengoh/sania-internal → Settings → Secrets and variables → Actions → New repository secret** and add both:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon/publishable key

> ⚠️ Never use the **service_role** / **secret** key in GitHub secrets for this site or anywhere in the frontend. The anon key is designed to be public: the database's Row Level Security rules protect the data.

## 6. Redeploy

Go to **GitHub → Actions → "Deploy GitHub Pages" → Run workflow** (branch `main`). In the Build step's log you should see `Built in LIVE (Supabase) mode`.

Open <https://terencengoh.github.io/sania-internal/>. The login page now asks for email and password, and the demo buttons are gone. Sign in with your owner account.

## 7. Deploy the invite function (recommended)

This lets you send invite emails straight from the app.

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>      # the "abcdefgh" part of the URL
npx supabase functions deploy invite-user
npx supabase secrets set SITE_URL=https://terencengoh.github.io/sania-internal/
```

The function runs on Supabase's servers and uses the service-role key there. That key is never in the website.

**If you skip this step**, the app's invite button still records the invitation, so the right role and company are applied. You then send the email yourself: **Supabase → Authentication → Users → Invite user**, with the same email address.

## 8. Import your old data (owner only)

**Settings → Backup & data → Import backup into Supabase…**, then pick the JSON from step 0.

- Leave **Skip DEMO records** ticked unless you want the fictional demo companies too.
- Import adds or updates records and never deletes anything already in the database.
- A red banner appears at the top of the page if anything fails to save.

## 9. Invite your team and clients

- **A client**: open **Clients → (company) → Invite client user**. Use their email and send.
  - They get an email, click the link, choose a password, and land in the **Client Portal**.
  - In the portal they see **only their own company**:
    - campaigns and deliverable progress
    - invoices marked **Sent** or **Paid** (they can print or save a PDF)
    - monthly reports you've **published**
    - their account page, where they can change their password
- **A staff member** (owner only): go to **Settings → Users & access → Invite user** and choose Role **Staff**. Staff see the full internal app but can't change roles.
- To change someone's role, relink a client user to a different company, or remove access: **Settings → Users & access** (owner only).

### What clients can never see

Enforced by the database (Row Level Security), not just hidden in the app:

- leads
- other clients
- internal notes
- the task board
- the team list
- draft or void invoices
- unpublished reports
- invitations

The rules are tested in [`supabase/tests/rls.test.ts`](supabase/tests/rls.test.ts), which runs in CI on every push.

## 10. Day-to-day

- **Reports**: open a report and click **Publish to client portal** when it's ready. **Unpublish** hides it again.
- **Invoices**: the client sees an invoice once you **Mark sent**. Drafts stay private.
- **Password reset**: "Forgot password?" on the login page emails a reset link.

## Running it on your computer (optional)

Create a `.env.local` file next to `package.json`. It's ignored by git.

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Then run `npm install` and `npm run dev`. Without this file the app runs in demo mode.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Login page still shows demo buttons | The secrets aren't set or have a typo, or you didn't re-run the deploy (step 6). |
| "No access yet" after signing in | That email has no role. Owner: Settings → Users & access, then set the role (and the client, for client users). For your own first account, run the SQL in step 4. |
| Invite link opens but says expired/invalid | Links expire. Send a new invite. Check the Site URL and Redirect URLs (step 3). |
| "That email already has an account" | The user exists already. The owner links them in Settings → Users & access. |
| Red "Couldn't save" banner | Usually a permission or network issue. Export a backup, reload, and try again. |
| Want to go back to demo mode | Delete the two GitHub secrets and re-run the deploy. |

## Limits to know about

- No email is sent by the app itself. Invite, sign-in link and reset emails come from Supabase Auth.
- Two people editing the same record at the same moment: the last save wins. There's no live co-editing.
- Invoice numbers come from Settings. If two staff create invoices at the same second they could get the same number; edit one if that happens.
- Your Supabase plan's limits apply. See <https://supabase.com/pricing>.
