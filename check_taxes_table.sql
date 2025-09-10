-- taxes 테이블 상태 확인 및 복원

-- 1. taxes 테이블이 있는지 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'taxes';

-- 2. taxes 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS public.taxes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    station_id UUID REFERENCES public.charging_stations(id),
    tax_type TEXT NOT NULL,
    tax_amount DECIMAL(10, 2),
    due_date DATE,
    tax_notice_number TEXT,
    tax_year TEXT,
    tax_period TEXT,
    notes TEXT,
    status TEXT DEFAULT 'payment_scheduled',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RLS 활성화
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성
DO $$ BEGIN
    CREATE POLICY "taxes_select_authenticated" ON public.taxes
        FOR SELECT TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "taxes_insert_authenticated" ON public.taxes
        FOR INSERT TO authenticated
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "taxes_update_authenticated" ON public.taxes
        FOR UPDATE TO authenticated
        USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "taxes_service_role_access" ON public.taxes
        FOR ALL TO service_role
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_taxes_station_id ON public.taxes(station_id);
CREATE INDEX IF NOT EXISTS idx_taxes_created_by ON public.taxes(created_by);
