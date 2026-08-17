import React from "react";
import type { Metadata } from "next";
import PortalLayout from "@/components/portal/portal-layout";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "K Select Network 파트너 포털",
  description: "K Select Network B2B 파트너 포털",
  icons: {
    icon: [
      { url: "/symbol-Cyan-Hotpink.png?v=portal_v3", type: "image/png" },
      { url: "/favicon-32x32.png?v=portal_v3", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=portal_v3", sizes: "16x16", type: "image/png" },
      { url: "/favicon-symbol.png?v=portal_v3", type: "image/png" },
      { url: "/favicon.ico?v=portal_v3", sizes: "any" },
    ],
    shortcut: ["/symbol-Cyan-Hotpink.png?v=portal_v3"],
    apple: [
      { url: "/apple-touch-icon.png?v=portal_v3", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // Try to get user session safely without redirecting
  const { data: { user } } = await supabase.auth.getUser();
  
  let companyName = "Partner Company";
  let companyRole = "member";
  let userEmail = "";
  let displayName = "";

  if (user) {
    userEmail = user.email || "";
    
    // Fetch profile display_name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
      
    if (profile) {
      displayName = profile.display_name || "";
    }
    
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, company_role")
      .eq("id", user.id)
      .maybeSingle();

    if (companyUser) {
      companyRole = companyUser.company_role;
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyUser.company_id)
        .maybeSingle();
      
      if (company) {
        companyName = company.name;
      }
    }
  }

  return (
    <PortalLayout
      companyName={companyName}
      companyRole={companyRole}
      userEmail={userEmail}
      userDisplayName={displayName}
    >
      {children}
    </PortalLayout>
  );
}
