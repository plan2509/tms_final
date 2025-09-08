-- 기존 테이블 확인 후 필요한 컬럼만 추가하는 스키마

-- 1. station_schedules 테이블 생성 (새로운 테이블)
CREATE TABLE IF NOT EXISTS public.station_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_id UUID REFERENCES public.charging_stations(id) ON DELETE CASCADE,
    use_approval_enabled BOOLEAN DEFAULT FALSE,
    use_approval_date DATE,
    safety_inspection_date DATE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. notification_schedules 테이블에 필요한 컬럼 추가 (기존 테이블이 있는 경우)
DO $$ 
BEGIN
    -- notification_type 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notification_schedules' 
                   AND column_name = 'notification_type') THEN
        ALTER TABLE public.notification_schedules 
        ADD COLUMN notification_type TEXT DEFAULT 'tax' CHECK (notification_type IN ('tax', 'station_schedule'));
    END IF;
    
    -- teams_channel_id 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notification_schedules' 
                   AND column_name = 'teams_channel_id') THEN
        ALTER TABLE public.notification_schedules 
        ADD COLUMN teams_channel_id UUID;
    END IF;
END $$;

-- 3. teams_channels 테이블 생성 (기존에 없을 경우)
CREATE TABLE IF NOT EXISTS public.teams_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. notifications 테이블에 필요한 컬럼 추가
DO $$ 
BEGIN
    -- notification_type 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'notification_type') THEN
        ALTER TABLE public.notifications 
        ADD COLUMN notification_type TEXT DEFAULT 'manual' CHECK (notification_type IN ('auto', 'manual'));
    END IF;
    
    -- notification_date 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'notification_date') THEN
        ALTER TABLE public.notifications 
        ADD COLUMN notification_date DATE;
    END IF;
    
    -- notification_time 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'notification_time') THEN
        ALTER TABLE public.notifications 
        ADD COLUMN notification_time TIME;
    END IF;
    
    -- is_sent 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'is_sent') THEN
        ALTER TABLE public.notifications 
        ADD COLUMN is_sent BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- tax_id 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'tax_id') THEN
        ALTER TABLE public.notifications 
        ADD COLUMN tax_id UUID REFERENCES public.taxes(id);
    END IF;
    
    -- teams_channel_id 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'teams_channel_id') THEN
        ALTER TABLE public.notifications 
        ADD COLUMN teams_channel_id UUID REFERENCES public.teams_channels(id);
    END IF;
END $$;

-- 5. taxes 테이블에 필요한 컬럼 추가
DO $$ 
BEGIN
    -- due_date 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'taxes' 
                   AND column_name = 'due_date') THEN
        ALTER TABLE public.taxes 
        ADD COLUMN due_date DATE;
    END IF;
    
    -- tax_amount 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'taxes' 
                   AND column_name = 'tax_amount') THEN
        ALTER TABLE public.taxes 
        ADD COLUMN tax_amount DECIMAL(10, 2);
    END IF;
END $$;

-- 6. 인덱스 생성 (기존에 없을 경우)
CREATE INDEX IF NOT EXISTS idx_station_schedules_station_id ON public.station_schedules(station_id);
CREATE INDEX IF NOT EXISTS idx_notification_schedules_type ON public.notification_schedules(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON public.notifications(notification_date);
CREATE INDEX IF NOT EXISTS idx_teams_channels_active ON public.teams_channels(is_active);

-- 7. RLS 활성화 (기존에 없을 경우)
ALTER TABLE public.station_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_channels ENABLE ROW LEVEL SECURITY;

-- 8. RLS 정책 생성 (기존에 없을 경우)
-- station_schedules 정책
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'station_schedules' AND policyname = 'Users can view station schedules') THEN
        CREATE POLICY "Users can view station schedules" ON public.station_schedules
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'station_schedules' AND policyname = 'Admins can manage station schedules') THEN
        CREATE POLICY "Admins can manage station schedules" ON public.station_schedules
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.role = 'admin'
                )
            );
    END IF;
END $$;

-- notification_schedules 정책
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_schedules' AND policyname = 'Users can view notification schedules') THEN
        CREATE POLICY "Users can view notification schedules" ON public.notification_schedules
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_schedules' AND policyname = 'Admins can manage notification schedules') THEN
        CREATE POLICY "Admins can manage notification schedules" ON public.notification_schedules
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.role = 'admin'
                )
            );
    END IF;
END $$;

-- teams_channels 정책
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams_channels' AND policyname = 'Users can view teams channels') THEN
        CREATE POLICY "Users can view teams channels" ON public.teams_channels
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams_channels' AND policyname = 'Admins can manage teams channels') THEN
        CREATE POLICY "Admins can manage teams channels" ON public.teams_channels
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.role = 'admin'
                )
            );
    END IF;
END $$;

-- 9. 기존 notifications 테이블 정책 업데이트
DO $$ 
BEGIN
    -- 기존 정책 삭제
    DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
    
    -- 새 정책 생성
    CREATE POLICY "Users can view notifications" ON public.notifications
        FOR SELECT USING (true);

    CREATE POLICY "Admins can manage notifications" ON public.notifications
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.role = 'admin'
            )
        );
END $$;
