-- Rebuild all database objects for TMS
-- Safe to run on a fresh project. If re-running, drops are guarded.
-- Requires: Postgres 14+ on Supabase

-- 0) Extensions and basic setup
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

set search_path = public;

-- 1) Drop objects if they exist (order matters)
drop trigger if exists tr_tax_create_notifications on public.taxes;
drop trigger if exists tr_tax_status_cleanup on public.taxes;
drop trigger if exists tr_station_after_insert on public.charging_stations;
drop trigger if exists tr_station_schedule_after_update on public.station_schedules;

drop function if exists public.fn_tax_create_notifications_v2() cascade;
drop function if exists public.fn_tax_status_cleanup_v1() cascade;
drop function if exists public.fn_station_after_insert_v2() cascade;
drop function if exists public.fn_station_schedule_after_update_v2() cascade;

drop index if exists ux_notifications_tax_sched;
drop index if exists ux_notifications_station_sched;
drop index if exists ux_station_schedules_station_id;
drop index if exists ux_taxes_station_origin_due;

drop table if exists public.notification_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.notification_schedules cascade;
drop table if exists public.station_schedules cascade;
drop table if exists public.teams_channels cascade;
drop table if exists public.email_recipients cascade;
drop table if exists public.taxes cascade;
drop table if exists public.charging_stations cascade;
drop table if exists public.users cascade;

-- 2) Core tables
-- Users mirror auth.users; minimal profile
create table public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    name text,
    role text default 'viewer',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Charging stations
