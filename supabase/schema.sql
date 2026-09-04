-- Shahi Lites — quotation store schema.
-- Run once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run.

-- ── tables ────────────────────────────────────────────────────────────────────

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
                    check (status in ('submitted_for_review','approved','rejected')),
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

create index if not exists quotations_created_at_idx on public.quotations (created_at desc);
create index if not exists quotations_email_idx      on public.quotations (employee_email);
create index if not exists quotations_status_idx     on public.quotations (status);
create index if not exists quotation_events_qid_idx  on public.quotation_events (quotation_id);

-- ── RLS: lock the tables; only the service-role key (used server-side) gets in ─

alter table public.quotations        enable row level security;
alter table public.quotation_events  enable row level security;
alter table public.quotation_counters enable row level security;
-- (no policies -> anon/authenticated clients cannot read or write; the app's
--  server uses the service-role key, which bypasses RLS)

-- ── atomic quotation creation: allocate SL-YYYY-NNNN + insert + log an event ──

create or replace function public.create_quotation(
  p_employee_name   text,
  p_employee_email  text,
  p_total_amount    numeric
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
    (v_number, p_employee_name, p_employee_email, p_total_amount, 'submitted_for_review')
  returning * into v_row;

  insert into public.quotation_events (quotation_id, actor_email, to_status)
  values (v_row.id, p_employee_email, 'submitted_for_review');

  return v_row;
end;
$$;

-- Make PostgREST pick up the new tables/function immediately.
notify pgrst, 'reload schema';
