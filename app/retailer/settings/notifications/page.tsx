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
    canManageRecipients: false,
    companyId: "",
    companyName: "",
    recipients: [],
    eligibleTeamMembers: [],
  };

  return <RetailerNotificationsSettingsView initialState={initialState} />;
}
