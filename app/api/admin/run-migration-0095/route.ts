import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
// @ts-ignore
import pg from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();

  // Test if column related_invoice_id exists on partner_inquiries
  const { data: testData, error: testError } = await supabase
    .from("partner_inquiries")
    .select("related_invoice_id, related_po_id")
    .limit(1);

  const { data: testInvData, error: testInvError } = await supabase
    .from("supplier_invoices")
    .select("supplier_remittance_id, remittance_bank_name")
    .limit(1);

  if (!testError && !testInvError) {
    return NextResponse.json({
      success: true,
      message: "Migration 0095 columns already exist on partner_inquiries and supplier_invoices!"
    });
  }

  const sql = `
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
        internal_note = COALESCE(internal_note || E'\\n', '') || 'Auto-voided duplicate draft invoice upon enforcement of one active invoice per PO policy.'
    WHERE id = '6bc9c7f1-a277-43bf-b9cf-47d6c2919c93'
      AND invoice_status = 'DRAFT'
      AND purchase_order_id = 'acbc3a9e-3769-4e2f-84bf-430c176bda5e';

    -- 4. Create Partial Unique Index: 1 Active Invoice per PO
    CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoices_one_active_per_po
      ON public.supplier_invoices(purchase_order_id)
      WHERE invoice_status NOT IN ('VOID', 'REJECTED');
  `;

  // 1. Try direct pg connection with any available connection string
  const pgConn = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (pgConn) {
    try {
      const client = new pg.Client({ connectionString: pgConn, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(sql);
      await client.end();
      return NextResponse.json({
        success: true,
        method: "pg_direct",
        message: "Migration 0095 applied via POSTGRES_URL!"
      });
    } catch (pgErr: any) {
      console.error("Direct pg error:", pgErr);
      return NextResponse.json({ success: false, method: "pg_direct", error: pgErr.message });
    }
  }

  return NextResponse.json({
    success: false,
    message: "No direct Postgres connection string available",
    testError: testError?.message,
    testInvError: testInvError?.message
  });
}
