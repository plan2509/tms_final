-- 목적: 세금 알림 중복(11건 등) 생성 차단 및 정리

-- 0) 트랜잭션 분리 권장 (Supabase SQL Editor에서 순차 실행)

-- 1) tax 스케줄 중복 비활성화 (동일 days_before는 1개만 활성화)
update public.notification_schedules ns
set is_active = false
from (
  select days_before, min(id) as keep_id
  from public.notification_schedules
  where notification_type = 'tax' and is_active = true
  group by days_before
) keep
where ns.notification_type = 'tax'
  and ns.is_active = true
  and ns.days_before = keep.days_before
  and ns.id <> keep.keep_id;

-- 2) 세금 알림 유니크 인덱스(스케줄 기반)
create unique index if not exists ux_notifications_tax_sched
  on public.notifications (tax_id, schedule_id, notification_date)
  where notification_type = 'tax' and schedule_id is not null;

-- 3) 세금 알림 유니크 인덱스(스케줄 없는 케이스 방지)
create unique index if not exists ux_notifications_tax_nosched
  on public.notifications (tax_id, notification_date)
  where notification_type = 'tax' and schedule_id is null;

-- 4) 기존 중복 레코드 정리(가장 오래된 1건만 남기고 제거)
with ranked as (
  select id,
         row_number() over (
           partition by tax_id, coalesce(schedule_id::text, '(null)'), notification_date, notification_type
           order by created_at
         ) as rn
  from public.notifications
  where notification_type = 'tax'
)
delete from public.notifications n
using ranked r
where n.id = r.id
  and r.rn > 1;

-- 5) 검증용 조회 (필요시)
-- select tax_id, schedule_id, notification_date, count(*)
-- from public.notifications
-- where notification_type = 'tax'
-- group by 1,2,3
-- having count(*) > 1;


