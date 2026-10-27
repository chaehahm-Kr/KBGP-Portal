import React from "react";
import { redirect } from "next/navigation";
import { verifyAdminSession, getAdminStaffContext } from "@/lib/auth/dal";
import { getActiveStaffMembersAction, listSourcingCandidatesAction } from "@/lib/brand-sourcing/actions";
import BrandMarketingView from "@/components/admin/brand-marketing/brand-marketing-view";

export const dynamic = "force-dynamic";

interface BrandMarketingPageProps {
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function BrandMarketingPage({ searchParams }: BrandMarketingPageProps) {
  // 1. Enforce Admin Session & Brand Staff Authorization
  await verifyAdminSession();
  const staff = await getAdminStaffContext();

  const canAccessBrand =
    staff.isSuperAdmin ||
    staff.hasPermission("applications", "view") ||
    staff.hasPermission("products", "view");

  if (!canAccessBrand) {
    redirect("/admin?error=unauthorized");
  }

  // 2. Resolve query parameters
  const params = await searchParams;
  const initialTab =
    params.tab === "list"
      ? "list"
      : params.tab === "campaigns"
      ? "campaigns"
      : "import";

  // 3. Pre-fetch initial staff and initial candidates
  const [staffRes, candidatesRes] = await Promise.all([
    getActiveStaffMembersAction(),
    listSourcingCandidatesAction({ limit: 20, offset: 0 }),
  ]);

  const activeStaff = staffRes.success ? staffRes.staff || [] : [];
  const candidates = candidatesRes.success ? candidatesRes.candidates || [] : [];
  const total = candidatesRes.success ? candidatesRes.total || 0 : 0;

  // 4. Render within Global 1800px Shell (Rule 27 compliant: w-full, left-aligned)
  return (
    <div className="w-full p-6 md:p-8">
      <BrandMarketingView
        initialStaff={activeStaff}
        initialCandidates={candidates}
        initialTotal={total}
        initialTab={initialTab}
      />
    </div>
  );
}
