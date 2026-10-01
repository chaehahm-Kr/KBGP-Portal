-- 0095_invoice_remittance_and_case_link.sql
-- PORT-FIN-001 / ADM-FIN-001 / ADM-CASE-002
-- 1. PO-based Single Active Invoice Constraint
-- 2. Remittance Account Snapshot on Supplier Invoices
-- 3. Settlement Inquiry Case Integration (related_invoice_id, related_po_id)

-- 1. Partner Inquiries: Add related_invoice_id and ensure related_po_id
ALTER TABLE public.partner_inquiries
  ADD COLUMN IF NOT EXISTS related_po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_invoice_id UUID REFERENCES public.supplier_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_related_invoice_id ON public.partner_inquiries(related_invoice_id);
CREATE INDEX IF NOT EXISTS idx_partner_inquiries_related_po_id ON public.partner_inquiries(related_po_id);

-- 2. Supplier Invoices: Add remittance snapshot columns
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS supplier_remittance_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remittance_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS remittance_beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS remittance_account_number TEXT,
  ADD COLUMN IF NOT EXISTS remittance_account_last4 TEXT,
  ADD COLUMN IF NOT EXISTS remittance_routing_number TEXT,
  ADD COLUMN IF NOT EXISTS remittance_swift_bic_masked TEXT,
  ADD COLUMN IF NOT EXISTS remittance_currency TEXT,
  ADD COLUMN IF NOT EXISTS remittance_payment_method TEXT;

-- 3. Void redundant empty draft invoice for PO-2026-0008 to enforce 1 active invoice per PO
UPDATE public.supplier_invoices
SET invoice_status = 'VOID',
    voided_at = now(),
    internal_note = COALESCE(internal_note || E'\n', '') || 'Auto-voided duplicate draft invoice upon enforcement of one active invoice per PO policy.'
WHERE id = '6bc9c7f1-a277-43bf-b9cf-47d6c2919c93'
  AND invoice_status = 'DRAFT'
  AND purchase_order_id = 'acbc3a9e-3769-4e2f-84bf-430c176bda5e';

-- 4. Create Partial Unique Index: 1 Active Invoice per PO
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoices_one_active_per_po
  ON public.supplier_invoices(purchase_order_id)
  WHERE invoice_status NOT IN ('VOID', 'REJECTED');
