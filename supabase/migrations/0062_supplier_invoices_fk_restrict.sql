-- 0062_supplier_invoices_fk_restrict.sql — Financial AP Transaction Deletion Safety
-- Drop cascade delete constraints and enforce ON DELETE RESTRICT to preserve historical financial records.

-- 1. Modify supplier_invoices foreign keys
ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_supplier_company_id_fkey;
ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_purchase_order_id_fkey;

ALTER TABLE public.supplier_invoices 
  ADD CONSTRAINT supplier_invoices_supplier_company_id_fkey 
  FOREIGN KEY (supplier_company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE public.supplier_invoices 
  ADD CONSTRAINT supplier_invoices_purchase_order_id_fkey 
  FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE RESTRICT;

-- 2. Modify supplier_invoice_lines foreign keys to prevent deleting associated PO lines or products
ALTER TABLE public.supplier_invoice_lines DROP CONSTRAINT IF EXISTS supplier_invoice_lines_purchase_order_line_id_fkey;
ALTER TABLE public.supplier_invoice_lines DROP CONSTRAINT IF EXISTS supplier_invoice_lines_product_id_fkey;

ALTER TABLE public.supplier_invoice_lines 
  ADD CONSTRAINT supplier_invoice_lines_purchase_order_line_id_fkey 
  FOREIGN KEY (purchase_order_line_id) REFERENCES public.purchase_order_lines(id) ON DELETE RESTRICT;

ALTER TABLE public.supplier_invoice_lines 
  ADD CONSTRAINT supplier_invoice_lines_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
