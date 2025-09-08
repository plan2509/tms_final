-- station_schedules 테이블 RLS 정책 수정
-- 406 오류 해결을 위한 권한 설정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Users can insert station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Users can update station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Users can delete station schedules" ON public.station_schedules;

-- 새로운 정책 생성
CREATE POLICY "Enable read access for all users" ON public.station_schedules
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.station_schedules
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.station_schedules
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.station_schedules
    FOR DELETE USING (auth.role() = 'authenticated');

-- RLS 활성화 확인
ALTER TABLE public.station_schedules ENABLE ROW LEVEL SECURITY;

