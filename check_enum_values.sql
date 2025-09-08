-- charging_stations 테이블의 status enum 값 확인
SELECT unnest(enum_range(NULL::station_status)) as status_values;

-- 또는 테이블 구조 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'charging_stations' AND column_name = 'status';

-- 현재 충전소 데이터 확인
SELECT * FROM charging_stations LIMIT 10;
