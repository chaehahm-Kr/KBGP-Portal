import type { Metadata } from "next";
import { getPortalPurchaseOrderById, getPortalPoChangeRequests } from "@/lib/portal/actions";
import PoDetailClient from "@/components/portal/po-detail-client";

export const metadata: Metadata = {
  title: "발주 상세 정보 | 파트너 포털",
};

interface PortalPoDetailPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function PortalPoDetailPage({ params }: PortalPoDetailPageProps) {
  // Await params if it is a promise (Next.js 15+ standard convention)
  const resolvedParams = await params;
  const { id } = resolvedParams;

  // Fetch PO detail and change request logs
  const po = await getPortalPurchaseOrderById(id);
  const changeRequests = await getPortalPoChangeRequests(id);

  return <PoDetailClient po={po} changeRequests={changeRequests} />;
}
