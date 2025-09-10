-- station_schedules 테이블 생성
CREATE TABLE public.station_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_id UUID REFERENCES public.charging_stations(id) ON DELETE CASCADE,
    use_approval_enabled BOOLEAN DEFAULT false,
    use_approval_date DATE,
    safety_inspection_date DATE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_station_schedules_station_id ON public.station_schedules(station_id);
CREATE INDEX idx_station_schedules_use_approval_date ON public.station_schedules(use_approval_date);
CREATE INDEX idx_station_schedules_safety_inspection_date ON public.station_schedules(safety_inspection_date);

-- RLS 활성화
ALTER TABLE public.station_schedules ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성
-- 모든 사용자가 조회 가능
CREATE POLICY "All users can view station schedules" ON public.station_schedules
    FOR SELECT USING (true);

-- 관리자와 사업 개발 권한이 삽입 가능
CREATE POLICY "Admins and business dev can insert station schedules" ON public.station_schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'business_development')
        )
    );

-- 관리자와 사업 개발 권한이 수정 가능
CREATE POLICY "Admins and business dev can update station schedules" ON public.station_schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'business_development')
        )
    );

-- 삭제는 관리자만 가능
CREATE POLICY "Only admins can delete station schedules" ON public.station_schedules
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- service_role은 모든 작업 가능
CREATE POLICY "service_role_all_access" ON public.station_schedules
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

