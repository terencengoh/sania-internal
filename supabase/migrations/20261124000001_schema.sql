-- SANIA Growth Partner Internal Ops — schema
-- Runs on Supabase (Postgres 15+). IDs are text so existing localStorage backups (UUID strings) import as-is.


-- ---------------------------------------------------------------- core tables
create table public.clients (
  id            text primary key default gen_random_uuid()::text,
  company       text not null,
  contact_name  text not null default '',
  email         text not null default '',
  phone         text not null default '',
  city          text not null default '',
  state         text not null default '',
  website       text not null default '',
  status        text not null default 'Active' check (status in ('Active', 'Paused', 'Ended')),
  retainer      numeric(12,2) not null default 0,
  start_date    date,
  services      text[] not null default '{}',
  lead_id       text,
  demo          boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.contacts (
  id          text primary key default gen_random_uuid()::text,
  client_id   text not null references public.clients(id) on delete cascade,
  name        text not null,
  email       text not null default '',
  phone       text not null default '',
  title       text not null default '',
  demo        boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.leads (
  id            text primary key default gen_random_uuid()::text,
  company       text not null,
  contact_name  text not null default '',
  email         text not null default '',
  phone         text not null default '',
  city          text not null default '',
  state         text not null default '',
  source        text not null default '',
  stage         text not null default 'New' check (stage in ('New', 'Contacted', 'Call booked', 'Proposal sent', 'Won', 'Lost')),
  value         numeric(12,2) not null default 0,
  follow_up     date,
  services      text[] not null default '{}',
  lost_reason   text,
  client_id     text references public.clients(id) on delete set null,
  demo          boolean not null default false,
  created_at    timestamptz not null default now()
);
-- clients.lead_id is an informational back-reference (no FK, to avoid a clients<->leads write cycle).

-- Internal notes on leads and clients. Never visible to client users.
create table public.notes (
  id          text primary key default gen_random_uuid()::text,
  lead_id     text references public.leads(id) on delete cascade,
  client_id   text references public.clients(id) on delete cascade,
  date        timestamptz not null default now(),
  text        text not null,
  check ((lead_id is null) <> (client_id is null))
);

create table public.campaigns (
  id              text primary key default gen_random_uuid()::text,
  client_id       text not null references public.clients(id) on delete cascade,
  name            text not null,
  channel         text not null default '',
  status          text not null default 'Planning' check (status in ('Planning', 'Active', 'Paused', 'Completed')),
  monthly_budget  numeric(12,2) not null default 0,
  start_date      date,
  end_date        date,
  goal            text not null default '',
  demo            boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.deliverables (
  id           text primary key default gen_random_uuid()::text,
  campaign_id  text not null references public.campaigns(id) on delete cascade,
  text         text not null,
  done         boolean not null default false,
  position     int not null default 0
);

create table public.team_members (
  id          text primary key default gen_random_uuid()::text,
  name        text not null unique,
  created_at  timestamptz not null default now()
);

create table public.tasks (
  id           text primary key default gen_random_uuid()::text,
  title        text not null,
  description  text not null default '',
  client_id    text references public.clients(id) on delete set null,
  campaign_id  text references public.campaigns(id) on delete set null,
  assignee     text not null default '',
  due          date,
  status       text not null default 'To do' check (status in ('To do', 'In progress', 'Review', 'Done')),
  priority     text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  demo         boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.invoices (
  id              text primary key default gen_random_uuid()::text,
  number          text not null,
  client_id       text references public.clients(id) on delete set null,
  issue_date      date not null default current_date,
  due_date        date,
  status          text not null default 'Draft' check (status in ('Draft', 'Sent', 'Paid', 'Void')),
  notes           text not null default '',
  paid_date       date,
  retainer_month  text,
  demo            boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.invoice_items (
  id           text primary key default gen_random_uuid()::text,
  invoice_id   text not null references public.invoices(id) on delete cascade,
  description  text not null default '',
  qty          numeric(12,2) not null default 1,
  rate         numeric(12,2) not null default 0,
  position     int not null default 0
);

create table public.reports (
  id            text primary key default gen_random_uuid()::text,
  client_id     text not null references public.clients(id) on delete cascade,
  month         text not null check (month ~ '^\d{4}-\d{2}$'),
  kpis          jsonb not null default '{}'::jsonb,
  previous      jsonb,
  highlights    text not null default '',
  next_steps    text not null default '',
  published     boolean not null default false,
  published_at  timestamptz,
  demo          boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (client_id, month)
);

-- Single-row agency settings (agency details are printed on client invoices/reports).
create table public.settings (
  id                   int primary key default 1 check (id = 1),
  agency_name          text not null default 'SANIA Growth Partner',
  tagline              text not null default '',
  email                text not null default '',
  phone                text not null default '',
  website              text not null default '',
  address              text not null default '',
  invoice_prefix       text not null default 'SGP-',
  next_invoice_number  int not null default 1001,
  payment_terms_days   int not null default 15,
  invoice_footer       text not null default ''
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------- users & access
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null default '',
  full_name   text not null default '',
  role        text not null default 'client' check (role in ('owner', 'staff', 'client')),
  client_id   text references public.clients(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Invite-only access. A row here decides the role a new auth user gets.
create table public.invitations (
  id          text primary key default gen_random_uuid()::text,
  email       text not null,
  role        text not null check (role in ('staff', 'client')),
  client_id   text references public.clients(id) on delete cascade,
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  check (role <> 'client' or client_id is not null)
);
create unique index invitations_open_email on public.invitations (lower(email)) where accepted_at is null;

create index on public.contacts (client_id);
create index on public.notes (lead_id);
create index on public.notes (client_id);
create index on public.campaigns (client_id);
create index on public.deliverables (campaign_id);
create index on public.tasks (client_id);
create index on public.invoices (client_id);
create index on public.invoice_items (invoice_id);
create index on public.reports (client_id);
create index on public.profiles (client_id);
