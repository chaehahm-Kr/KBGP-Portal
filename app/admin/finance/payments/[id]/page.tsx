import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getSupplierPaymentById } from "@/lib/supplier-payment/actions";
import { PaymentDetail } from "@/components/admin/payment-detail";

export const metadata: Metadata = {
  title: "지급 거래 상세 보기 | K SELECT NETWORK 어드민",
};

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PaymentDetailPage({ params }: DetailPageProps) {
  await verifyAdminSession();
  
  const { id } = await params;
  let payment: any = null;

  try {
    payment = await getSupplierPaymentById(id);
  } catch (err) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PaymentDetail payment={payment} />
    </div>
  );
}
