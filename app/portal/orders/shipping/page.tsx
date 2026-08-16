import React from "react";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { getPortalReadinessList, getPortalShipments } from "@/lib/portal/actions";
import { ShippingClient } from "@/components/portal/shipping-client";

export default async function PortalShippingPage() {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  // 1. Fetch readiness records
  const readinessList = await getPortalReadinessList();

  // 2. Fetch shipments
  const shipments = await getPortalShipments();

  // 3. Fetch eligible PO options for new readiness records
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("id, po_number, shipping_responsibility")
    .eq("supplier_id", companyId)
    .in("po_status", ["APPROVED", "SENT"])
    .eq("supplier_confirmation_status", "CONFIRMED")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-white">선적 & 출고 관리 (Shipping & Goods Ready)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          출고 준비 수량 및 카고 규격을 등록하고, 운송 일정에 따라 물품 인계 상태를 관리합니다.
        </p>
      </div>

      <ShippingClient
        initialReadinessList={readinessList}
        initialShipments={shipments}
        confirmedPos={(pos ?? []).map((po: any) => ({
          id: po.id,
          po_number: po.po_number,
          shipping_responsibility: po.shipping_responsibility || "LETUSTO_ARRANGED"
        }))}
      />
    </div>
  );
}
