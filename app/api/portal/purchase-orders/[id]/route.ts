import { NextRequest, NextResponse } from "next/server";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { companyId } = await requireCompanyMembership();
    const supabase = createAdminClient();

    // Verify PO belongs to company
    const { data: po, error: poErr } = await supabase
      .from("purchase_orders")
      .select("id, po_number")
      .eq("id", id)
      .eq("supplier_id", companyId)
      .maybeSingle();

    if (poErr || !po) {
      return NextResponse.json({ error: "Access denied or PO not found" }, { status: 404 });
    }

    // Fetch lines
    const { data: lines, error: linesErr } = await supabase
      .from("purchase_order_lines")
      .select(`
        id,
        product_id,
        product_name_snapshot,
        letusto_sku_snapshot,
        manufacture_sku_snapshot,
        qty,
        confirmed_qty
      `)
      .eq("purchase_order_id", id);

    if (linesErr || !lines) {
      return NextResponse.json({ error: "Failed to fetch PO lines" }, { status: 500 });
    }

    // Map lines and attach cumulative shipped and active readiness quantities
    const mappedLines = [];
    for (const line of lines) {
      // 1. Fetch cumulative shipped quantities
      const { data: shipData } = await supabase
        .from("inbound_shipment_lines")
        .select("shipped_qty, inbound_shipments!inner(status)")
        .eq("purchase_order_line_id", line.id)
        .neq("inbound_shipments.status", "CANCELLED");

      const cumulativeShipped = (shipData ?? []).reduce((sum, s: any) => sum + s.shipped_qty, 0);

      // 2. Fetch active readiness lines (not draft)
      const { data: grLines } = await supabase
        .from("goods_readiness_lines")
        .select("id, ready_qty, goods_readiness!inner(id, handover_status)")
        .eq("purchase_order_line_id", line.id)
        .in("goods_readiness.handover_status", ["READY_SUBMITTED", "HANDOVER_PENDING", "HANDED_OVER"]);

      let activeReady = 0;
      for (const grl of (grLines ?? [])) {
        const { data: linkedShip } = await supabase
          .from("inbound_shipment_lines")
          .select("id, inbound_shipments!inner(status)")
          .eq("goods_readiness_line_id", grl.id)
          .neq("inbound_shipments.status", "CANCELLED")
          .maybeSingle();

        if (!linkedShip) {
          activeReady += grl.ready_qty;
        }
      }

      mappedLines.push({
        id: line.id,
        product_id: line.product_id,
        product_name: line.product_name_snapshot,
        letusto_sku: line.letusto_sku_snapshot,
        manufacture_sku: line.manufacture_sku_snapshot,
        qty: line.qty,
        confirmed_qty: line.confirmed_qty,
        cumulative_shipped: cumulativeShipped,
        active_ready: activeReady
      });
    }

    return NextResponse.json({
      id: po.id,
      po_number: po.po_number,
      lines: mappedLines
    });

  } catch (err: any) {
    console.error("API Error in PO lines:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
