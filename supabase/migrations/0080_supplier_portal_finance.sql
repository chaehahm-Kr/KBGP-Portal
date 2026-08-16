-- 0080_supplier_portal_finance.sql — Supplier Portal Finance Write RLS & Column Restrictions
-- Enforces authority model where:
-- Invoices: Supplier can CREATE / UPDATE / DELETE when DRAFT, and transition DRAFT -> SUBMITTED.
-- Settlements/Payments: Supplier is VIEW ONLY, with no access to internal_note.

-- 1. Revoke raw write access for authenticated role on adjustments and payments (extra secure)
REVOKE INSERT, UPDATE, DELETE ON public.supplier_invoice_adjustments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.supplier_payments FROM authenticated, anon;

-- 2. Setup portal write policies on supplier_invoices
DROP POLICY IF EXISTS "supplier_invoices_portal_insert" ON public.supplier_invoices;
CREATE POLICY "supplier_invoices_portal_insert"
  ON public.supplier_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    supplier_company_id = public.auth_company_id()
    AND invoice_status = 'DRAFT'
    AND settlement_status = 'OPEN'
    AND amount_paid = 0
  );

DROP POLICY IF EXISTS "supplier_invoices_portal_update" ON public.supplier_invoices;
CREATE POLICY "supplier_invoices_portal_update"
  ON public.supplier_invoices FOR UPDATE
  TO authenticated
  USING (
    supplier_company_id = public.auth_company_id()
    AND invoice_status = 'DRAFT'
  )
  WITH CHECK (
    supplier_company_id = public.auth_company_id()
    AND invoice_status IN ('DRAFT', 'SUBMITTED')
    AND settlement_status = 'OPEN'
    AND amount_paid = 0
  );

DROP POLICY IF EXISTS "supplier_invoices_portal_delete" ON public.supplier_invoices;
CREATE POLICY "supplier_invoices_portal_delete"
  ON public.supplier_invoices FOR DELETE
  TO authenticated
  USING (
    supplier_company_id = public.auth_company_id()
    AND invoice_status = 'DRAFT'
  );

-- 3. Setup portal write policies on supplier_invoice_lines
DROP POLICY IF EXISTS "supplier_invoice_lines_portal_insert" ON public.supplier_invoice_lines;
CREATE POLICY "supplier_invoice_lines_portal_insert"
  ON public.supplier_invoice_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id
        AND si.supplier_company_id = public.auth_company_id()
        AND si.invoice_status = 'DRAFT'
    )
  );

DROP POLICY IF EXISTS "supplier_invoice_lines_portal_update" ON public.supplier_invoice_lines;
CREATE POLICY "supplier_invoice_lines_portal_update"
  ON public.supplier_invoice_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id
        AND si.supplier_company_id = public.auth_company_id()
        AND si.invoice_status = 'DRAFT'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id
        AND si.supplier_company_id = public.auth_company_id()
        AND si.invoice_status = 'DRAFT'
    )
  );

DROP POLICY IF EXISTS "supplier_invoice_lines_portal_delete" ON public.supplier_invoice_lines;
CREATE POLICY "supplier_invoice_lines_portal_delete"
  ON public.supplier_invoice_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id
        AND si.supplier_company_id = public.auth_company_id()
        AND si.invoice_status = 'DRAFT'
    )
  );

-- 4. Restrict column-level SELECT on adjustments to prevent internal_note leak
REVOKE SELECT ON public.supplier_invoice_adjustments FROM authenticated;
GRANT SELECT (
  id, supplier_invoice_id, supplier_invoice_line_id, adjustment_type, adjustment_direction,
  quantity, unit_amount, adjustment_amount, currency, reason, reference_type, reference_id,
  supplier_credit_reference, status, created_at, approved_at, rejected_at, rejection_reason, voided_at, updated_at
) ON public.supplier_invoice_adjustments TO authenticated;

-- 5. Restrict column-level SELECT on payments to prevent internal_note leak
REVOKE SELECT ON public.supplier_payments FROM authenticated;
GRANT SELECT (
  id, payment_number, supplier_invoice_id, supplier_remittance_id, payment_date, payment_amount,
  currency, payment_method, bank_reference, remittance_reference, attachment_path, status,
  remittance_bank_name, remittance_beneficiary_name, remittance_account_last4, remittance_swift_bic_masked,
  created_at, completed_at, voided_at, updated_at
) ON public.supplier_payments TO authenticated;
