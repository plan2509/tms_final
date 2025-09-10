-- station_schedules RLS 정책 수정

-- 기존 정책들 모두 삭제
DROP POLICY IF EXISTS "station_sched_select_all" ON public.station_schedules;
DROP POLICY IF EXISTS "station_sched_upsert_auth" ON public.station_schedules;
DROP POLICY IF EXISTS "station_sched_service_all" ON public.station_schedules;
DROP POLICY IF EXISTS "station_schedules_select_all" ON public.station_schedules;
DROP POLICY IF EXISTS "station_schedules_insert_auth" ON public.station_schedules;
DROP POLICY IF EXISTS "station_schedules_update_auth" ON public.station_schedules;
DROP POLICY IF EXISTS "station_schedules_delete_auth" ON public.station_schedules;
DROP POLICY IF EXISTS "station_schedules_service_role_all" ON public.station_schedules;

-- 새로운 정책 생성
CREATE POLICY "station_schedules_select_all" ON public.station_schedules
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "station_schedules_insert_auth" ON public.station_schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "station_schedules_update_auth" ON public.station_schedules
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "station_schedules_delete_auth" ON public.station_schedules
    FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "station_schedules_service_role_all" ON public.station_schedules
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 통계 출력
SELECT 'station_schedules RLS 정책 수정 완료' as status;