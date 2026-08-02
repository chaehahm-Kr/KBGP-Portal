import React from "react";
import PortalLayout from "@/components/portal/portal-layout";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