create table public.charging_stations (
    id uuid primary key default gen_random_uuid(),
    station_name text not null,
    location text,
    address text,
    status text default 'operating',
    canopy_installed boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Station schedules (one-per-station)
create table public.station_schedules (
    id uuid primary key default gen_random_uuid(),
    station_id uuid not null references public.charging_stations(id) on delete cascade,
    use_approval_date date null,
    safety_inspection_date date null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Taxes
create table public.taxes (
    id uuid primary key default gen_random_uuid(),
    station_id uuid references public.charging_stations(id) on delete cascade,
    tax_type text not null,
    tax_amount numeric(12,2),
    due_date date,
    tax_notice_number text,
    tax_year int,
    tax_period text,
    notes text,
    status text default 'pending',
    origin text, -- e.g., 'schedule_use_approval', 'schedule_safety_inspection', or null if user-entered
    created_by uuid references public.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Teams channels (for Teams webhooks)
create table public.teams_channels (
    id uuid primary key default gen_random_uuid(),
    name text,
    webhook_url text not null,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Optional: Email recipients (used by some dispatch flows)
create table public.email_recipients (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Notification schedules (tax vs station_schedule)
create table public.notification_schedules (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    days_before int not null,
    notification_time time default '16:00:00',
    notification_type text not null check (notification_type in ('tax','station_schedule','manual')),
    teams_channel_id uuid references public.teams_channels(id),
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Notifications
create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    notification_type text not null check (notification_type in ('tax','station_schedule','manual')),
    station_id uuid references public.charging_stations(id) on delete cascade,
    tax_id uuid references public.taxes(id) on delete cascade,
    schedule_id uuid references public.notification_schedules(id),
    station_missing_type text null check (station_missing_type in ('use_approval','safety_inspection')),
    title text not null default '',
    message text,
    notification_date date,
    notification_time time default '16:00:00',
    teams_channel_id uuid references public.teams_channels(id),
    is_sent boolean default false,
    sent_at timestamptz,
    error_message text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Notification logs (delivery attempts)
create table public.notification_logs (
    id uuid primary key default gen_random_uuid(),
    notification_id uuid references public.notifications(id) on delete cascade,
    channel_type text check (channel_type in ('teams','email')),
    status text check (status in ('success','fail')),
    error_message text,
    created_at timestamptz default now(),
    created_by uuid references public.users(id)
);

-- Useful indexes
create index idx_users_email on public.users(email);
create index idx_stations_status on public.charging_stations(status);
create index idx_taxes_station_id on public.taxes(station_id);
create index idx_notifications_type_date on public.notifications(notification_type, notification_date);

-- Uniqueness and dedup safeguards
create unique index ux_station_schedules_station_id on public.station_schedules(station_id);

-- Tax notifications: unique per (tax, schedule, date) when notification_type='tax'
create unique index ux_notifications_tax_sched
on public.notifications (tax_id, schedule_id, notification_date)
where notification_type = 'tax';

-- Station schedule notifications: unique per (station, schedule, date, missing_type) when type='station_schedule'
create unique index ux_notifications_station_sched
on public.notifications (station_id, schedule_id, notification_date, station_missing_type)
where notification_type = 'station_schedule';

-- Avoid duplicate auto-created taxes from schedules
create unique index ux_taxes_station_origin_due on public.taxes(station_id, origin, due_date) where origin is not null;

-- 3) RLS enable
alter table public.users enable row level security;
alter table public.charging_stations enable row level security;
alter table public.station_schedules enable row level security;
alter table public.taxes enable row level security;
alter table public.teams_channels enable row level security;
alter table public.email_recipients enable row level security;
alter table public.notification_schedules enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_logs enable row level security;

-- 4) RLS policies (simple, permissive; tighten later if needed)
-- users
drop policy if exists users_select_self on public.users;
drop policy if exists users_update_self on public.users;
drop policy if exists users_insert_self on public.users;
drop policy if exists users_service_role_access on public.users;
create policy users_select_self on public.users for select to authenticated using (id = auth.uid());
create policy users_insert_self on public.users for insert to authenticated with check (id = auth.uid());
create policy users_update_self on public.users for update to authenticated using (id = auth.uid());
create policy users_service_role_access on public.users for all to service_role using (true) with check (true);

-- charging_stations
drop policy if exists charging_stations_select_all on public.charging_stations;
drop policy if exists charging_stations_insert_authenticated on public.charging_stations;
drop policy if exists charging_stations_update_authenticated on public.charging_stations;
drop policy if exists charging_stations_service_role_access on public.charging_stations;
create policy charging_stations_select_all on public.charging_stations for select using (true);
create policy charging_stations_insert_authenticated on public.charging_stations for insert to authenticated with check (true);
create policy charging_stations_update_authenticated on public.charging_stations for update to authenticated using (true);
create policy charging_stations_service_role_access on public.charging_stations for all to service_role using (true) with check (true);

-- station_schedules (read for all; modified by trigger under definer)
drop policy if exists station_schedules_select_all on public.station_schedules;
drop policy if exists station_schedules_modify_authenticated on public.station_schedules;
drop policy if exists station_schedules_service_role_access on public.station_schedules;
create policy station_schedules_select_all on public.station_schedules for select using (true);
create policy station_schedules_modify_authenticated on public.station_schedules for update to authenticated using (true);
create policy station_schedules_service_role_access on public.station_schedules for all to service_role using (true) with check (true);

-- taxes
drop policy if exists taxes_select_authenticated on public.taxes;
drop policy if exists taxes_insert_authenticated on public.taxes;
drop policy if exists taxes_update_authenticated on public.taxes;
drop policy if exists taxes_service_role_access on public.taxes;
create policy taxes_select_authenticated on public.taxes for select to authenticated using (true);
create policy taxes_insert_authenticated on public.taxes for insert to authenticated with check (true);
create policy taxes_update_authenticated on public.taxes for update to authenticated using (true);
create policy taxes_service_role_access on public.taxes for all to service_role using (true) with check (true);

-- teams_channels
drop policy if exists teams_channels_select_all on public.teams_channels;
drop policy if exists teams_channels_modify_authenticated on public.teams_channels;
drop policy if exists teams_channels_service_role_access on public.teams_channels;
create policy teams_channels_select_all on public.teams_channels for select using (true);
create policy teams_channels_modify_authenticated on public.teams_channels for all to authenticated using (true) with check (true);
create policy teams_channels_service_role_access on public.teams_channels for all to service_role using (true) with check (true);

-- email_recipients (optional)
drop policy if exists email_recipients_select_all on public.email_recipients;
drop policy if exists email_recipients_modify_authenticated on public.email_recipients;
drop policy if exists email_recipients_service_role_access on public.email_recipients;
create policy email_recipients_select_all on public.email_recipients for select using (true);
create policy email_recipients_modify_authenticated on public.email_recipients for all to authenticated using (true) with check (true);
create policy email_recipients_service_role_access on public.email_recipients for all to service_role using (true) with check (true);

-- notification_schedules
drop policy if exists notification_schedules_select_all on public.notification_schedules;
drop policy if exists notification_schedules_modify_admin on public.notification_schedules;
drop policy if exists notification_schedules_service_role_access on public.notification_schedules;
create policy notification_schedules_select_all on public.notification_schedules for select using (true);
create policy notification_schedules_modify_admin on public.notification_schedules for all to authenticated using (true) with check (true);
create policy notification_schedules_service_role_access on public.notification_schedules for all to service_role using (true) with check (true);

-- notifications
drop policy if exists notifications_select_all on public.notifications;
drop policy if exists notifications_modify_authenticated on public.notifications;
drop policy if exists notifications_service_role_access on public.notifications;
create policy notifications_select_all on public.notifications for select using (true);
create policy notifications_modify_authenticated on public.notifications for update to authenticated using (true);
create policy notifications_service_role_access on public.notifications for all to service_role using (true) with check (true);

-- notification_logs (allow authenticated insert to avoid 403)
drop policy if exists notification_logs_select_all on public.notification_logs;
drop policy if exists notification_logs_insert_authenticated on public.notification_logs;
drop policy if exists notification_logs_service_role_access on public.notification_logs;
create policy notification_logs_select_all on public.notification_logs for select using (true);
create policy notification_logs_insert_authenticated on public.notification_logs for insert to authenticated with check (true);
create policy notification_logs_service_role_access on public.notification_logs for all to service_role using (true) with check (true);

-- 5) Helper: Korean labels for tax type
create or replace function public.fn_tax_type_label(_tax_type text)
returns text language sql immutable as $$
    select case lower(_tax_type)
        when 'acquisition' then '취득세'
        when 'automobile'  then '자동차세'
        when 'property'    then '재산세'
        else '기타세'
    end;
$$;

-- 6) Triggers and functions
-- 6.1) Create notifications for taxes on insert
create or replace function public.fn_tax_create_notifications_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    sched record;
    notif_date date;
    station_name text;
    tax_label text;
begin
    -- Only if due_date is present
    if new.due_date is null then
        return new;
    end if;

    select cs.station_name into station_name
    from public.charging_stations cs
    where cs.id = new.station_id;

    tax_label := public.fn_tax_type_label(new.tax_type);

    for sched in
        select id, name, days_before, notification_time
        from public.notification_schedules
        where notification_type = 'tax' and is_active = true
    loop
        notif_date := new.due_date - make_interval(days => sched.days_before);

        -- future or today only
        if notif_date >= current_date then
            insert into public.notifications (
                notification_type, tax_id, station_id, schedule_id,
                title, message, notification_date, notification_time, teams_channel_id
            ) values (
                'tax', new.id, new.station_id, sched.id,
                sched.name,
                E'세금 납부 알림입니다.' || E'\n'
                || coalesce(station_name, '') || E'\n'
                || coalesce(tax_label, '') || E'\n'
                || to_char(new.due_date, 'YYYY-MM-DD') || E'\n'
                || 'https://tms.watercharging.com/',
                notif_date,
                sched.notification_time,
                null
            )
            on conflict (tax_id, schedule_id, notification_date)
            do nothing;
        end if;
    end loop;

    return new;
end;
$$;

create trigger tr_tax_create_notifications
after insert on public.taxes
for each row execute function public.fn_tax_create_notifications_v2();

-- 6.2) Cleanup tax notifications when status becomes payment_completed
create or replace function public.fn_tax_status_cleanup_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'UPDATE' and new.status = 'payment_completed' and old.status is distinct from new.status then
        delete from public.notifications n
        where n.notification_type = 'tax'
          and n.tax_id = new.id
          and n.notification_date >= current_date; -- future or today
    end if;
    return new;
