-- 0093_po_visibility_revisions_and_notifications.sql
-- PO Visibility, Revision, Cancellation & Supplier Confirmation Control (ADM-PUR-006 & PORT-PO-007)

-- 1. Add revision, confirmation, cancellation, and log columns to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS revision_no integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS confirmed_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by_name text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_status varchar(50) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_confirmed_by text,
  ADD COLUMN IF NOT EXISTS cancellation_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_rejected_by text,
  ADD COLUMN IF NOT EXISTS cancellation_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reject_reason text,
  ADD COLUMN IF NOT EXISTS activity_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revisions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Add related_po_id to partner_inquiries (for Case Management cross-linking)
ALTER TABLE public.partner_inquiries
  ADD COLUMN IF NOT EXISTS related_po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partner_inquiries_related_po_id ON public.partner_inquiries(related_po_id);

-- 3. Create or update public.notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type varchar(50) NOT NULL,
  title varchar(200) NOT NULL,
  content text NOT NULL,
  link_url varchar(255),
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (company_id IS NOT NULL AND company_id = public.auth_company_id())
    OR public.auth_is_admin()
  );

DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
CREATE POLICY "notifications_update_policy" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (company_id IS NOT NULL AND company_id = public.auth_company_id())
    OR public.auth_is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (company_id IS NOT NULL AND company_id = public.auth_company_id())
    OR public.auth_is_admin()
  );

DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
CREATE POLICY "notifications_insert_policy" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
CREATE POLICY "notifications_delete_policy" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.auth_is_admin()
  );

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 4. Re-create portal_purchase_orders view with strict PO Visibility Rule:
-- DRAFT and APPROVED are strictly hidden from Portal.
-- Only SENT and subsequent states (Pending, Confirmed, Revised, Cancelled-after-sent) are visible.
DROP VIEW IF EXISTS public.portal_purchase_orders CASCADE;

CREATE OR REPLACE VIEW public.portal_purchase_orders WITH (security_barrier) AS
SELECT 
  id,
  po_number,
  supplier_id,
  order_date,
  po_status,
  fulfillment_status,
  supplier_confirmation_status,
  currency,
  payment_terms,
  incoterms,
  port_of_loading,
  expected_ready_date,
  expected_ship_date,
  eta,
  destination_warehouse_id,
  ship_from_warehouse_id,
  po_receiving_email,
  supplier_facing_note,
  revision_no,
  confirmed_by_id,
  confirmed_by_name,
  confirmed_at,
  cancellation_status,
  cancellation_reason,
  cancellation_requested_by,
  cancellation_requested_at,
  cancellation_confirmed_by,
  cancellation_confirmed_at,
  cancellation_rejected_by,
  cancellation_rejected_at,
  cancellation_reject_reason,
  activity_logs,
  revisions,
  sent_at,
  created_at,
  updated_at
FROM public.purchase_orders
WHERE 
  public.auth_is_admin()
  OR 
  (supplier_id = public.auth_company_id() AND po_status NOT IN ('DRAFT', 'APPROVED'));

GRANT SELECT ON public.portal_purchase_orders TO authenticated;
