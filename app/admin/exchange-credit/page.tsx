import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getExchangeCreditOverviewData } from "@/lib/retailer/exchange-credit-actions";
import { ExchangeCreditOverviewView } from "@/components/admin/exchange-credit/overview-view";

export const metadata: Metadata = {
  title: "90-Day Exchange Credit | K SELECT NETWORK Admin",
  description: "Retailer 90-Day Exchange Credit program enrollment and protected supply cohort management",
};

export const dynamic = "force-dynamic";

export default async function ExchangeCreditPage() {
  await verifyAdminSession();
  const data = await getExchangeCreditOverviewData();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <ExchangeCreditOverviewView initialData={data} />
    </div>
  );
}
