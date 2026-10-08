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
import { getRetailerUserContext } from "@/lib/auth/dal";
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

  // 1. Unauthenticated view (e.g. /retailer/login)
  if (!impSession) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return (
        <LanguageProvider initialLocale={serverLocale}>
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6 selection:bg-zinc-800 selection:text-white">
            {children}
          </div>
        </LanguageProvider>
      );
    }
  }

  // 2. Authenticated layout: Fetch cached user, company & store metadata (single parallel pass, memoized)
  const userContext = await getRetailerUserContext();

  return (
    <LanguageProvider initialLocale={serverLocale}>
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors">
          {impSession && <ImpersonationBanner session={impSession} />}
          <div className="flex-1 flex min-w-0">
            {/* Desktop Sidebar */}
            <RetailerSidebar
              role={userContext.role}
              companyName={userContext.companyName}
              storeName={userContext.storeName}
              userName={userContext.userName}
            />

            {/* Main Content Column */}
            <div className="flex-1 flex flex-col min-w-0">
              <RetailerHeader
                userName={userContext.userName}
                userEmail={userContext.userEmail}
                companyName={userContext.companyName}
                role={userContext.role}
                storeName={userContext.storeName}
              />

              <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-y-auto">
                <div className="w-full max-w-7xl">{children}</div>
              </main>

              {/* Mobile Bottom Navigation */}
              <RetailerBottomNav role={userContext.role} />
            </div>
          </div>
        </div>
      </CartProvider>
    </LanguageProvider>
  );
}
