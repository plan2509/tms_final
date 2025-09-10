-- 1970년 날짜 및 잘못된 알림 정리
DELETE FROM public.notifications 
WHERE notification_date < '2020-01-01' 
   OR notification_date IS NULL;

-- 중복된 세금 등록 완료 알림 정리 (최신 것만 남기고 삭제)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY notification_type, title, tax_id 
           ORDER BY created_at DESC
         ) as rn
  FROM public.notifications 
  WHERE notification_type = 'tax' 
    AND title = '세금 등록 완료'
)
DELETE FROM public.notifications 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 미래 날짜가 아닌 스케줄 기반 알림 정리
DELETE FROM public.notifications 
WHERE notification_type = 'tax' 
  AND schedule_id IS NOT NULL 
  AND notification_date <= CURRENT_DATE;

-- 통계 출력
SELECT 
  notification_type,
  COUNT(*) as count,
  MIN(notification_date) as earliest_date,
  MAX(notification_date) as latest_date
FROM public.notifications 
GROUP BY notification_type 
ORDER BY notification_type;
