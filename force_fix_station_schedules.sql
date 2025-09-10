-- station_schedules 테이블 RLS 완전 재설정

-- 1. RLS 완전 비활성화
ALTER TABLE public.station_schedules DISABLE ROW LEVEL SECURITY;

-- 2. 모든 정책 강제 삭제
DROP POLICY IF EXISTS "All users can view station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins and business dev can insert station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins and business dev can update station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Only admins can delete station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "service_role_all_access" ON public.station_schedules;
DROP POLICY IF EXISTS "Users can view station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins can manage station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins and business dev can manage station schedules" ON public.station_schedules;

-- 3. RLS 다시 활성화
ALTER TABLE public.station_schedules ENABLE ROW LEVEL SECURITY;

-- 4. 매우 간단한 정책만 생성 (모든 인증된 사용자 허용)
CREATE POLICY "authenticated_users_all_access" ON public.station_schedules
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. service_role은 모든 작업 가능
CREATE POLICY "service_role_all_access" ON public.station_schedules
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'station_schedules'
ORDER BY policyname;

