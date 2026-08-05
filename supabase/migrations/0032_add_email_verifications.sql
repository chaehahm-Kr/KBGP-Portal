-- 0032_add_email_verifications.sql — 이메일 인증 관련 테이블 추가

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS email_verifications_email_idx ON public.email_verifications(email);
CREATE INDEX IF NOT EXISTS email_verifications_created_at_idx ON public.email_verifications(created_at DESC);

-- RLS 활성화 및 잠금
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_verifications IS '파트너십 신청서 접수 전 이메일 소유인증 정보 테이블';
