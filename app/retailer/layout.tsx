import React from "react";
import type { Metadata, Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RetailerSidebar } from "@/components/retailer/retailer-sidebar";
import { RetailerHeader } from "@/components/retailer/retailer-header";
import { RetailerBottomNav } from "@/components/retailer/retailer-bottom-nav";
import { CartProvider } from "@/components/retailer/cart-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "K SELECT HUB - Retailer Portal",
  description: "Official B2B Retailer & Store Operations Portal for K SELECT HUB",
  manifest: "/manifest.webmanifest",
  applicationName: "K SELECT HUB",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "K SELECT HUB",
  },
  icons: {
    icon: [
      { url: "/hub-favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/hub-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/hub-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/hub-icon.png", type: "image/png" },
    ],
    shortcut: ["/hub-favicon.ico"],
    apple: [
      { url: "/hub-apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/hub-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { getImpersonationSession } from "@/lib/auth/impersonation";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { LanguageProvider } from "@/lib/i18n/context";
import { getServerLocale } from "@/lib/i18n/server";

export default async function RetailerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const serverLocale = await getServerLocale();
  const impSession = await getImpersonationSession();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Unauthenticated view (e.g. /retailer/login)
  if (!user && !impSession) {
    return (
      <LanguageProvider initialLocale={serverLocale}>
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6 selection:bg-zinc-800 selection:text-white">
          {children}
        </div>
      </LanguageProvider>
    );
  }

  // 2. Authenticated layout: Fetch user, company & store metadata
  const adminClient = createAdminClient();
  const effectiveUserId = impSession ? impSession.targetUserId : user?.id;

  // Profile
  let userName = impSession ? impSession.targetUserName : "Retailer User";
  let userEmail = impSession ? impSession.targetUserEmail : (user?.email || "");

  if (effectiveUserId && !impSession) {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("display_name, role")
      .eq("id", effectiveUserId)
      .maybeSingle();

    userName = profile?.display_name || user?.email?.split("@")[0] || "Retailer User";
  }

  // Company Membership
  let companyName = impSession ? impSession.targetCompanyName : "K SELECT Retailer";
  let companyId = impSession ? impSession.targetCompanyId : undefined;

  if (effectiveUserId && !impSession) {
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id, company_role, companies(id, name)")
      .eq("id", effectiveUserId)
      .maybeSingle();

    const company = companyUser?.companies as any;
    companyName = company?.name || "K SELECT Retailer";
    companyId = company?.id || companyUser?.company_id;
  }

  // Retailer Specific Role
  let role = "owner";
  if (effectiveUserId) {
    const { data: retailerRole } = await adminClient
      .from("retailer_user_roles")
      .select("role, has_all_stores_access")
      .eq("user_id", effectiveUserId)
      .maybeSingle();

    if (retailerRole?.role) {
      role = retailerRole.role;
    }
  }

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
    <LanguageProvider initialLocale={serverLocale}>
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
          {impSession && <ImpersonationBanner session={impSession} />}
          <div className="flex-1 flex min-w-0">
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

              <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-y-auto">
                <div className="w-full max-w-7xl">{children}</div>
              </main>

              {/* Mobile Bottom Navigation */}
              <RetailerBottomNav role={role} />
            </div>
          </div>
        </div>
      </CartProvider>
    </LanguageProvider>
  );
}
