-- notifications RLS 정책 수정 - 모든 인증된 사용자가 모든 알림을 볼 수 있도록

-- 기존 정책들 모두 삭제
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_service_role_access" ON public.notifications;
DROP POLICY IF EXISTS "notifications_service_role_all" ON public.notifications;

-- 새로운 정책 생성 - 모든 인증된 사용자가 모든 알림에 접근 가능
CREATE POLICY "notifications_select_all" ON public.notifications
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "notifications_insert_authenticated" ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "notifications_update_authenticated" ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "notifications_delete_authenticated" ON public.notifications
    FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "notifications_service_role_all" ON public.notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 기존 알림들의 user_id를 NULL로 설정하여 시스템 알림으로 만들기
UPDATE public.notifications 
SET user_id = NULL 
WHERE notification_type IN ('tax', 'station_schedule');

-- 통계 출력
SELECT 
  'notifications RLS 정책 수정 완료' as status,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN notification_type = 'tax' THEN 1 END) as tax_notifications,
  COUNT(CASE WHEN notification_type = 'station_schedule' THEN 1 END) as station_notifications,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as system_notifications
FROM public.notifications;
