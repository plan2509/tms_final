-- station_schedules 테이블 RLS 정책 올바르게 수정 (RLS 유지)

-- 1. 기존 정책 모두 제거
DROP POLICY IF EXISTS "All users can view station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins and business dev can insert station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins and business dev can update station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Only admins can delete station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "service_role_all_access" ON public.station_schedules;
DROP POLICY IF EXISTS "Users can view station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins can manage station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "Admins and business dev can manage station schedules" ON public.station_schedules;
DROP POLICY IF EXISTS "authenticated_users_all_access" ON public.station_schedules;

-- 2. 새로운 정책 생성 (보안 유지하면서 접근 허용)

-- 모든 인증된 사용자가 조회 가능
CREATE POLICY "authenticated_users_can_select" ON public.station_schedules
    FOR SELECT TO authenticated
    USING (true);

-- 관리자와 사업 개발 권한이 삽입 가능
CREATE POLICY "admins_and_business_dev_can_insert" ON public.station_schedules
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'business_development')
        )
    );

-- 관리자와 사업 개발 권한이 수정 가능
CREATE POLICY "admins_and_business_dev_can_update" ON public.station_schedules
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'business_development')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'business_development')
        )
    );

-- 삭제는 관리자만 가능
CREATE POLICY "only_admins_can_delete" ON public.station_schedules
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- service_role은 모든 작업 가능 (API에서 사용)
CREATE POLICY "service_role_all_access" ON public.station_schedules
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. RLS 활성화 확인
ALTER TABLE public.station_schedules ENABLE ROW LEVEL SECURITY;

-- 4. 정책 확인
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

