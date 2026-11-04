-- ==============================================================================
-- ADM-EMAIL-APP-016-R1: Historical Campaign Delivery Reconciliation
-- Target Campaign: cd741964-4c51-431e-bc9e-3c2eb32ddcef
-- Campaign Name: 20261102-1500-KBGP-Brand Outreach-Wave
--
-- INVARIANTS SATISFIED:
-- 1. marketing_delivery_events is 100% UNTOUCHED (append-only immutability preserved).
-- 2. campaign stats JSON is merged with jsonb || (existing fields preserved).
-- 3. Strict campaign provenance filter (01a19e47% / 01a19e84%) prevents contamination.
-- 4. Terminal statuses: 639 DELIVERED, 53 BOUNCED, 7 FAILED, 1 PENDING.
-- 5. Primary keys, company IDs, approval snapshot, send lock strictly preserved.
-- 6. Transaction-level PL/pgSQL assertions force rollback on any count deviation.
-- 7. Fully idempotent (safe to execute multiple times).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- Step 1: Update Preflight-Suppressed Recipients (7 recipients)
-- Resend accepted dispatch but rejected delivery before transmission due to prior suppression.
-- ------------------------------------------------------------------------------
UPDATE public.marketing_campaign_recipients r
SET 
  status = 'FAILED',
  provider_message_id = v.provider_message_id,
  error_message = 'Resend preflight suppressed (prior bounce or suppression)',
  sent_at = COALESCE(r.sent_at, '2026-11-02T22:00:00Z'::timestamptz),
  updated_at = now()
FROM (VALUES
  ('oo@oo.com', '01a19e84-fa5d-7556-89b1-38a0598e3e6f'),
  ('example@email.com', '01a19e47-938b-71fc-b0b3-8fa9a12c8a2b'),
  ('a@gmail.com', '01a19e84-fa5d-79e4-b7c1-65476a26cf6f'),
  ('pr@kobizstar.com', '01a19e84-fa5d-768a-b850-7056461c28c8'),
  ('email@email.com', '01a19e47-8e10-72ee-bc54-52a4e9bca9a5'),
  ('000@gmail.com', '01a19e84-fa5d-79f9-bd13-17638ceec2cf'),
  ('8c4075d5481d476e945486754f783364@sentry.io', '01a19e84-fa5d-754d-a51f-6ef54a37c093')
) AS v(recipient_email, provider_message_id)
WHERE r.campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'
  AND r.recipient_email = v.recipient_email
  AND r.send_eligibility = 'ELIGIBLE';

-- ------------------------------------------------------------------------------
-- Step 2: Update Transmitted Recipients from Verified Delivery Ledger (692 recipients)
-- Provenance filter: 01a19e47% (Batch API) and 01a19e84% (Broadcast)
-- Resolves: 639 DELIVERED, 53 BOUNCED (48 immediate bounces + 5 remote MTA rejections)
-- ------------------------------------------------------------------------------
WITH campaign_events AS (
  SELECT 
    recipient_email,
    provider_message_id,
    event_type,
    occurred_at
  FROM public.marketing_delivery_events
  WHERE provider_message_id LIKE '01a19e47-%' 
     OR provider_message_id LIKE '01a19e84-%'
),
resolved_events AS (
  SELECT DISTINCT ON (recipient_email)
    recipient_email,
    provider_message_id,
    CASE 
      WHEN event_type = 'email.bounced' THEN 'BOUNCED'
      ELSE 'DELIVERED'
    END AS final_status,
    occurred_at
  FROM campaign_events
  ORDER BY 
    recipient_email, 
    CASE WHEN event_type = 'email.bounced' THEN 1 ELSE 2 END,
    occurred_at DESC
)
UPDATE public.marketing_campaign_recipients r
SET 
  status = re.final_status,
  provider_message_id = re.provider_message_id,
  sent_at = COALESCE(r.sent_at, '2026-11-02T22:00:00Z'::timestamptz),
  delivered_at = CASE WHEN re.final_status = 'DELIVERED' THEN COALESCE(r.delivered_at, re.occurred_at) ELSE NULL END,
  error_message = CASE WHEN re.final_status = 'BOUNCED' THEN 'Undelivered (Remote MTA Rejection / Bounce)' ELSE NULL END,
  updated_at = now()
FROM resolved_events re
WHERE r.campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'
  AND r.recipient_email = re.recipient_email
  AND r.send_eligibility = 'ELIGIBLE';

