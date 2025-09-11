-- Station triggers and RLS helper bundle

-- Add missing type column to distinguish which date is missing
alter table public.notifications
  add column if not exists station_missing_type text
  check (station_missing_type in ('use_approval','safety_inspection'));

-- Ensure per-station per-schedule per-date per-missing-type uniqueness for station notifications
drop index if exists ux_notifications_station_sched;
create unique index if not exists ux_notifications_station_sched
on public.notifications (station_id, schedule_id, notification_date, station_missing_type)
where notification_type = 'station_schedule' and schedule_id is not null and station_id is not null;

-- 2) Trigger function: on charging_stations insert, create station_schedules row if missing
create or replace function public.fn_station_create_schedules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- create placeholder schedule row if not exists
  insert into public.station_schedules (station_id, use_approval_enabled)
  values (new.id, true)
  on conflict (station_id) do nothing;
  return new;
end;
$$;

-- 3) Trigger function: on charging_stations insert, create station notifications for missing dates (day-1/7/15/30 after creation)
create or replace function public.fn_station_create_notifications_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sched record;
  created_kst date := (new.created_at at time zone 'Asia/Seoul')::date;
  target_date date;
  msg text;
begin
  -- iterate active station schedules
  for sched in
    select id, days_before, teams_channel_id
    from public.notification_schedules
    where notification_type = 'station_schedule' and is_active = true
  loop
    target_date := created_kst + sched.days_before;
    -- 3.1) 사용 승인일 (캐노피 설치된 경우에만 필요)
    if (new.canopy_installed is true) then
      msg := new.station_name || ' 사용 승인일 미입력 상태입니다.' || E'\n' ||
             '날짜를 입력해 주세요.' || E'\n' ||
             'https://tms.watercharging.com/';

      insert into public.notifications (
        notification_type, schedule_id, station_id, station_missing_type, notification_date, notification_time, message, teams_channel_id, is_sent
      ) values (
        'station_schedule', sched.id, new.id, 'use_approval', target_date, '10:00', msg, sched.teams_channel_id, false
      ) on conflict on constraint ux_notifications_station_sched do nothing;
    end if;

    -- 3.2) 안전 점검일 (항상 필요)
    msg := new.station_name || ' 안전 점검일 미입력 상태입니다.' || E'\n' ||
           '날짜를 입력해 주세요.' || E'\n' ||
           'https://tms.watercharging.com/';

    insert into public.notifications (
      notification_type, schedule_id, station_id, station_missing_type, notification_date, notification_time, message, teams_channel_id, is_sent
    ) values (
      'station_schedule', sched.id, new.id, 'safety_inspection', target_date, '10:00', msg, sched.teams_channel_id, false
    ) on conflict on constraint ux_notifications_station_sched do nothing;
  end loop;
  return new;
end;
$$;

-- 4) Cleanup trigger function: when station_schedules updated with dates, delete related notifications
create or replace function public.fn_station_schedule_completion_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.use_approval_date is not null) then
    delete from public.notifications
    where notification_type = 'station_schedule'
      and station_id = new.station_id
      and station_missing_type = 'use_approval';
  end if;

  if (new.safety_inspection_date is not null) then
    delete from public.notifications
    where notification_type = 'station_schedule'
      and station_id = new.station_id
      and station_missing_type = 'safety_inspection';
  end if;
  return new;
end;
$$;

-- 5) Attach triggers (idempotent)
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tr_station_create_schedules'
  ) then
    create trigger tr_station_create_schedules
    after insert on public.charging_stations
    for each row execute function public.fn_station_create_schedules();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'tr_station_create_notifications'
  ) then
    create trigger tr_station_create_notifications
    after insert on public.charging_stations
    for each row execute function public.fn_station_create_notifications_v2();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'tr_station_schedule_completion_cleanup'
  ) then
    create trigger tr_station_schedule_completion_cleanup
    after update on public.station_schedules
    for each row execute function public.fn_station_schedule_completion_cleanup();
  end if;
end $$;


