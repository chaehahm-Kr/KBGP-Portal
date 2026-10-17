import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getExchangeCreditOverviewData } from "@/lib/retailer/exchange-credit-actions";
import { listRmasAction } from "@/lib/retailer/rma-backend";
import { ExchangeCreditOverviewView } from "@/components/admin/exchange-credit/overview-view";

export const metadata: Metadata = {
  title: "90-Day Exchange Credit | K SELECT NETWORK Admin",
  description: "Retailer 90-Day Exchange Credit program enrollment, protected cohorts, and Option B RMA return management",
};

export const dynamic = "force-dynamic";

export default async function ExchangeCreditPage() {
  await verifyAdminSession();
  const [data, rmaRes] = await Promise.all([
    getExchangeCreditOverviewData(),
    listRmasAction(),
  ]);

  const combinedData = {
    ...data,
    rmas: rmaRes.success ? rmaRes.rmas : [],
    isRmaSchemaAvailable: rmaRes.isSchemaAvailable,
  };

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
      <ExchangeCreditOverviewView initialData={combinedData} />
    </div>
  );
}
