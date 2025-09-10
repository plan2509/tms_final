-- 알림 스케줄 생성

-- 기존 알림 스케줄 모두 삭제
DELETE FROM public.notification_schedules;

-- Teams 채널 ID 조회 (1번, 2번 채널)
-- 실제 teams_channels 테이블에서 ID를 확인하고 아래 UUID를 업데이트하세요
-- SELECT id, name FROM public.teams_channels ORDER BY created_at;

-- 세금 일정 알림 스케줄 생성 (teams webhook 1번)
INSERT INTO public.notification_schedules (
  notification_type, 
  name, 
  days_before, 
  notification_time, 
  is_active, 
  teams_channel_id
) VALUES 
  ('tax', '세금 30일 전 알림', 30, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 0)),
  ('tax', '세금 15일 전 알림', 15, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 0)),
  ('tax', '세금 7일 전 알림', 7, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 0)),
  ('tax', '세금 당일 알림', 0, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 0));

-- 충전소 일정 알림 스케줄 생성 (teams webhook 2번)
INSERT INTO public.notification_schedules (
  notification_type, 
  name, 
  days_before, 
  notification_time, 
  is_active, 
  teams_channel_id
) VALUES 
  ('station_schedule', '충전소 1일째 미입력 알림', 1, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 1)),
  ('station_schedule', '충전소 7일째 미입력 알림', 7, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 1)),
  ('station_schedule', '충전소 15일째 미입력 알림', 15, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 1)),
  ('station_schedule', '충전소 30일째 미입력 알림', 30, '10:00', true, (SELECT id FROM public.teams_channels LIMIT 1 OFFSET 1));

-- 생성된 스케줄 확인
SELECT 
  notification_type,
  name,
  days_before,
  notification_time,
  is_active,
  teams_channel_id
FROM public.notification_schedules 
ORDER BY notification_type, days_before;

-- 통계 출력
SELECT 
  'notification_schedules 생성 완료' as status,
  COUNT(*) as total_schedules,
  COUNT(CASE WHEN notification_type = 'tax' THEN 1 END) as tax_schedules,
  COUNT(CASE WHEN notification_type = 'station_schedule' THEN 1 END) as station_schedules
FROM public.notification_schedules;
