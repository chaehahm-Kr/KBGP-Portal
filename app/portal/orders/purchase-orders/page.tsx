import type { Metadata } from "next";
import { getPortalPurchaseOrders } from "@/lib/portal/actions";
import { PortalPoList } from "@/components/portal/portal-po-list";

export const metadata: Metadata = {
  title: "발주 관리 | 파트너 포털",
};

export default async function PortalPurchaseOrdersPage() {
  const pos = await getPortalPurchaseOrders();

  return (
    <div className="w-full max-w-7xl space-y-6">
      <PortalPoList pos={pos} />
    </div>
  );
}
