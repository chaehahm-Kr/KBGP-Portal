import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminStoreOperationsData } from "@/lib/retailer/admin-store-operations";
import { StoreOperationsView } from "@/components/admin/store-operations-view";

export const metadata: Metadata = {
  title: "Store Operations | K SELECT NETWORK Admin",
  description: "Store network and operations overview",
};

export const dynamic = "force-dynamic";

export default async function AdminStoreOperationsPage() {
  await verifyAdminSession();
  const data = await getAdminStoreOperationsData();

  return <StoreOperationsView data={data} />;
}
