import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTradingProductDetailData } from "@/lib/product/trading-actions";
import { TradingProductDetail } from "@/components/admin/trading-product-detail";

export const metadata: Metadata = {
  title: "Trading Product 360° Operations Hub | K SELECT NETWORK 어드민",
};

export default async function AdminTradingProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await getTradingProductDetailData(id);

  if (!data || !data.product) {
    notFound();
  }

  // A product is eligible for Trading 360° Management if it is explicitly SELECTED for trading, or its trading_status is active/historical.
  const isTradingEligible =
    data.product.selection_status === "SELECTED" ||
    data.product.trading_status === "active" ||
    data.product.trading_status === "historical";

  if (!isTradingEligible) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <TradingProductDetail
        product={data.product}
        initialBalances={data.balances}
        initialMovements={data.movements}
        warehouses={data.warehouses}
        poHistory={data.poHistory}
        shipmentHistory={data.shipmentHistory}
        receivingHistory={data.receivingHistory}
        costSummary={data.costSummary}
        historyLogs={data.historyLogs}
        inboundSummary={data.inboundSummary}
      />
    </div>
  );
}
