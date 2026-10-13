import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getGlobalPaymentSettings } from "@/lib/payment/settings";
import { PaymentSettingsView } from "@/components/admin/payment-settings-view";

export const metadata: Metadata = {
  title: "결제 및 수수료 설정 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminPaymentSettingsPage() {
  await verifyAdminSession();
  const settings = await getGlobalPaymentSettings();

  return <PaymentSettingsView initialSettings={settings} />;
}
