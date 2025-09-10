-- 스키마 롤백: 이전 상태로 되돌리기

-- 1. 새로 생성된 테이블들 삭제
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.notification_schedules CASCADE;
DROP TABLE IF EXISTS public.teams_channels CASCADE;

-- 2. 백업된 notifications 테이블 복원
CREATE TABLE public.notifications AS SELECT * FROM notifications_backup;

-- 3. 백업 테이블 삭제
DROP TABLE IF EXISTS notifications_backup;

-- 4. 기존 notifications 테이블 구조로 복원 (원래 스키마)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. 불필요한 컬럼들 제거 (새 스키마에서 추가된 것들)
ALTER TABLE public.notifications DROP COLUMN IF EXISTS tax_id;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS notification_type;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS schedule_id;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS notification_date;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS notification_time;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS is_sent;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS sent_at;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS teams_channel_id;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS error_message;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS last_attempt_at;

-- 6. notification_type_enum 타입 삭제
DROP TYPE IF EXISTS notification_type_enum;

-- 7. RLS 활성화 (원래 상태로)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 8. 기존 RLS 정책 복원 (원래 정책들)
DO $$ BEGIN
    CREATE POLICY "notifications_select_own" ON public.notifications
        FOR SELECT
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notifications_insert_authenticated" ON public.notifications
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notifications_update_own" ON public.notifications
        FOR UPDATE
        USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "notifications_service_role_access" ON public.notifications
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 9. 기존 인덱스 복원
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