-- ------------------------------------------------------------------------------
-- Step 3: Transaction-Level Assertions (PL/pgSQL Block)
-- Enforces 100% precision: raises exception and forces rollback if any count differs.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_campaign_id CONSTANT uuid := 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid;
  v_total integer;
  v_delivered integer;
  v_bounced integer;
  v_failed integer;
  v_pending integer;
  v_with_msg_id integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.marketing_campaign_recipients
  WHERE campaign_id = v_campaign_id;

  SELECT count(*) INTO v_delivered
  FROM public.marketing_campaign_recipients
  WHERE campaign_id = v_campaign_id AND status = 'DELIVERED';

  SELECT count(*) INTO v_bounced
  FROM public.marketing_campaign_recipients
  WHERE campaign_id = v_campaign_id AND status = 'BOUNCED';

  SELECT count(*) INTO v_failed
  FROM public.marketing_campaign_recipients
  WHERE campaign_id = v_campaign_id AND status = 'FAILED';

  SELECT count(*) INTO v_pending
  FROM public.marketing_campaign_recipients
  WHERE campaign_id = v_campaign_id AND status = 'PENDING';

  SELECT count(*) INTO v_with_msg_id
  FROM public.marketing_campaign_recipients
  WHERE campaign_id = v_campaign_id AND provider_message_id IS NOT NULL;

  IF v_total != 700 THEN
    RAISE EXCEPTION 'Assertion failed: total recipients % != 700', v_total;
  END IF;

  IF v_delivered != 639 THEN
    RAISE EXCEPTION 'Assertion failed: DELIVERED count % != 639', v_delivered;
  END IF;

  IF v_bounced != 53 THEN
    RAISE EXCEPTION 'Assertion failed: BOUNCED count % != 53', v_bounced;
  END IF;

  IF v_failed != 7 THEN
    RAISE EXCEPTION 'Assertion failed: FAILED count % != 7', v_failed;
  END IF;

  IF v_pending != 1 THEN
    RAISE EXCEPTION 'Assertion failed: PENDING count % != 1', v_pending;
  END IF;

  IF v_with_msg_id != 699 THEN
    RAISE EXCEPTION 'Assertion failed: provider_message_id count % != 699', v_with_msg_id;
  END IF;

  RAISE NOTICE 'ADM-EMAIL-APP-016-R1: All recipient outcome assertions passed successfully: 639 DELIVERED, 53 BOUNCED, 7 FAILED, 1 PENDING, 699 provider IDs.';
END $$;

-- ------------------------------------------------------------------------------
-- Step 4: Update Campaign Stats (Preserving Existing JSON Keys via Merge)
-- Preserves: liveActivatedAt, liveActivatedBy, totalRecipients, sendableCount, etc.
-- ------------------------------------------------------------------------------
UPDATE public.marketing_campaigns
SET 
  stats = COALESCE(stats, '{}'::jsonb) || jsonb_build_object(
    'sentCount', 699,
    'deliveredCount', 639,
    'failedCount', 60,
    'bouncedCount', 53,
    'suppressedCount', 7,
    'deliveryStatus', 'COMPLETED',
    'isSendLocked', true,
    'reconciledAt', now(),
    'reconciledBy', 'admin (ADM-EMAIL-APP-016-R1)',
    'reconciliationNote', 'ADM-EMAIL-APP-016-R1: Historical reconciliation of 300 Batch + 399 Broadcast outreach'
  ),
  updated_at = now()
WHERE id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef';

-- ------------------------------------------------------------------------------
-- Step 5: Idempotent Audit Log Entry
-- Records reconciliation in marketing_campaign_logs if not already present.
-- ------------------------------------------------------------------------------
INSERT INTO public.marketing_campaign_logs (
  campaign_id,
  recipient_id,
  event_type,
  is_test_mode,
  details,
  performed_by,
  created_at
)
SELECT 
  'cd741964-4c51-431e-bc9e-3c2eb32ddcef'::uuid,
  NULL,
  'CAMPAIGN_HISTORICAL_RECONCILED',
  false,
  jsonb_build_object(
    'task', 'ADM-EMAIL-APP-016-R1',
    'action', 'RECONCILE_HISTORICAL_DISPATCH',
    'batch_count', 300,
    'broadcast_count', 399,
    'total_unique_outreach', 699,
    'delivered_count', 639,
    'bounced_count', 53,
    'failed_count', 7,
    'excluded_unconfirmed_consent', 1,
    'total_recipients', 700,
    'reconciliation_timestamp', now()
  ),
  'admin (ADM-EMAIL-APP-016-R1)',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_campaign_logs
  WHERE campaign_id = 'cd741964-4c51-431e-bc9e-3c2eb32ddcef'
    AND event_type = 'CAMPAIGN_HISTORICAL_RECONCILED'
);

COMMIT;