end;
$$;

create trigger tr_tax_status_cleanup
after update of status on public.taxes
for each row execute function public.fn_tax_status_cleanup_v1();

-- 6.3) On station insert: create schedule row and initial station_schedule notifications
create or replace function public.fn_station_after_insert_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    sched record;
    base_date date;
    missing_type text;
    station_id uuid;
begin
    station_id := new.id;

    -- create one schedule row if not exists
    insert into public.station_schedules (station_id)
    values (station_id)
    on conflict (station_id) do nothing;

    -- Create notifications for both missing types for configured days (1,7,15,30)
    base_date := (new.created_at at time zone 'UTC')::date;

    for sched in
        select id, name, days_before, notification_time
        from public.notification_schedules
        where notification_type = 'station_schedule' and is_active = true
    loop
        -- Only schedule for days >= 1 (business rule)
        if sched.days_before >= 1 then
            -- Two types: use_approval, safety_inspection
            for missing_type in select unnest(array['use_approval','safety_inspection'])
            loop
                insert into public.notifications (
                    notification_type, station_id, schedule_id, station_missing_type,
                    title, message, notification_date, notification_time, teams_channel_id
                ) values (
                    'station_schedule', station_id, sched.id, missing_type,
                    sched.name,
                    coalesce(new.station_name, '') || ' ' || case when missing_type = 'use_approval' then '사용 승인일' else '안전 점검일' end || ' 미입력 상태입니다.'
                    || E'\n' || '날짜를 입력해 주세요.'
                    || E'\n' || 'https://tms.watercharging.com/',
                    base_date + make_interval(days => sched.days_before),
                    sched.notification_time,
                    null
                )
                on conflict (station_id, schedule_id, notification_date, station_missing_type)
                do nothing;
            end loop;
        end if;
    end loop;

    return new;
