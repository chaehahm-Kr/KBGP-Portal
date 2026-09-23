-- 0074_po_shipping_documents.sql — Shared PO & Shipping Documents Table & Duplicate Readiness Cleanup

-- 1. Create purchase_order_documents table
CREATE TABLE IF NOT EXISTS public.purchase_order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders (id) ON DELETE CASCADE,
  goods_readiness_id UUID REFERENCES public.goods_readiness (id) ON DELETE SET NULL,
  inbound_shipment_id UUID REFERENCES public.inbound_shipments (id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.companies (id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'PACKING_LIST',
    'COMMERCIAL_INVOICE',
    'CERTIFICATE_OF_ORIGIN',
    'PRODUCT_SPECIFICATION',
    'CUSTOMS_DOCUMENT',
    'OTHER'
  )),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT,
  note TEXT,
  uploaded_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  uploader_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_order_documents IS '발주 및 선적 관련 공유 증빙 서류 (Shared PO & Shipping Documents)';

-- Enable RLS
ALTER TABLE public.purchase_order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_documents FORCE ROW LEVEL SECURITY;

-- Helper security function: auth_owns_po_document
CREATE OR REPLACE FUNCTION public.auth_owns_po_document(doc_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_order_documents pod
    JOIN public.purchase_orders po ON pod.purchase_order_id = po.id
    WHERE pod.id = doc_id AND (
      public.auth_is_admin() OR po.supplier_id = public.auth_company_id()
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_owns_po_document(UUID) TO authenticated;

-- Policies for purchase_order_documents
DROP POLICY IF EXISTS "po_documents_select" ON public.purchase_order_documents;
CREATE POLICY "po_documents_select"
  ON public.purchase_order_documents FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_documents.purchase_order_id
        AND po.supplier_id = public.auth_company_id()
    )
  );

DROP POLICY IF EXISTS "po_documents_admin_all" ON public.purchase_order_documents;
CREATE POLICY "po_documents_admin_all"
  ON public.purchase_order_documents FOR ALL
  TO authenticated
  USING (public.auth_is_admin())
  WITH CHECK (public.auth_is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.purchase_order_documents FROM authenticated, anon;

-- 2. Cleanup duplicate Goods Readiness records for PO-2026-0008 (keep latest b53fa97c-fabe-48e3-8d20-e4ed7bb5c5d0, remove older duplicates)
DELETE FROM public.goods_readiness_lines 
WHERE goods_readiness_id IN (
  '63ac9bf8-cbc6-4fed-a737-b1aaa35264c7',
  '9fbced63-b402-4762-8803-b218882900e9',
  '83b6315f-7f35-4cd4-8a25-60760d392ca7'
);

DELETE FROM public.goods_readiness 
WHERE id IN (
  '63ac9bf8-cbc6-4fed-a737-b1aaa35264c7',
  '9fbced63-b402-4762-8803-b218882900e9',
  '83b6315f-7f35-4cd4-8a25-60760d392ca7'
);
