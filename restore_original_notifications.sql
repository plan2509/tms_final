-- notifications 테이블을 원래 스키마로 복원

-- 1. 기존 notifications 테이블 삭제
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 2. 원래 notifications 테이블 생성 (기존 스키마)
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 기존 인덱스 생성
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- 4. RLS 활성화
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. 기존 RLS 정책 복원
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_authenticated" ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "notifications_service_role_access" ON public.notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. 백업 테이블이 없으므로 데이터 복원 생략
