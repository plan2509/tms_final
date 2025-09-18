-- Enable required extensions (idempotent)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Function: dispatch Teams notifications at KST 10:00
create or replace function public.fn_dispatch_notifications_kst10()
returns void
language plpgsql
security definer
as $$
declare
  today_kst date;
  ch record;
  sched record;
  tax record;
  n_id uuid;
  msg text;
  tax_type_kor text;
begin
  -- Today in Asia/Seoul
  select (now() at time zone 'Asia/Seoul')::date into today_kst;

  -- Active tax schedules only
  for sched in
    select id, name, teams_channel_id
    from public.notification_schedules
    where notification_type = 'tax' and is_active = true
  loop
    -- Taxes due today
    for tax in
      select t.id, t.tax_type, t.due_date, cs.station_name
      from public.taxes t
      join public.charging_stations cs on cs.id = t.station_id
      where t.due_date = today_kst
    loop
      tax_type_kor := case tax.tax_type when 'acquisition' then '취득세' when 'property' then '재산세' else '기타세' end;
      msg := '세금 납부일 알림입니다.' || E'\n'
         || coalesce(tax.station_name,'-') || ' / ' || tax_type_kor || ' / ' || tax.due_date::text || E'\n'
         || 'https://tms.watercharging.com/';

      -- idempotent notification row (per sched+tax+date)
      select id into n_id from public.notifications
        where notification_type='tax'
          and schedule_id=sched.id
          and tax_id=tax.id
          and notification_date=today_kst
        limit 1;
      if n_id is null then
        insert into public.notifications(
          notification_type, schedule_id, tax_id, notification_date, notification_time,
          title, message, teams_channel_id, is_sent
        ) values (
          'tax', sched.id, tax.id, today_kst, '10:00',
          coalesce(sched.name,'알림'), msg, sched.teams_channel_id, false
        ) returning id into n_id;
      else
        update public.notifications set message = msg where id = n_id;
      end if;

      -- determine target webhooks
      if sched.teams_channel_id is not null then
        for ch in select webhook_url from public.teams_channels where id=sched.teams_channel_id and is_active=true loop
          perform net.http_post(ch.webhook_url, '{"Content-Type":"application/json"}'::jsonb, json_build_object('text', msg)::jsonb);
        end loop;
      else
        for ch in select webhook_url from public.teams_channels where is_active=true loop
          perform net.http_post(ch.webhook_url, '{"Content-Type":"application/json"}'::jsonb, json_build_object('text', msg)::jsonb);
        end loop;
      end if;

      -- mark sent (best-effort)
      update public.notifications
        set is_sent = true,
            sent_at = now(),
            last_attempt_at = now()
      where id = n_id;
    end loop;
  end loop;
end;
$$;

-- Schedule daily at 01:00 UTC (10:00 KST). Idempotent: replace existing job if present.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname='tms_dispatch_kst10';
  perform cron.schedule('tms_dispatch_kst10', '0 1 * * *', 'select public.fn_dispatch_notifications_kst10()');
exception when undefined_table then
  -- cron.job not accessible yet; try schedule directly
  perform cron.schedule('tms_dispatch_kst10', '0 1 * * *', 'select public.fn_dispatch_notifications_kst10()');
end$$;

-- Grants (so normal roles can read cron.job if needed)
grant usage on schema cron to authenticated, anon; -- best-effort (ignored if denied)

