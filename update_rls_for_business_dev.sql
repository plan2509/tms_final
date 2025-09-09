-- RLS 정책 업데이트: business_development 권한 추가
-- 사업 개발 권한은 충전소와 사업 일정 관련 작업에 접근 가능

-- 1. station_schedules 테이블 정책 업데이트
DO $$ 
BEGIN
    -- 기존 정책 삭제
    DROP POLICY IF EXISTS "Admins can manage station schedules" ON public.station_schedules;
    
    -- 새 정책 생성 (admin과 business_development 모두 허용)
    CREATE POLICY "Admins and business dev can manage station schedules" ON public.station_schedules
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.role IN ('admin', 'business_development')
            )
        );
END $$;

-- 2. notification_schedules 테이블 정책 업데이트
DO $$ 
BEGIN
    -- 기존 정책 삭제
    DROP POLICY IF EXISTS "Admins can manage notification schedules" ON public.notification_schedules;
    
    -- 새 정책 생성 (admin만 허용 - 알림 관리는 관리자 전용)
    CREATE POLICY "Admins can manage notification schedules" ON public.notification_schedules
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.role = 'admin'
            )
        );
END $$;

-- 3. teams_channels 테이블 정책 업데이트
DO $$ 
BEGIN
    -- 기존 정책 삭제
    DROP POLICY IF EXISTS "Admins can manage teams channels" ON public.teams_channels;
    
    -- 새 정책 생성 (admin만 허용 - Teams 채널 관리는 관리자 전용)
    CREATE POLICY "Admins can manage teams channels" ON public.teams_channels
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.role = 'admin'
            )
        );
END $$;

-- 4. notifications 테이블 정책 업데이트
DO $$ 
BEGIN
    -- 기존 정책 삭제
    DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
    
    -- 새 정책 생성 (admin만 허용 - 알림 관리는 관리자 전용)
    CREATE POLICY "Admins can manage notifications" ON public.notifications
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.role = 'admin'
            )
        );
END $$;

-- 5. charging_stations 테이블 정책 확인 및 업데이트 (필요시)
DO $$ 
BEGIN
    -- 기존 정책이 admin만 허용하는지 확인
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'charging_stations' 
        AND policyname LIKE '%admin%'
        AND qual LIKE '%role = ''admin''%'
    ) THEN
        -- 기존 정책 삭제
        DROP POLICY IF EXISTS "Admins can manage charging stations" ON public.charging_stations;
        
        -- 새 정책 생성 (admin과 business_development 모두 허용)
        CREATE POLICY "Admins and business dev can manage charging stations" ON public.charging_stations
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.role IN ('admin', 'business_development')
                )
            );
    END IF;
END $$;

-- 6. taxes 테이블 정책 확인 및 업데이트 (필요시)
DO $$ 
BEGIN
    -- 기존 정책이 admin만 허용하는지 확인
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'taxes' 
        AND policyname LIKE '%admin%'
        AND qual LIKE '%role = ''admin''%'
    ) THEN
        -- 기존 정책 삭제
        DROP POLICY IF EXISTS "Admins can manage taxes" ON public.taxes;
        
        -- 새 정책 생성 (admin과 business_development 모두 허용)
        CREATE POLICY "Admins and business dev can manage taxes" ON public.taxes
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.role IN ('admin', 'business_development')
                )
            );
    END IF;
END $$;

-- 7. 정책 확인 쿼리
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('station_schedules', 'notification_schedules', 'teams_channels', 'notifications', 'charging_stations', 'taxes')
ORDER BY tablename, policyname;
