-- 0025_add_eligibility_responses.sql — 프로그램 참여 준비 사항(Readiness) 응답 컬럼 추가
--
-- 마케팅 사이트의 신청서 접수 단계(inquiries)와 포털 내 정식 신청서 단계(applications)에
-- 준비 사항 6개 문항 응답을 JSONB 배열 형태로 저장하기 위한 컬럼들을 추가한다.
-- 이전 과거 데이터와의 호환을 위해 Nullable로 생성한다.

-- public.inquiries 테이블 확장
ALTER TABLE public.inquiries 
ADD COLUMN eligibility_responses jsonb DEFAULT NULL;

COMMENT ON COLUMN public.inquiries.eligibility_responses IS 
  '공개 신청 시 제출한 프로그램 참여 준비 사항 6개 응답 (JSON 배열)';

-- public.applications 테이블 확장
ALTER TABLE public.applications 
ADD COLUMN eligibility_responses jsonb DEFAULT NULL;

COMMENT ON COLUMN public.applications.eligibility_responses IS 
  '신청서에 연결된 프로그램 참여 준비 사항 6개 응답 (Inquiry에서 이월된 값)';
