import React from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RetailerSidebar } from "@/components/retailer/retailer-sidebar";
import { RetailerHeader } from "@/components/retailer/retailer-header";
import { RetailerBottomNav } from "@/components/retailer/retailer-bottom-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "K SELECT Retailer Portal",
  description: "Official B2B Retailer & Store Operations Portal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/symbol-Cyan-Hotpink.png?v=hub_v2", type: "image/png" },
      { url: "/favicon.ico?v=hub_v2", sizes: "any" },
    ],
    apple: [
      { url: "/symbol-Cyan-Hotpink.png?v=hub_v2", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RetailerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Unauthenticated view (e.g. /retailer/login)
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6 selection:bg-zinc-800 selection:text-white">
        {children}
      </div>
    );
  }

  // 2. Authenticated layout: Fetch user, company & store metadata
  const adminClient = createAdminClient();

  // Profile
  const { data: profile } = await adminClient
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.display_name || user.email?.split("@")[0] || "Retailer User";
  const userEmail = user.email || "";

  // Company Membership
  const { data: companyUser } = await adminClient
    .from("company_users")
    .select("company_id, company_role, companies(id, name)")
    .eq("id", user.id)
    .maybeSingle();

  const company = companyUser?.companies as any;
  const companyName = company?.name || "K SELECT Retailer";
  const companyId = company?.id || companyUser?.company_id;

  // Retailer Specific Role
  const { data: retailerRole } = await adminClient
    .from("retailer_user_roles")
    .select("role, has_all_stores_access")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = retailerRole?.role || companyUser?.company_role || "owner";

  // Store Name
  let storeName = "Main Store";
  if (companyId) {
    const { data: store } = await adminClient
      .from("stores")
      .select("name")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (store?.name) {
      storeName = store.name;
    }
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
      {/* Desktop Sidebar */}
      <RetailerSidebar
        role={role}
        companyName={companyName}
        storeName={storeName}
        userName={userName}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <RetailerHeader
          userName={userName}
          userEmail={userEmail}
          companyName={companyName}
          role={role}
          storeName={storeName}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        {/* Mobile Bottom Navigation */}
        <RetailerBottomNav role={role} />
      </div>
    </div>
  );
}
