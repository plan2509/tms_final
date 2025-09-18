-- Create table for independent manual notifications (idempotent)
create extension if not exists pgcrypto;

create table if not exists public.manual_notifications (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.charging_stations(id) on delete cascade,
  notification_date date not null,
  message text not null,
  teams_channel_id uuid references public.teams_channels(id),
  is_sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manual_notifications enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='manual_notifications' and policyname='manual_notifications_select'
  ) then
    create policy manual_notifications_select on public.manual_notifications for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='manual_notifications' and policyname='manual_notifications_insert'
  ) then
    create policy manual_notifications_insert on public.manual_notifications for insert with check (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='manual_notifications' and policyname='manual_notifications_update'
  ) then
    create policy manual_notifications_update on public.manual_notifications for update using (auth.uid() is not null);
  end if;
end $$;

create or replace function public.trg_manual_notifications_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname='tr_manual_notifications_updated_at'
  ) then
    create trigger tr_manual_notifications_updated_at
      before update on public.manual_notifications
      for each row execute function public.trg_manual_notifications_updated_at();
  end if;
end $$;


