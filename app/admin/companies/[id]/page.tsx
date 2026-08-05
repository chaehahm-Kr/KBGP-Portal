import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { getSystemCompanyConfigs } from "@/lib/settings/actions";
import { CompanyDetailManager } from "@/components/admin/company-detail-manager";

export const metadata: Metadata = {
  title: "회사 상세 정보 | K SELECT NETWORK 어드민",
};

export default async function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, business_registration_number, country, contact_name, contact_phone, intro, status, created_at"
    )
    .eq("id", id)
    .single();

  if (!company) {
    notFound();
  }

  const parsedMeta = await parseCompanyMetadata(company);
  const configs = await getSystemCompanyConfigs();

  // Safely fetch brands with trademark columns
  let brandsData: any[] = [];
  const { data: brandsWithTrademarks, error: brandsError } = await supabase
    .from("brands")
    .select("id, name, intro, logo_path, is_active, has_kr_trademark, kr_trademark_number, kr_trademark_path, has_us_trademark, us_trademark_number, us_trademark_path")
    .eq("company_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!brandsError && brandsWithTrademarks) {
    brandsData = brandsWithTrademarks;
  } else {
    // Fallback to core columns if database migration hasn't been run yet
    const { data: coreBrands } = await supabase
      .from("brands")
      .select("id, name, intro, logo_path, is_active")
      .eq("company_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    brandsData = coreBrands ?? [];
  }

  // Resolve signed URLs for logos and trademark certificate files
  const resolvedBrands = await Promise.all(
    brandsData.map(async (brand) => {
      const tm = await parseBrandTrademarks(brand);
      const logoUrl = brand.logo_path ? await getSignedFileUrl(brand.logo_path) : null;
      const krUrl = tm.kr_trademark_path ? await getSignedFileUrl(tm.kr_trademark_path) : null;
      const usUrl = tm.us_trademark_path ? await getSignedFileUrl(tm.us_trademark_path) : null;
      return {
        id: brand.id,
        name: brand.name,
        logoUrl,
        introText: tm.intro_text,
        hasKr: tm.has_kr_trademark,
        krNum: tm.kr_trademark_number,
        krUrl,
        hasUs: tm.has_us_trademark,
        usNum: tm.us_trademark_number,
        usUrl,
      };
    })
  );

  const { data: products } = await supabase
    .from("products")
    .select("id, name, brand_id")
    .eq("company_id", id);

  const { data: applications } = await supabase
    .from("applications")
    .select("id, application_number, status, submitted_at")
    .eq("company_id", id)
    .neq("status", "draft")
    .order("submitted_at", { ascending: false });

  const { data: companyUsers } = await supabase
    .from("company_users")
    .select("id, name, email, status, company_role, title, position, phone, is_primary, permissions")
    .eq("company_id", id)
    .order("created_at", { ascending: true });

  // Hydrate task assignments on companyUsers
  const { data: assignments } = await supabase
    .from("company_task_assignments")
    .select("user_id, task_code, is_primary, email_notify")
    .eq("company_id", id);

  const hydratedUsers = (companyUsers ?? []).map((u: any) => ({
    ...u,
    task_assignments: (assignments ?? []).filter((a: any) => a.user_id === u.id)
  }));

  const brandNameById = new Map(brandsData.map((b) => [b.id, b.name]));

  // Query task assignments
  const { getCompanyTaskAssignments } = await import("@/lib/company/task-actions");
  const taskAssignments = await getCompanyTaskAssignments(id);

  return (
    <CompanyDetailManager
      company={company}
      parsedMeta={parsedMeta}
      companyUsers={hydratedUsers}
      brands={resolvedBrands}
      products={products ?? []}
      applications={applications ?? []}
      brandNameById={brandNameById}
      typeOptions={configs.company_types}
      statusOptions={configs.partner_statuses}
      taskAssignments={taskAssignments}
    />
  );
}
