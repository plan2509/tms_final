create extension if not exists pgcrypto;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('tax','station_schedule')),
  entity_id uuid not null,
  file_name text not null,
  mime_type text not null,
  size integer not null check (size >= 0 and size <= 10485760), -- <= 10MB
  storage_path text not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.attachments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='attachments' and policyname='attachments_select'
  ) then
    create policy attachments_select on public.attachments for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='attachments' and policyname='attachments_insert'
  ) then
    create policy attachments_insert on public.attachments for insert with check (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='attachments' and policyname='attachments_update'
  ) then
    create policy attachments_update on public.attachments for update using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='attachments' and policyname='attachments_delete'
  ) then
    create policy attachments_delete on public.attachments for delete using (auth.uid() is not null);
  end if;
end $$;


