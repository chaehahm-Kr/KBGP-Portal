-- ==========================================================================
-- STANDALONE HISTORICAL CAMPAIGN RECONCILIATION SCRIPT (COMPACT & FAST)
-- Campaign ID: cd741964-4c51-431e-bc9e-3c2eb32ddcef
-- Standard: DEPLOY-STD-001 / Rule 24 (One-Click Copyable Pure SQL Block)
-- Mode: Safe, Idempotent Transactional Repair
-- Target Outcomes: 639 DELIVERED, 53 BOUNCED, 7 SUPPRESSED/FAILED, 1 EXCLUDED PRESERVED
-- ==========================================================================

BEGIN;

-- 1. Reconcile verified recipient deliveries & bounces from marketing_delivery_events
UPDATE public.marketing_campaign_recipients r
SET
  provider_message_id = de.provider_message_id,
  sent_at = COALESCE(r.sent_at, de.occurred_at),
  delivered_at = CASE WHEN de.event_type = 'email.delivered' THEN de.occurred_at ELSE NULL END,
  status = CASE WHEN de.event_type = 'email.delivered' THEN 'DELIVERED' ELSE 'BOUNCED' END,
  error_message = CASE WHEN de.event_type = 'email.bounced' THEN 'Resend mailbox delivery bounced' ELSE NULL END,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (recipient_email)
    recipient_email,
    provider_message_id,
    occurred_at,
    event_type
  FROM public.marketing_delivery_events
  ORDER BY recipient_email, occurred_at DESC
) de
WHERE r.campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid
  AND r.send_eligibility = 'ELIGIBLE'
  AND lower(trim(r.recipient_email)) = lower(trim(de.recipient_email));

-- 2. Apply terminal retroactive bounces confirmed by Resend API last_event audit
UPDATE public.marketing_campaign_recipients
SET
  status = 'BOUNCED',
  error_message = 'Resend mailbox delivery bounced (delayed remote MTA rejection)',
  delivered_at = NULL,
  updated_at = now()
WHERE campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid
  AND send_eligibility = 'ELIGIBLE'
  AND lower(trim(recipient_email)) IN (
    'missmore@naver.com',
    'info@zoebio.co.kr',
    'b2b@overlaps.co.kr',
    'afternoon@aekyung.kr',
    'offbeauty@qandbintl.com'
  );

-- 3. Record Resend preflight suppressed recipients (rejected prior to webhook dispatch)
UPDATE public.marketing_campaign_recipients
SET
  status = 'FAILED',
  error_message = 'Resend preflight suppressed (prior bounce or complaint)',
  updated_at = now()
WHERE campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid
  AND send_eligibility = 'ELIGIBLE'
  AND lower(trim(recipient_email)) IN (
    'oo@oo.com',
    'example@email.com',
    'a@gmail.com',
    'pr@kobizstar.com',
    'email@email.com',
    '000@gmail.com',
    '8c4075d5481d476e945486754f783364@sentry.io'
  );

-- 4. Backfill campaign_id and recipient_id on marketing_delivery_events ledger
UPDATE public.marketing_delivery_events e
SET
  campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid,
  recipient_id = r.id
FROM public.marketing_campaign_recipients r
WHERE e.provider_message_id = r.provider_message_id
  AND r.campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid
  AND e.campaign_id IS NULL;

-- 5. Align marketing_campaigns stats JSON and final status
UPDATE public.marketing_campaigns
SET
  status = 'COMPLETED',
  is_live_mode_enabled = false,
  stats = jsonb_build_object(
    'totalRecipients', 700,
    'sendableCount', 699,
    'excludedCount', 1,
    'sentCount', 699,
    'deliveredCount', 639,
    'failedCount', 60,
    'testSendsCount', 0,
    'isSendLocked', true,
    'deliveryStatus', 'COMPLETED',
    'liveActivatedAt', '2026-11-02T21:59:44.221Z',
    'liveActivatedBy', 'chae@letusto.com',
    'reconciledAt', now(),
    'reconciliationNote', 'ADM-EMAIL-APP-016: Historical reconciliation of 300 Batch + 399 Broadcast outreach'
  ),
  updated_at = now()
WHERE id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid;

-- 6. Record immutable reconciliation audit log in marketing_campaign_logs
INSERT INTO public.marketing_campaign_logs (
  campaign_id, event_type, is_test_mode, performed_by, details, created_at
) VALUES (
  'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid,
  'CAMPAIGN_RECONCILIATION_COMPLETED',
  false,
  'admin',
  jsonb_build_object(
    'task_id', 'ADM-EMAIL-APP-016',
    'totalApproved', 699,
    'batchSubmitted', 300,
    'broadcastSubmitted', 399,
    'delivered', 639,
    'bounced', 53,
    'suppressed', 7,
    'ledgerEventsLinked', 707
  ),
  now()
);

COMMIT;
