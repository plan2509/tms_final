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

-- 2. user_role ENUM 타입에 'business_development' 추가
ALTER TYPE user_role ADD VALUE 'business_development';

-- 3. ENUM 타입 확인
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype 
ORDER BY enumsortorder;

-- 5. 현재 users 테이블의 role 분포 확인
SELECT role, COUNT(*) as user_count
FROM public.users
GROUP BY role
ORDER BY role;
