-- 0092_po_requests_workflow.sql — PO Request to Official PO Conversion Schema

-- 1. PO Requests Header Table
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

-- Indexes for performance & security
CREATE INDEX IF NOT EXISTS idx_po_requests_company_id ON public.po_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_po_requests_status ON public.po_requests(status);
CREATE INDEX IF NOT EXISTS idx_po_requests_created_at ON public.po_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_requests_converted_po_id ON public.po_requests(converted_po_id);

-- 2. PO Request Lines Table
CREATE TABLE IF NOT EXISTS public.po_request_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_request_id UUID NOT NULL REFERENCES public.po_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICTED,
  product_name_snapshot TEXT NOT NULL,
  letusto_sku_snapshot TEXT,
  manufacture_sku_snapshot TEXT,
  requested_qty INT NOT NULL CHECK (requested_qty > 0),
  reference_unit_cost NUMERIC(15, 4) NOT NULL DEFAULT 0,
  estimated_line_total NUMERIC(15, 4) NOT NULL DEFAULT 0,
  admin_final_qty INT,
  admin_final_unit_cost NUMERIC(15, 4),
  admin_final_line_total NUMERIC(15, 4),
  line_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_request_lines_request_id ON public.po_request_lines(po_request_id);
CREATE INDEX IF NOT EXISTS idx_po_request_lines_product_id ON public.po_request_lines(product_id);

-- 3. PO Request Audit History Table
CREATE TABLE IF NOT EXISTS public.po_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_request_id UUID NOT NULL REFERENCES public.po_requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_request_history_request_id ON public.po_request_history(po_request_id);
CREATE INDEX IF NOT EXISTS idx_po_request_history_created_at ON public.po_request_history(created_at DESC);

-- 4. PO Request Attachments Table
CREATE TABLE IF NOT EXISTS public.po_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_request_id UUID NOT NULL REFERENCES public.po_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_request_attachments_request_id ON public.po_request_attachments(po_request_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.po_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_request_attachments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DROP POLICY IF EXISTS "Service role full access on po_requests" ON public.po_requests;
CREATE POLICY "Service role full access on po_requests" ON public.po_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on po_request_lines" ON public.po_request_lines;
CREATE POLICY "Service role full access on po_request_lines" ON public.po_request_lines FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on po_request_history" ON public.po_request_history;
CREATE POLICY "Service role full access on po_request_history" ON public.po_request_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on po_request_attachments" ON public.po_request_attachments;
CREATE POLICY "Service role full access on po_request_attachments" ON public.po_request_attachments FOR ALL USING (true) WITH CHECK (true);
