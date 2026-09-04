-- Shahi Lites -- quotation store schema.
-- Run in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run after updates.

-- tables

create table if not exists public.quotation_counters (
  year        int primary key,
  last_value  int not null default 0
);

create table if not exists public.quotations (
  id              uuid primary key default gen_random_uuid(),
  number          text unique not null,
  employee_name   text not null,
  employee_email  text not null,
  status          text not null default 'submitted_for_review'
                    check (status in ('downloaded','submitted_for_review','approved','rejected')),
  total_amount    numeric(12,2) not null,
  created_at      timestamptz not null default now(),
  reviewed_by     text,
  reviewed_at     timestamptz,
  review_note     text
);

create table if not exists public.quotation_events (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references public.quotations(id) on delete cascade,
  at            timestamptz not null default now(),
  actor_email   text not null,
  from_status   text,
  to_status     text not null,
  note          text
);

-- Access list. Sign-in is only allowed for an email whose row here has
-- status = 'active'. A superadmin (SUPERADMIN_EMAILS) can always sign in
-- regardless of this table.
create table if not exists public.app_users (
  email            text primary key,
  name             text,
  status           text not null default 'active' check (status in ('active','removed')),
  added_by         text not null,
  added_at         timestamptz not null default now(),
  removed_by       text,
  removed_at       timestamptz,
  last_sign_in_at  timestamptz,
  sign_in_count    int not null default 0
);

create index if not exists quotations_created_at_idx on public.quotations (created_at desc);
create index if not exists quotations_email_idx      on public.quotations (employee_email);
create index if not exists quotations_status_idx     on public.quotations (status);
create index if not exists quotation_events_qid_idx  on public.quotation_events (quotation_id);
create index if not exists app_users_status_idx      on public.app_users (status);

-- Also allow the new 'downloaded' status on a table created before this change.
alter table public.quotations drop constraint if exists quotations_status_check;
alter table public.quotations add constraint quotations_status_check
  check (status in ('downloaded','submitted_for_review','approved','rejected'));

-- RLS: lock the tables; only the server (secret key) reads or writes them.

alter table public.quotations         enable row level security;
alter table public.quotation_events   enable row level security;
alter table public.quotation_counters enable row level security;
alter table public.app_users          enable row level security;

-- atomic quotation creation: allocate SL-YYYY-NNNN + insert + log an event

create or replace function public.create_quotation(
  p_employee_name   text,
  p_employee_email  text,
  p_total_amount    numeric,
  p_status          text default 'submitted_for_review'
) returns public.quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int := extract(year from now())::int;
  v_seq    int;
  v_number text;
  v_row    public.quotations;
begin
  insert into public.quotation_counters (year, last_value)
    values (v_year, 1)
    on conflict (year)
      do update set last_value = quotation_counters.last_value + 1
    returning last_value into v_seq;

  v_number := 'SL-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  insert into public.quotations
    (number, employee_name, employee_email, total_amount, status)
  values
    (v_number, p_employee_name, p_employee_email, p_total_amount, p_status)
  returning * into v_row;

  insert into public.quotation_events (quotation_id, actor_email, to_status)
  values (v_row.id, p_employee_email, p_status);

  return v_row;
end;
$$;

-- upsert a sign-in: creates the access row on first sign-in, else bumps stats
create or replace function public.touch_sign_in(
  p_email text,
  p_name  text default null
) returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.app_users;
begin
  insert into public.app_users (email, name, status, added_by, sign_in_count, last_sign_in_at)
    values (p_email, p_name, 'active', p_email, 1, now())
  on conflict (email) do update
    set sign_in_count   = app_users.sign_in_count + 1,
        last_sign_in_at = now(),
        name            = coalesce(excluded.name, app_users.name)
  returning * into v_row;

  return v_row;
end;
$$;

notify pgrst, 'reload schema';
