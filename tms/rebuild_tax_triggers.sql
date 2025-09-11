-- Rebuild tax notification triggers and functions (idempotent)

-- 0) Uniqueness for tax notifications
create unique index if not exists ux_notifications_tax_sched
on public.notifications (tax_id, schedule_id, notification_date)
where notification_type = 'tax' and schedule_id is not null and tax_id is not null;

-- 1) Create notifications on tax insert (future dates only)
create or replace function public.fn_tax_create_notifications_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sched record;
  kst_today date := (now() at time zone 'Asia/Seoul')::date;
  target_date date;
  msg text;
  st_name text;
begin
  -- Get station name for message (optional)
  select station_name into st_name from public.charging_stations where id = new.station_id;

  for sched in
    select id, days_before, teams_channel_id
    from public.notification_schedules
    where notification_type = 'tax' and is_active = true
  loop
    target_date := new.due_date - make_interval(days => sched.days_before);
    if target_date > kst_today then
      msg := '세금 납부일 알림입니다.' || E'\n' ||
             coalesce(st_name, '-') || ' / ' || new.tax_type || ' / ' || to_char(new.due_date, 'YYYY-MM-DD') || E'\n' ||
             'https://tms.watercharging.com/';

      insert into public.notifications (
        notification_type, schedule_id, tax_id, notification_date, notification_time, message, teams_channel_id, is_sent
      ) values (
        'tax', sched.id, new.id, target_date, '10:00', msg, sched.teams_channel_id, false
      ) on conflict on constraint ux_notifications_tax_sched do nothing;
    end if;
  end loop;

  return new;
end;
$$;

-- 2) Cleanup notifications on tax status change to payment_completed
create or replace function public.fn_tax_status_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status = 'payment_completed') then
    delete from public.notifications where notification_type = 'tax' and tax_id = new.id;
  end if;
  return new;
end;
$$;

-- 3) Cleanup notifications on tax delete
create or replace function public.fn_tax_delete_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications where notification_type = 'tax' and tax_id = old.id;
  return old;
end;
$$;

-- 4) Optional: set initial status before insert
create or replace function public.set_initial_tax_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tax_type = 'acquisition' then
    new.status := coalesce(new.status, 'accounting_review');
  else
    new.status := coalesce(new.status, 'payment_scheduled');
  end if;
  return new;
end;
$$;

-- 5) Attach triggers (idempotent)
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_initial_tax_status_trigger') then
    create trigger set_initial_tax_status_trigger
    before insert on public.taxes
    for each row execute function public.set_initial_tax_status();
  end if;

  -- remove legacy duplicate creator if exists
  if exists (select 1 from pg_trigger where tgname = 'create_auto_notifications_trigger') then
    drop trigger create_auto_notifications_trigger on public.taxes;
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'tr_tax_create_notifications') then
    create trigger tr_tax_create_notifications
    after insert on public.taxes
    for each row execute function public.fn_tax_create_notifications_v2();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'tr_tax_status_cleanup') then
    create trigger tr_tax_status_cleanup
    after update of status on public.taxes
    for each row execute function public.fn_tax_status_cleanup();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'tr_tax_delete_cleanup') then
    create trigger tr_tax_delete_cleanup
    after delete on public.taxes
    for each row execute function public.fn_tax_delete_cleanup();
  end if;
end $$;


