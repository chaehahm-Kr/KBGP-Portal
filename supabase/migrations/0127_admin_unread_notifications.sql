-- 0127_admin_unread_notifications.sql
-- Unified Admin NEW / UNREAD Notification & Read-State System
-- Target Tables: applications, po_requests, products, supplier_invoices

-- 1. applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_admin_read_at ON public.applications(admin_read_at);

-- 2. po_requests (Ensure table exists, then add columns & index)
CREATE TABLE IF NOT EXISTS public.po_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICTED,
  contact_user_id UUID REFERENCES public.company_users(id) ON DELETE SET NULL,
  contact_name TEXT,
  contact_email TEXT,
  shipping_origin_id UUID REFERENCES public.company_shipping_origins(id) ON DELETE SET NULL,
  requested_ready_date DATE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGE_REQUESTED', 'CONVERTED_TO_PO', 'REJECTED', 'CANCELLED')),
  notes TEXT,
  admin_review_notes TEXT,
  change_request_reason TEXT,
  rejection_reason TEXT,
  converted_po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  converted_po_number TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.po_requests
  ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_requests_admin_read_at ON public.po_requests(admin_read_at);

-- 3. products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_admin_read_at ON public.products(admin_read_at);

-- 4. supplier_invoices
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS admin_read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_admin_read_at ON public.supplier_invoices(admin_read_at);

-- 5. Safe Backfill: Mark all existing historical records as already read so they do not flood the new notification badges.
UPDATE public.applications
  SET admin_read_at = COALESCE(submitted_at, created_at, now())
  WHERE admin_read_at IS NULL;

UPDATE public.po_requests
  SET admin_read_at = COALESCE(submitted_at, created_at, now())
  WHERE admin_read_at IS NULL;

UPDATE public.products
  SET admin_read_at = COALESCE(created_at, now())
  WHERE admin_read_at IS NULL;

UPDATE public.supplier_invoices
  SET admin_read_at = COALESCE(submitted_at, created_at, now())
  WHERE admin_read_at IS NULL;
