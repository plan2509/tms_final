-- notification_schedules 테이블만 복원

-- 1. notification_type_enum 타입 생성
DO $$ BEGIN
    CREATE TYPE notification_type_enum AS ENUM ('tax', 'station_schedule', 'auto', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. teams_channels 테이블 생성 (참조용)
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

-- 4. RLS 활성화
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_channels ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 생성
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

-- 6. 기본 데이터 삽입
INSERT INTO public.notification_schedules (schedule_name, notification_type, days_before, notification_time, is_active) VALUES
('세금 30일 전 알림', 'tax', 30, '10:00:00', true),
('세금 7일 전 알림', 'tax', 7, '10:00:00', true),
('세금 1일 전 알림', 'tax', 1, '10:00:00', true),
('세금 연체 알림', 'tax', -1, '10:00:00', true),
('충전소 일정 미입력 알림', 'station_schedule', 0, '10:00:00', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.teams_channels (channel_name, webhook_url, is_active) VALUES
('세금 일정 알림 팀즈', 'https://your-webhook-url-here', true),
('충전소 일정 알림 팀즈', 'https://your-webhook-url-here', true)
ON CONFLICT DO NOTHING;

