-- 충전소 일정 관리 테이블 추가
CREATE TABLE public.station_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_id UUID REFERENCES public.charging_stations(id) ON DELETE CASCADE,
    use_approval_enabled BOOLEAN DEFAULT FALSE,
    use_approval_date DATE,
    safety_inspection_date DATE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 알림 스케줄 테이블 추가 (기존 notifications 테이블과 별도)
CREATE TABLE public.notification_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('tax', 'station_schedule')),
    days_before INTEGER NOT NULL,
    teams_channel_id UUID REFERENCES public.teams_channels(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기존 notifications 테이블에 컬럼 추가
ALTER TABLE public.notifications 
ADD COLUMN notification_type TEXT DEFAULT 'manual' CHECK (notification_type IN ('auto', 'manual')),
ADD COLUMN notification_date DATE,
ADD COLUMN notification_time TIME,
ADD COLUMN is_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN tax_id UUID REFERENCES public.taxes(id),
ADD COLUMN teams_channel_id UUID REFERENCES public.teams_channels(id);

-- taxes 테이블에 due_date 컬럼 추가 (기존에 없을 경우)
ALTER TABLE public.taxes 
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2);

-- teams_channels 테이블 추가 (기존에 없을 경우)
CREATE TABLE IF NOT EXISTS public.teams_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_station_schedules_station_id ON public.station_schedules(station_id);
CREATE INDEX idx_notification_schedules_type ON public.notification_schedules(notification_type);
CREATE INDEX idx_notifications_type ON public.notifications(notification_type);
CREATE INDEX idx_notifications_date ON public.notifications(notification_date);
CREATE INDEX idx_teams_channels_active ON public.teams_channels(is_active);

-- RLS 활성화
ALTER TABLE public.station_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_channels ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성
-- station_schedules 정책
CREATE POLICY "Users can view station schedules" ON public.station_schedules
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage station schedules" ON public.station_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- notification_schedules 정책
CREATE POLICY "Users can view notification schedules" ON public.notification_schedules
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage notification schedules" ON public.notification_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- teams_channels 정책
CREATE POLICY "Users can view teams channels" ON public.teams_channels
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage teams channels" ON public.teams_channels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 기존 notifications 테이블 정책 업데이트
DROP POLICY IF EXISTS "Users can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;

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
