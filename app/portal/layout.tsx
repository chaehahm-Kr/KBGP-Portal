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

import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/auth/impersonation";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";

export default async function PartnerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const impSession = await getImpersonationSession();
  const authSupabase = await createClient();
  const adminSupabase = createAdminClient();
  
  // Try to get user session safely without redirecting
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user && !impSession) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        {children}
      </div>
    );
  }

  let companyName = impSession ? impSession.targetCompanyName : "Partner Company";
  let companyRole = "member";
  const userEmail = impSession ? impSession.targetUserEmail : (user?.email || "");
  let displayName = impSession ? impSession.targetUserName : "";

  const effectiveUserId = impSession ? impSession.targetUserId : user?.id;

  if (effectiveUserId) {
    if (!impSession) {
      // Fetch profile display_name
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("display_name")
        .eq("id", effectiveUserId)
        .maybeSingle();
        
      if (profile) {
        displayName = profile.display_name || "";
      }
    }
    
    const { data: companyUser } = await adminSupabase
      .from("company_users")
      .select("company_id, company_role")
      .eq("id", effectiveUserId)
      .maybeSingle();

    if (companyUser) {
      companyRole = companyUser.company_role;
      if (!impSession) {
        const { data: company } = await adminSupabase
          .from("companies")
          .select("name")
          .eq("id", companyUser.company_id)
          .maybeSingle();
        
        if (company) {
          companyName = company.name;
        }
      }
    }
  }

  let userAcl: Record<string, any> = {};
  if (effectiveUserId) {
    try {
      const { getPortalUserAcl } = await import("@/lib/company/permissions");
      const aclRes = await getPortalUserAcl();
      userAcl = aclRes.permissions;
    } catch (e) {
      console.warn("Failed to load user ACL in portal layout:", e);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {impSession && <ImpersonationBanner session={impSession} />}
      <PortalLayout
        companyName={companyName}
        companyRole={companyRole}
        userEmail={userEmail}
        userDisplayName={displayName}
        permissions={userAcl}
      >
        {children}
      </PortalLayout>
    </div>
  );
}
