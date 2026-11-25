-- SANIA Internal Ops — roles, invite-only sign-up, Row Level Security
-- owner/staff: full access to everything.
-- client: read-only, ONLY their own client's client-safe records:
--   their client row + contacts, their campaigns + deliverables, Sent/Paid invoices (+ items),
--   published reports, and agency settings (printed on documents).
--   Never: leads, notes, tasks, team, other clients, drafts/void invoices, unpublished reports, invitations.

-- ---------------------------------------------------------------- helpers
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'staff'))
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
$$;

create or replace function public.my_client_id() returns text
language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid() and role = 'client'
$$;

-- ---------------------------------------------------------------- new auth users -> profile
-- Every new auth user gets a profile. Role/client come ONLY from a matching open invitation
-- (user-supplied signup metadata is ignored). No invitation => role 'client' with no client => sees nothing.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  select * into inv from public.invitations
   where lower(email) = lower(coalesce(new.email, '')) and accepted_at is null
   order by created_at desc limit 1;
  insert into public.profiles (id, email, role, client_id)
  values (new.id, coalesce(new.email, ''), coalesce(inv.role, 'client'), case when inv.role = 'client' then inv.client_id end)
  on conflict (id) do nothing;
  if inv.id is not null then
    update public.invitations set accepted_at = now() where id = inv.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Publishing timestamp
create or replace function public.reports_set_published_at() returns trigger
language plpgsql as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then new.published_at := coalesce(new.published_at, now()); end if;
  if not new.published then new.published_at := null; end if;
  return new;
end $$;
create trigger reports_published_at before insert or update on public.reports
  for each row execute function public.reports_set_published_at();

-- ---------------------------------------------------------------- privileges
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.clients       enable row level security;
alter table public.contacts      enable row level security;
alter table public.leads         enable row level security;
alter table public.notes         enable row level security;
alter table public.campaigns     enable row level security;
alter table public.deliverables  enable row level security;
alter table public.team_members  enable row level security;
alter table public.tasks         enable row level security;
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
alter table public.reports       enable row level security;
alter table public.settings      enable row level security;
alter table public.profiles      enable row level security;
alter table public.invitations   enable row level security;

-- Staff: full access on all business tables
do $$
declare t text;
begin
  foreach t in array array['clients','contacts','leads','notes','campaigns','deliverables','team_members','tasks','invoices','invoice_items','reports','settings']
  loop
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- Client users: read-only, own client only, client-safe rows only
create policy client_read_own on public.clients for select to authenticated
  using (id = public.my_client_id());

create policy client_read_own on public.contacts for select to authenticated
  using (client_id = public.my_client_id());

create policy client_read_own on public.campaigns for select to authenticated
  using (client_id = public.my_client_id());

create policy client_read_own on public.deliverables for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.client_id = public.my_client_id()));

create policy client_read_sent on public.invoices for select to authenticated
  using (client_id = public.my_client_id() and status in ('Sent', 'Paid'));

create policy client_read_sent on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and i.client_id = public.my_client_id() and i.status in ('Sent', 'Paid')));

create policy client_read_published on public.reports for select to authenticated
  using (client_id = public.my_client_id() and published);

create policy client_read_settings on public.settings for select to authenticated
  using (public.my_client_id() is not null);

-- Profiles: everyone reads their own; staff read all; only the owner changes roles/links.
create policy own_profile on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy owner_manage on public.profiles for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy owner_delete on public.profiles for delete to authenticated using (public.is_owner() and id <> auth.uid());

-- Invitations: staff may invite client users; only the owner may invite staff.
create policy staff_read on public.invitations for select to authenticated using (public.is_staff());
create policy staff_invite on public.invitations for insert to authenticated
  with check (public.is_owner() or (public.is_staff() and role = 'client'));
create policy staff_cancel on public.invitations for delete to authenticated
  using (public.is_owner() or (public.is_staff() and role = 'client'));

-- Profiles can't be inserted by API users (the trigger does it). Nobody can change their own role:
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id then raise exception 'Profile id cannot change'; end if;
  if old.id = auth.uid() and new.role <> old.role then
    raise exception 'You cannot change your own role';
  end if;
  if new.role <> 'client' then new.client_id := null; end if; -- staff/owner are never tied to one client
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();
