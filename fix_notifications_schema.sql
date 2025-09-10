-- notifications 테이블 구조 수정
-- 기존 테이블 백업 후 재생성

-- 1. notification_type_enum 타입 생성 (먼저 생성)
DO $$ BEGIN
    CREATE TYPE notification_type_enum AS ENUM ('tax', 'station_schedule', 'auto', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. teams_channels 테이블 생성 (먼저 생성)
CREATE TABLE IF NOT EXISTS public.teams_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. notification_schedules 테이블 생성
CREATE TABLE IF NOT EXISTS public.notification_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    schedule_name TEXT NOT NULL,
    notification_type notification_type_enum NOT NULL,
    days_before INTEGER NOT NULL,
    notification_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    teams_channel_id UUID REFERENCES public.teams_channels(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 기존 notifications 테이블 백업
CREATE TABLE notifications_backup AS SELECT * FROM notifications;

-- 5. 기존 notifications 테이블 삭제
DROP TABLE IF EXISTS notifications CASCADE;

-- 6. 새로운 notifications 테이블 생성
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tax_id UUID REFERENCES public.taxes(id) ON DELETE CASCADE,
    notification_type notification_type_enum NOT NULL,
    schedule_id UUID REFERENCES public.notification_schedules(id) ON DELETE CASCADE,
    notification_date DATE NOT NULL,
    notification_time TIME NOT NULL,
    message TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    teams_channel_id UUID REFERENCES public.teams_channels(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    last_attempt_at TIMESTAMP WITH TIME ZONE
);

-- 7. 기존 인덱스 삭제 (있는 경우)
DROP INDEX IF EXISTS idx_notifications_tax_id;
DROP INDEX IF EXISTS idx_notifications_schedule_id;
DROP INDEX IF EXISTS idx_notifications_notification_type;
DROP INDEX IF EXISTS idx_notifications_notification_date;
DROP INDEX IF EXISTS idx_notifications_is_sent;
DROP INDEX IF EXISTS idx_notification_schedules_type;
DROP INDEX IF EXISTS idx_notification_schedules_active;

-- 8. 인덱스 생성
CREATE INDEX idx_notifications_tax_id ON public.notifications(tax_id);
CREATE INDEX idx_notifications_schedule_id ON public.notifications(schedule_id);
CREATE INDEX idx_notifications_notification_type ON public.notifications(notification_type);
CREATE INDEX idx_notifications_notification_date ON public.notifications(notification_date);
CREATE INDEX idx_notifications_is_sent ON public.notifications(is_sent);
CREATE INDEX idx_notification_schedules_type ON public.notification_schedules(notification_type);
CREATE INDEX idx_notification_schedules_active ON public.notification_schedules(is_active);

-- 8. RLS 활성화
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_channels ENABLE ROW LEVEL SECURITY;

-- 9. RLS 정책 생성 (중복 방지)
-- notifications 테이블 정책
DO $$ BEGIN
    CREATE POLICY "notifications_select_authenticated" ON public.notifications
        FOR SELECT TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notifications_insert_authenticated" ON public.notifications
        FOR INSERT TO authenticated
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notifications_update_authenticated" ON public.notifications
        FOR UPDATE TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notifications_service_role_access" ON public.notifications
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- notification_schedules 테이블 정책
DO $$ BEGIN
    CREATE POLICY "notification_schedules_select_authenticated" ON public.notification_schedules
        FOR SELECT TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notification_schedules_insert_authenticated" ON public.notification_schedules
        FOR INSERT TO authenticated
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notification_schedules_update_authenticated" ON public.notification_schedules
        FOR UPDATE TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notification_schedules_service_role_access" ON public.notification_schedules
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- teams_channels 테이블 정책
DO $$ BEGIN
    CREATE POLICY "teams_channels_select_authenticated" ON public.teams_channels
        FOR SELECT TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "teams_channels_insert_authenticated" ON public.teams_channels
        FOR INSERT TO authenticated
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "teams_channels_update_authenticated" ON public.teams_channels
        FOR UPDATE TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "teams_channels_service_role_access" ON public.teams_channels
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 10. 기본 데이터 삽입 (필요한 경우)
-- 기본 알림 스케줄 생성
INSERT INTO public.notification_schedules (schedule_name, notification_type, days_before, notification_time, is_active) VALUES
('세금 30일 전 알림', 'tax', 30, '10:00:00', true),
('세금 7일 전 알림', 'tax', 7, '10:00:00', true),
('세금 1일 전 알림', 'tax', 1, '10:00:00', true),
('세금 연체 알림', 'tax', -1, '10:00:00', true),
('충전소 일정 미입력 알림', 'station_schedule', 0, '10:00:00', true)
ON CONFLICT DO NOTHING;

-- 기본 Teams 채널 생성 (필요한 경우)
INSERT INTO public.teams_channels (channel_name, webhook_url, is_active) VALUES
('세금 일정 알림 팀즈', 'https://your-webhook-url-here', true),
('충전소 일정 알림 팀즈', 'https://your-webhook-url-here', true)
ON CONFLICT DO NOTHING;
