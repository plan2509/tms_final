-- 잘못된 알림 데이터 정리

-- 1970년 날짜 및 잘못된 알림 정리
DELETE FROM public.notifications 
WHERE notification_date < '2020-01-01' 
   OR notification_date IS NULL;

-- 중복된 알림 정리 (같은 tax_id, notification_type, notification_date를 가진 중복 제거)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY notification_type, tax_id, notification_date, schedule_id
           ORDER BY created_at DESC
         ) as rn
  FROM public.notifications 
  WHERE tax_id IS NOT NULL
)
DELETE FROM public.notifications 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 존재하지 않는 tax_id를 참조하는 알림 삭제
DELETE FROM public.notifications 
WHERE tax_id IS NOT NULL 
  AND tax_id NOT IN (SELECT id FROM public.taxes);

-- 존재하지 않는 station_id를 참조하는 알림 삭제
DELETE FROM public.notifications 
WHERE station_id IS NOT NULL 
  AND station_id NOT IN (SELECT id FROM public.charging_stations);

-- 존재하지 않는 schedule_id를 참조하는 알림 삭제
DELETE FROM public.notifications 
WHERE schedule_id IS NOT NULL 
  AND schedule_id NOT IN (SELECT id FROM public.notification_schedules);

-- 통계 출력
SELECT 
  'cleanup 완료' as status,
  COUNT(*) as remaining_notifications,
  COUNT(CASE WHEN notification_type = 'tax' THEN 1 END) as tax_notifications,
  COUNT(CASE WHEN notification_type = 'station_schedule' THEN 1 END) as station_notifications
FROM public.notifications;