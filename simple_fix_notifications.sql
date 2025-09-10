-- notifications 테이블에 누락된 컬럼만 추가

-- 1. user_id 컬럼 추가 (없는 경우)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);

-- 2. title 컬럼 추가 (없는 경우)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;

-- 3. message 컬럼 추가 (없는 경우)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;

-- 4. type 컬럼 추가 (없는 경우)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';

-- 5. read 컬럼 추가 (없는 경우)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- 6. created_at 컬럼 추가 (없는 경우)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 7. 불필요한 컬럼들 제거 (새 스키마에서 추가된 것들)
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

-- 8. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
