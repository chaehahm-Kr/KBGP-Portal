-- 0030_staff_birthday.sql — 내부 직원 생일(birthday) 컬럼 추가

ALTER TABLE public.staff_members ADD COLUMN IF NOT EXISTS birthday date;

COMMENT ON COLUMN public.staff_members.birthday IS '내부 직원 생년월일';
