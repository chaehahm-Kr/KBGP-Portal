-- 0026_generate_inquiry_number.sql — 고유 번호 발급 함수 추가
--
-- 마케팅 접수 시 'APP-YYYYMMDD-XXXX' 형식의 순차 번호를 발급하는
-- 시퀀스 및 DB 함수를 추가합니다.

CREATE SEQUENCE IF NOT EXISTS public.inquiry_number_seq;

CREATE OR REPLACE FUNCTION public.generate_inquiry_number()
RETURNS text 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today_str text;
  seq_val bigint;
  result_num text;
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  seq_val := nextval('public.inquiry_number_seq');
  result_num := 'APP-' || today_str || '-' || lpad(seq_val::text, 4, '0');
  RETURN result_num;
END;
$$;

COMMENT ON FUNCTION public.generate_inquiry_number() IS 
  '마케팅 접수 및 신청서 제출 시 YYYYMMDD 날짜와 순차 시퀀스를 조합한 APP-YYYYMMDD-XXXX 고유번호 발급';