end;
$$;

create trigger tr_station_after_insert
after insert on public.charging_stations
for each row execute function public.fn_station_after_insert_v2();

-- 6.4) On station schedule update: remove corresponding notifications and create acquisition tax (+60d)
create or replace function public.fn_station_schedule_after_update_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    ua_old date := old.use_approval_date;
    ua_new date := new.use_approval_date;
    si_old date := old.safety_inspection_date;
    si_new date := new.safety_inspection_date;
    station_name text;
    new_tax_id uuid;
begin
    if ua_new is not null and ua_old is distinct from ua_new then
        -- delete pending notifications for use_approval
        delete from public.notifications n
        where n.notification_type = 'station_schedule'
          and n.station_id = new.station_id
          and n.station_missing_type = 'use_approval'
          and n.notification_date >= current_date;

        -- create acquisition tax due +60 days
        insert into public.taxes (station_id, tax_type, tax_amount, due_date, status, origin)
        values (new.station_id, 'acquisition', null, ua_new + interval '60 days', 'pending', 'schedule_use_approval')
        on conflict (station_id, origin, due_date) do nothing;
    end if;

    if si_new is not null and si_old is distinct from si_new then
        -- delete pending notifications for safety_inspection
        delete from public.notifications n
        where n.notification_type = 'station_schedule'
          and n.station_id = new.station_id
          and n.station_missing_type = 'safety_inspection'
          and n.notification_date >= current_date;

        -- create acquisition tax due +60 days
        insert into public.taxes (station_id, tax_type, tax_amount, due_date, status, origin)
        values (new.station_id, 'acquisition', null, si_new + interval '60 days', 'pending', 'schedule_safety_inspection')
        on conflict (station_id, origin, due_date) do nothing;
    end if;

    return new;
end;
$$;

create trigger tr_station_schedule_after_update
after update on public.station_schedules
for each row execute function public.fn_station_schedule_after_update_v2();

-- 7) Seeds
-- 7.1) Tax notification schedules (0,7,15,30 days before)
insert into public.notification_schedules (name, days_before, notification_time, notification_type, is_active)
values
    ('세금 0일 전 알림', 0, '16:00:00', 'tax', true),
    ('세금 7일 전 알림', 7, '16:00:00', 'tax', true),
    ('세금 15일 전 알림', 15, '16:00:00', 'tax', true),
    ('세금 30일 전 알림', 30, '16:00:00', 'tax', true)
on conflict do nothing;

-- 7.2) Station schedule notification schedules (1,7,15,30 days after creation)
insert into public.notification_schedules (name, days_before, notification_time, notification_type, is_active)
values
    ('충전소 1일째 미입력 알림', 1, '10:00:00', 'station_schedule', true),
    ('충전소 7일째 미입력 알림', 7, '10:00:00', 'station_schedule', true),
    ('충전소 15일째 미입력 알림', 15, '10:00:00', 'station_schedule', true),
    ('충전소 30일째 미입력 알림', 30, '10:00:00', 'station_schedule', true)
on conflict do nothing;

-- 8) Sanity checks
-- Ensure triggers exist and indexes are valid
-- select * from public.notification_schedules;

-- 9) Notes
-- - Notifications.message format follows the requested multi-line Korean templates.
-- - Deduplication enforced via partial unique indexes with matching ON CONFLICT targets.
-- - Triggers are SECURITY DEFINER with search_path=public to avoid RLS issues.
-- - Adjust RLS policies later if stricter rules are required.


