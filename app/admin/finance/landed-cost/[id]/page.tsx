import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLandedCostCaseById } from "@/lib/landed-cost/actions";
import { CaseDetail } from "@/components/admin/landed-cost/case-detail";

export const metadata: Metadata = {
  title: "정산 케이스상세 명세 | K SELECT NETWORK 어드민",
};

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

// Fetch helper imported logic to calculate supplier acquisition cost
async function getLineAcquisitionValue(supabase: any, rl: any): Promise<number> {
  const { data: poLine } = await supabase
    .from("purchase_order_lines")
    .select("unit_cost")
    .eq("id", rl.purchase_order_line_id)
    .single();

  const poCost = poLine ? Number(poLine.unit_cost) : 0;
  const fallbackTotal = Number((rl.received_qty * poCost).toFixed(2));

  const { data: invLines } = await supabase
    .from("supplier_invoice_lines")
    .select("id, unit_price, invoiced_qty, supplier_invoice_id")
    .eq("purchase_order_line_id", rl.purchase_order_line_id);

  if (!invLines || invLines.length === 0) return fallbackTotal;

  const approvedInvLines = [];
  for (const il of invLines) {
    const { data: inv } = await supabase
      .from("supplier_invoices")
      .select("id")
      .eq("id", il.supplier_invoice_id)
      .eq("invoice_status", "APPROVED")
      .maybeSingle();

    if (inv) approvedInvLines.push(il);
  }

  if (approvedInvLines.length === 0) return fallbackTotal;

  let totalAcquisitionValue = 0;

  for (const il of approvedInvLines) {
    const lineAmount = Number((il.invoiced_qty * Number(il.unit_price)).toFixed(2));

    const { data: lineAdjs } = await supabase
      .from("supplier_invoice_adjustments")
      .select("adjustment_amount, adjustment_direction")
      .eq("supplier_invoice_line_id", il.id)
      .eq("status", "APPROVED");

    let lineCredits = 0;
    let lineCharges = 0;
    (lineAdjs ?? []).forEach((a: any) => {
      if (a.adjustment_direction === "CREDIT") lineCredits += Number(a.adjustment_amount);
      else lineCharges += Number(a.adjustment_amount);
    });

    const adjustedLineAmount = lineAmount + lineCharges - lineCredits;

    const { data: allInvLines } = await supabase
      .from("supplier_invoice_lines")
      .select("id, unit_price, invoiced_qty")
      .eq("supplier_invoice_id", il.supplier_invoice_id);

    const totalInvoiceLinesValue = (allInvLines ?? []).reduce(
      (sum: number, x: any) => sum + Number((x.invoiced_qty * Number(x.unit_price)).toFixed(2)),
      0
    );

    const lineRatio = totalInvoiceLinesValue > 0 ? (lineAmount / totalInvoiceLinesValue) : 0;

    const { data: headerAdjs } = await supabase
      .from("supplier_invoice_adjustments")
      .select("adjustment_amount, adjustment_direction")
      .eq("supplier_invoice_id", il.supplier_invoice_id)
      .is("supplier_invoice_line_id", null)
      .eq("status", "APPROVED");

    let headerCredits = 0;
    let headerCharges = 0;
    (headerAdjs ?? []).forEach((a: any) => {
      if (a.adjustment_direction === "CREDIT") headerCredits += Number(a.adjustment_amount);
      else headerCharges += Number(a.adjustment_amount);
    });

    const allocatedHeaderAdj = (headerCharges - headerCredits) * lineRatio;

    totalAcquisitionValue += adjustedLineAmount + allocatedHeaderAdj;
  }

  const totalInvoicedQty = approvedInvLines.reduce((sum, il) => sum + Number(il.invoiced_qty), 0);
  if (totalInvoicedQty <= 0) return fallbackTotal;

  return Number(((rl.received_qty / totalInvoicedQty) * totalAcquisitionValue).toFixed(2));
}

export default async function LandedCostDetailPage({ params }: DetailPageProps) {
  await verifyAdminSession();
  const supabase = createAdminClient();
  
  const { id } = await params;
  let caseDetails: any = null;

  try {
    caseDetails = await getLandedCostCaseById(id);
  } catch (err) {
    notFound();
  }

  // Fetch active companies as vendors
  const { data: vendors } = await supabase
    .from("companies")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  // Fetch shipments in this case
  const { data: caseShipments } = await supabase
    .from("landed_cost_case_shipments")
    .select("inbound_shipment_id")
    .eq("landed_cost_case_id", id);
  const shipmentIds = (caseShipments ?? []).map(s => s.inbound_shipment_id);

  // Fetch receivings for those shipments
  const { data: recs } = await supabase
    .from("receivings")
    .select("id")
    .in("inbound_shipment_id", shipmentIds.length > 0 ? shipmentIds : ["00000000-0000-0000-0000-000000000000"]);
  const receivingIds = (recs ?? []).map(r => r.id);

  // Fetch and prepare receiving lines with supplier cost details
  const { data: lines, error: lineErr } = await supabase
    .from("receiving_lines")
    .select(`
      id,
      received_qty,
      purchase_order_line_id,
      product_id,
      product:products (
        letusto_sku,
        name
      ),
      receiving:receivings!receiving_id (
        inbound_shipment_id,
        warehouse_id,
        received_date
      )
    `)
    .in("receiving_id", receivingIds.length > 0 ? receivingIds : ["00000000-0000-0000-0000-000000000000"]);

  const receivingLinesWithCosts = [];
  if (lines) {
    for (const l of lines) {
      const supplierAcqCost = await getLineAcquisitionValue(supabase, l);
      receivingLinesWithCosts.push({
        id: l.id,
        product_id: l.product_id,
        sku: (l.product as any)?.letusto_sku || "(SKU 없음)",
        name: (l.product as any)?.name || "(상품명 없음)",
        received_qty: l.received_qty,
        supplier_acquisition_cost: supplierAcqCost,
        unit_supplier_cost: l.received_qty > 0 ? (supplierAcqCost / l.received_qty) : 0
      });
    }
  }

  return (
    <div className="space-y-6">
      <CaseDetail
        caseDetails={caseDetails}
        vendors={vendors ?? []}
        receivingLinesWithCosts={receivingLinesWithCosts}
      />
    </div>
  );
}
