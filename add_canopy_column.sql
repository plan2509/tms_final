-- charging_stations 테이블에 canopy_installed 컬럼 추가
ALTER TABLE public.charging_stations 
ADD COLUMN IF NOT EXISTS canopy_installed BOOLEAN DEFAULT FALSE;