-- 0166_net_terms_credit_reservation.sql
-- RTP-ORDER-PHASE-B4-001: Net Terms Credit Reservation, AR Reconciliation & Concurrency-Safe Credit Limit Guard

-- 1. Function: compute_retailer_credit_exposure(p_company_id uuid)
-- Returns authoritative live financial metrics:
-- credit_limit, open_ar, unbilled_reservation, total_exposure, available_credit, over_limit_amount
CREATE OR REPLACE FUNCTION public.compute_retailer_credit_exposure(
  p_company_id UUID
)
RETURNS TABLE (
  credit_limit NUMERIC(12, 2),
  open_ar NUMERIC(12, 2),
  unbilled_reservation NUMERIC(12, 2),
  total_exposure NUMERIC(12, 2),
  available_credit NUMERIC(12, 2),
  over_limit_amount NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credit_limit NUMERIC(12, 2) := 0.00;
  v_open_ar NUMERIC(12, 2) := 0.00;
  v_unbilled_reservation NUMERIC(12, 2) := 0.00;
  v_total_exposure NUMERIC(12, 2) := 0.00;
  v_available_credit NUMERIC(12, 2) := 0.00;
  v_over_limit_amount NUMERIC(12, 2) := 0.00;
BEGIN
  -- A. Fetch Credit Limit
  SELECT COALESCE(rp.credit_limit, 0.00)
  INTO v_credit_limit
  FROM public.retailer_profiles rp
  WHERE rp.company_id = p_company_id;

  IF v_credit_limit IS NULL THEN
    v_credit_limit := 0.00;
  END IF;

  -- B. Fetch Open AR from active issued invoices (excluding void and cancelled)
  SELECT COALESCE(SUM(ri.balance_due), 0.00)
  INTO v_open_ar
  FROM public.retailer_invoices ri
  WHERE ri.retailer_company_id = p_company_id
    AND ri.invoice_status NOT IN ('void', 'cancelled')
    AND ri.balance_due > 0;

  IF v_open_ar IS NULL THEN
    v_open_ar := 0.00;
  END IF;

  -- C. Fetch Unbilled Reservation across active Net Terms orders
  -- Excludes: cancelled, shipped, delivered orders, and prepaid (card/ach) orders
  SELECT COALESCE(SUM(
    GREATEST(0.00,
      ro.total_amount -
      COALESCE((
        SELECT SUM(ri.total_amount)
        FROM public.retailer_invoices ri
        WHERE ri.order_id = ro.id
          AND ri.invoice_status NOT IN ('void', 'cancelled')
      ), 0.00) -
      CASE
        WHEN ro.total_ordered_units > 0 AND ro.total_cancelled_units > 0 THEN
          (ro.total_amount * (ro.total_cancelled_units::numeric / ro.total_ordered_units::numeric))
        ELSE 0.00
      END
    )
  ), 0.00)
  INTO v_unbilled_reservation
  FROM public.retailer_orders ro
  WHERE ro.company_id = p_company_id
    AND (
      ro.payment_method = 'terms' OR
      (ro.payment_terms IS NOT NULL AND UPPER(ro.payment_terms) NOT IN ('PREPAID', 'PREPAID_CARD', 'PREPAID_ACH', 'CARD', 'ACH'))
    )
    AND ro.order_status NOT IN ('cancelled', 'shipped', 'delivered');

  IF v_unbilled_reservation IS NULL THEN
    v_unbilled_reservation := 0.00;
  END IF;

  -- D. Compute Total Exposure & Available Credit
  v_total_exposure := ROUND(v_open_ar + v_unbilled_reservation, 2);
  v_available_credit := GREATEST(0.00, ROUND(v_credit_limit - v_total_exposure, 2));
  v_over_limit_amount := GREATEST(0.00, ROUND(v_total_exposure - v_credit_limit, 2));

  RETURN QUERY SELECT
    v_credit_limit,
    v_open_ar,
    v_unbilled_reservation,
    v_total_exposure,
    v_available_credit,
    v_over_limit_amount;
END;
$$;

-- 2. Trigger Function: Concurrency-Safe Net Terms Credit Guard
-- Acquires row-level lock on retailer_profiles FOR UPDATE and checks credit limit
CREATE OR REPLACE FUNCTION public.trg_validate_retailer_net_terms_order_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_net_terms BOOLEAN := false;
  v_credit_limit NUMERIC(12, 2);
  v_open_ar NUMERIC(12, 2);
  v_unbilled_reservation NUMERIC(12, 2);
  v_total_exposure NUMERIC(12, 2);
  v_available_credit NUMERIC(12, 2);
  v_over_limit_amount NUMERIC(12, 2);
BEGIN
  -- Determine if order is placed under Net Terms
  IF NEW.payment_method = 'terms' OR (
    NEW.payment_terms IS NOT NULL AND
    UPPER(NEW.payment_terms) NOT IN ('PREPAID', 'PREPAID_CARD', 'PREPAID_ACH', 'CARD', 'ACH')
  ) THEN
    v_is_net_terms := true;
  END IF;

  -- If not Net Terms (Card, ACH prepaid), bypass credit reservation
  IF NOT v_is_net_terms THEN
    RETURN NEW;
  END IF;

  -- Concurrency Protection: Lock retailer profile FOR UPDATE to serialize checkouts for this company
  SELECT rp.credit_limit
  INTO v_credit_limit
  FROM public.retailer_profiles rp
  WHERE rp.company_id = NEW.company_id
  FOR UPDATE;

  -- Compute current exposure from authoritative database records
  SELECT
    exp.credit_limit,
    exp.open_ar,
    exp.unbilled_reservation,
    exp.total_exposure,
    exp.available_credit,
    exp.over_limit_amount
  INTO
    v_credit_limit,
    v_open_ar,
    v_unbilled_reservation,
    v_total_exposure,
    v_available_credit,
    v_over_limit_amount
  FROM public.compute_retailer_credit_exposure(NEW.company_id) exp;

  -- Validate whether new order amount exceeds available credit
  IF NEW.total_amount > v_available_credit THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDIT: Your available credit is not enough for this order ($% exceeds available credit $%). Total credit exposure is $% against approved credit line $%. Please choose Card or ACH.',
      TO_CHAR(ROUND(NEW.total_amount, 2), 'FM999,999,990.00'),
      TO_CHAR(ROUND(v_available_credit, 2), 'FM999,999,990.00'),
      TO_CHAR(ROUND(v_total_exposure, 2), 'FM999,999,990.00'),
      TO_CHAR(ROUND(v_credit_limit, 2), 'FM999,999,990.00');
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach Trigger to public.retailer_orders
DROP TRIGGER IF EXISTS trg_enforce_net_terms_credit ON public.retailer_orders;

CREATE TRIGGER trg_enforce_net_terms_credit
BEFORE INSERT ON public.retailer_orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_retailer_net_terms_order_credit();

-- 4. PostgREST Schema Cache Reload
NOTIFY pgrst, 'reload schema';
