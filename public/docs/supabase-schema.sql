-- Mitru BYO Supabase schema
-- Version: 1
--
-- Run this SQL manually in your Supabase SQL Editor before enabling cloud sync.
--
-- Security notes:
-- - Do not use service_role keys in Mitru.
-- - Mitru stores only the Supabase Project URL and Anon Key.
-- - All tables are protected by Row Level Security.
-- - Each row is scoped to the authenticated user via owner_id = auth.uid().
-- - local_id is unique only per owner_id, so multiple users can sync safely.
-- - updated_at is a server-side cursor. Clients must not write business updatedAt into this column.

create extension if not exists "pgcrypto";

create or replace function public.mitru_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_id text not null,
  project_payload jsonb not null,
  updated_at timestamptz not null default now(),
  synced_by text,
  constraint projects_owner_local_unique unique (owner_id, local_id)
);

drop index if exists public.projects_updated_at_idx;
create index projects_updated_at_idx
  on public.projects (owner_id, updated_at, id);

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row
  execute function public.mitru_touch_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Allow anon project sync" on public.projects;
drop policy if exists "Authenticated users can sync own projects" on public.projects;
create policy "Authenticated users can sync own projects"
  on public.projects
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_id text not null,
  customer_payload jsonb not null,
  updated_at timestamptz not null default now(),
  synced_by text,
  constraint customers_owner_local_unique unique (owner_id, local_id)
);

drop index if exists public.customers_updated_at_idx;
create index customers_updated_at_idx
  on public.customers (owner_id, updated_at, id);

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
  before update on public.customers
  for each row
  execute function public.mitru_touch_updated_at();

alter table public.customers enable row level security;

drop policy if exists "Allow anon customer sync" on public.customers;
drop policy if exists "Authenticated users can sync own customers" on public.customers;
create policy "Authenticated users can sync own customers"
  on public.customers
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table if not exists public.estimate_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_id text not null,
  estimate_payload jsonb not null,
  updated_at timestamptz not null default now(),
  synced_by text,
  constraint estimate_documents_owner_local_unique unique (owner_id, local_id)
);

drop index if exists public.estimate_documents_updated_at_idx;
create index estimate_documents_updated_at_idx
  on public.estimate_documents (owner_id, updated_at, id);

drop trigger if exists estimate_documents_touch_updated_at on public.estimate_documents;
create trigger estimate_documents_touch_updated_at
  before update on public.estimate_documents
  for each row
  execute function public.mitru_touch_updated_at();

alter table public.estimate_documents enable row level security;

drop policy if exists "Allow anon estimate sync" on public.estimate_documents;
drop policy if exists "Authenticated users can sync own estimates" on public.estimate_documents;
create policy "Authenticated users can sync own estimates"
  on public.estimate_documents
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table if not exists public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_id text not null,
  invoice_payload jsonb not null,
  updated_at timestamptz not null default now(),
  synced_by text,
  constraint invoice_documents_owner_local_unique unique (owner_id, local_id)
);

drop index if exists public.invoice_documents_updated_at_idx;
create index invoice_documents_updated_at_idx
  on public.invoice_documents (owner_id, updated_at, id);

drop trigger if exists invoice_documents_touch_updated_at on public.invoice_documents;
create trigger invoice_documents_touch_updated_at
  before update on public.invoice_documents
  for each row
  execute function public.mitru_touch_updated_at();

alter table public.invoice_documents enable row level security;

drop policy if exists "Allow anon invoice sync" on public.invoice_documents;
drop policy if exists "Authenticated users can sync own invoices" on public.invoice_documents;
create policy "Authenticated users can sync own invoices"
  on public.invoice_documents
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  local_id text not null,
  invoice_local_id text not null,
  payment_payload jsonb not null,
  updated_at timestamptz not null default now(),
  synced_by text,
  constraint payment_records_owner_local_unique unique (owner_id, local_id)
);

drop index if exists public.payment_records_updated_at_idx;
create index payment_records_updated_at_idx
  on public.payment_records (owner_id, updated_at, id);

drop trigger if exists payment_records_touch_updated_at on public.payment_records;
create trigger payment_records_touch_updated_at
  before update on public.payment_records
  for each row
  execute function public.mitru_touch_updated_at();

create index if not exists payment_records_invoice_local_id_idx
  on public.payment_records (owner_id, invoice_local_id);

alter table public.payment_records enable row level security;

drop policy if exists "Allow anon payment sync" on public.payment_records;
drop policy if exists "Authenticated users can sync own payments" on public.payment_records;
create policy "Authenticated users can sync own payments"
  on public.payment_records
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
