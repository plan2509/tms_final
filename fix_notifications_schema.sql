-- notifications 테이블을 현재 코드에 맞게 업데이트

-- 기존 컬럼들 추가/수정
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS notification_type TEXT,
ADD COLUMN IF NOT EXISTS notification_date DATE,
ADD COLUMN IF NOT EXISTS notification_time TEXT DEFAULT '10:00',
ADD COLUMN IF NOT EXISTS schedule_id UUID,
ADD COLUMN IF NOT EXISTS tax_id UUID,
ADD COLUMN IF NOT EXISTS station_id UUID,
ADD COLUMN IF NOT EXISTS teams_channel_id UUID,
ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID;

-- 외래키 제약조건 추가
ALTER TABLE public.notifications 
ADD CONSTRAINT IF NOT EXISTS fk_notifications_schedule 
  FOREIGN KEY (schedule_id) REFERENCES public.notification_schedules(id) ON DELETE SET NULL;

ALTER TABLE public.notifications 
ADD CONSTRAINT IF NOT EXISTS fk_notifications_tax 
  FOREIGN KEY (tax_id) REFERENCES public.taxes(id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
ADD CONSTRAINT IF NOT EXISTS fk_notifications_station 
  FOREIGN KEY (station_id) REFERENCES public.charging_stations(id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
ADD CONSTRAINT IF NOT EXISTS fk_notifications_teams_channel 
  FOREIGN KEY (teams_channel_id) REFERENCES public.teams_channels(id) ON DELETE SET NULL;

ALTER TABLE public.notifications 
ADD CONSTRAINT IF NOT EXISTS fk_notifications_created_by 
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON public.notifications(notification_date);
CREATE INDEX IF NOT EXISTS idx_notifications_tax_id ON public.notifications(tax_id);
CREATE INDEX IF NOT EXISTS idx_notifications_station_id ON public.notifications(station_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_sent ON public.notifications(is_sent);

-- RLS 정책 업데이트 (기존 정책은 유지하고 service_role 정책 수정)
DROP POLICY IF EXISTS "notifications_service_role_access" ON public.notifications;
CREATE POLICY "notifications_service_role_access" ON public.notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 기본값 설정
UPDATE public.notifications 
SET notification_type = 'manual' 
WHERE notification_type IS NULL;

UPDATE public.notifications 
SET is_sent = FALSE 
WHERE is_sent IS NULL;

-- 통계 출력
SELECT 
  'notifications 테이블 업데이트 완료' as status,
  COUNT(*) as total_notifications
FROM public.notifications;