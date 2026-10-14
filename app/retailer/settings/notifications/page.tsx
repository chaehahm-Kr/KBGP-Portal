import "server-only";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { getWeeklyReportEmailOptInAction } from "@/lib/retailer/notification-actions";
import { RetailerNotificationsSettingsView } from "@/components/retailer/retailer-notifications-settings-view";

export const metadata: Metadata = {
  title: "Notification Settings | K SELECT HUB",
  description: "Manage operational notifications and weekly performance email reports",
};

export const dynamic = "force-dynamic";

export default async function RetailerNotificationsSettingsPage() {
  try {
    await verifyRetailerSession();
  } catch {
    redirect("/login");
  }

  const res = await getWeeklyReportEmailOptInAction();
  const initialState = res.data || {
    optIn: false,
    optedInAt: null,
    email: null,
    role: "employee",
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <RetailerNotificationsSettingsView initialState={initialState} />
    </div>
  );
}
