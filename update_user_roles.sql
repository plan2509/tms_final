-- users 테이블의 role 컬럼에 CHECK 제약조건 추가
-- 새로운 권한 'business_development' 포함

-- 1. 기존 CHECK 제약조건이 있다면 제거
DO $$ 
BEGIN
    -- 기존 role_check 제약조건 제거 (있다면)
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'role_check' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT role_check;
    END IF;
END $$;

-- 2. 새로운 CHECK 제약조건 추가 (3가지 권한 허용)
ALTER TABLE public.users 
ADD CONSTRAINT role_check 
CHECK (role IN ('admin', 'viewer', 'business_development'));

-- 3. 기존 데이터 확인 및 업데이트 (필요시)
-- 기존에 다른 값이 있다면 'viewer'로 변경
UPDATE public.users 
SET role = 'viewer' 
WHERE role NOT IN ('admin', 'viewer', 'business_development');

-- 4. 제약조건 확인
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
AND contype = 'c'
AND conname = 'role_check';

-- 5. 현재 users 테이블의 role 분포 확인
SELECT role, COUNT(*) as user_count
FROM public.users
GROUP BY role
ORDER BY role;
