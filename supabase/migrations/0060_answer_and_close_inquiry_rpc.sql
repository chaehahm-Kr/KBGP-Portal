-- 0060_answer_and_close_inquiry_rpc.sql
-- RPC function to atomically answer and close a partner inquiry (transaction-safe)
-- AND trigger to automatically sync parent updated_at timestamp on child message changes

-- 1) RPC Function for Answer and Close
CREATE OR REPLACE FUNCTION public.answer_and_close_partner_inquiry(
  p_inquiry_id UUID,
  p_reply_content TEXT,
  p_replied_by UUID,
  p_admin_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1) Update partner_inquiries
  UPDATE public.partner_inquiries
  SET
    status = 'closed',
    reply_content = p_reply_content,
    replied_by = p_replied_by,
    replied_at = v_now,
    closed_at = v_now,
    closed_by = p_replied_by,
    is_action_required = FALSE,
    updated_at = v_now
  WHERE id = p_inquiry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inquiry not found';
  END IF;

  -- 2) Insert admin answer and system close message into thread
  INSERT INTO public.partner_inquiry_messages (
    inquiry_id,
    sender_type,
    sender_id,
    sender_name,
    content,
    message_type,
    is_action_flag,
    created_at
  ) VALUES
  (
    p_inquiry_id,
    'admin',
    p_replied_by,
    p_admin_name,
    p_reply_content,
    'message',
    FALSE,
    v_now
  ),
  (
    p_inquiry_id,
    'admin',
    p_replied_by,
    '시스템',
    '어드민 담당자가 답변 등록 후 케이스를 종료했습니다.',
    'case_closed',
    FALSE,
    v_now
  );

END;
$$;

COMMENT ON FUNCTION public.answer_and_close_partner_inquiry(UUID, TEXT, UUID, TEXT) IS
  '답변 등록 및 케이스 종료 처리를 원자성(Transaction-safe) 있게 일괄 처리합니다.';


-- 2) Trigger to sync parent partner_inquiries.updated_at automatically on child message insert/update/delete
CREATE OR REPLACE FUNCTION public.trg_update_partner_inquiries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.partner_inquiries
  SET updated_at = now()
  WHERE id = COALESCE(NEW.inquiry_id, OLD.inquiry_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_inquiry_messages_updated_at ON public.partner_inquiry_messages;

CREATE TRIGGER trg_partner_inquiry_messages_updated_at
  AFTER INSERT OR UPDATE OR DELETE ON public.partner_inquiry_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_partner_inquiries_updated_at();

COMMENT ON FUNCTION public.trg_update_partner_inquiries_updated_at() IS
  'partner_inquiry_messages의 변경 사항(댓글 추가 등) 발생 시 parent partner_inquiries.updated_at 타임스탬프를 갱신합니다.';
