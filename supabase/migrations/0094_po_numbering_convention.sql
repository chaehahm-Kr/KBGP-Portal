-- 0094_po_numbering_convention.sql
-- PO Numbering Convention Update: PO-YYYYMMDD-COMPANYCODE-### (ADM-PUR-007)

CREATE OR REPLACE FUNCTION public.set_purchase_order_number()
RETURNS TRIGGER AS $$
DECLARE
  v_company_code text;
  v_date_str text;
  v_prefix text;
  v_next_seq integer;
BEGIN
  IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
    -- Fetch supplier company code
    SELECT UPPER(TRIM(company_code)) INTO v_company_code
    FROM public.companies
    WHERE id = NEW.supplier_id;

    IF v_company_code IS NULL OR v_company_code = '' THEN
      v_company_code := 'UNK';
    END IF;

    v_date_str := to_char(COALESCE(NEW.order_date, CURRENT_DATE), 'YYYYMMDD');
    v_prefix := 'PO-' || v_date_str || '-' || v_company_code || '-';

    SELECT COALESCE(MAX(
      CASE 
        WHEN po_number ~ ('^' || v_prefix || '[0-9]+$') THEN
          SUBSTRING(po_number FROM length(v_prefix) + 1)::integer
        ELSE 0
      END
    ), 0) + 1 INTO v_next_seq
    FROM public.purchase_orders
    WHERE supplier_id = NEW.supplier_id AND order_date = COALESCE(NEW.order_date, CURRENT_DATE);

    NEW.po_number := v_prefix || lpad(v_next_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_purchase_order_number() IS 'Auto-generates PO Number following format PO-YYYYMMDD-COMPANYCODE-### if not provided';
