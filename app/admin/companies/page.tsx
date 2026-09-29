import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { getSystemCompanyConfigs } from "@/lib/settings/actions";
import { CompaniesTableClient } from "@/components/admin/companies-table-client";
import { formatCanonicalCountryName } from "@/lib/constants/countries";
import { evaluateCompanyOnboarding } from "@/lib/company/onboarding-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "회사 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminCompaniesPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Safe batch parallel data fetching with error isolation
  const [
    companiesRes,
    { data: companyUsers },
    { data: primaryTasks },
    { data: activeAgreements },
    configs,
    authUsersRes,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(`
        id, name, country, status, intro, created_at,
        brands (id, is_active),
        products (id, name, selection_status, status, price_usd_fob, price_krw_retail)
      `)
      .order("created_at", { ascending: false }),

    supabase
      .from("company_users")
      .select("id, company_id, name, email, phone, title, position, is_primary, status, company_role, permissions")
      .order("created_at", { ascending: true }),

    supabase
      .from("company_task_assignments")
      .select("company_id, task_code")
      .eq("is_primary", true),

    supabase
      .from("company_agreements")
      .select("company_id")
      .eq("status", "active"),

    getSystemCompanyConfigs(),

    supabase.auth.admin.listUsers({ perPage: 1000 }).catch((err) => {
      console.warn("[AdminCompaniesPage] Failed to fetch auth users:", err);
      return { data: { users: [] }, error: err };
    }),
  ]);

  // Build lookup maps for user last_sign_in_at
  const authMapById = new Map<string, string | null>();
  const authMapByEmail = new Map<string, string | null>();
  if (authUsersRes?.data?.users) {
    for (const u of authUsersRes.data.users) {
      if (u.id) authMapById.set(u.id, u.last_sign_in_at || null);
      if (u.email) authMapByEmail.set(u.email.toLowerCase().trim(), u.last_sign_in_at || null);
    }
  }

  let dbCompanies: any[] = companiesRes.data || [];
  if (companiesRes.error || !companiesRes.data) {
    console.error("Error fetching companies with relations:", companiesRes.error);
    const { data: fallbackCompanies } = await supabase
      .from("companies")
      .select("id, name, country, status, intro, created_at")
      .order("created_at", { ascending: false });
    dbCompanies = (fallbackCompanies || []).map((c) => ({
      ...c,
      brands: [],
      products: [],
    }));
  }

  const activeAgreementsSet = new Set((activeAgreements ?? []).map((a) => a.company_id));

  const resolvedDbCompanies = await Promise.all(
    (dbCompanies ?? []).map(async (c) => {
      let parsed;
      try {
        parsed = await parseCompanyMetadata(c);
      } catch (e) {
        parsed = {
          description: "",
          address: "",
          website: "",
          adminMemo: "",
          contacts: [],
          type: "Brand Owner",
          types: ["Brand Owner"],
          companyCode: "",
          status: c.status === "active" ? "Active" : "Inactive",
        };
      }

      const activeBrandsCount = ((c.brands as any[]) || []).filter((b) => b.is_active).length;
      const totalProductsCount = ((c.products as any[]) || []).length;
      const completedProductsCount = ((c.products as any[]) || []).filter((p) => {
        return (
          p.status === "COMPLETE" ||
          p.selection_status === "APPROVED" ||
          (p.name && (p.price_usd_fob || p.price_krw_retail))
        );
      }).length;

      // Find users for this company
      const users = (companyUsers ?? []).filter((u) => u.company_id === c.id);
      const dbPrimary = users.find((u) => u.is_primary) || users[0] || null;

      // Fallback to parsed metadata contacts
      const metadataPrimary = parsed.contacts?.find((contact) => contact.isPrimary) || parsed.contacts?.[0] || null;
      const primaryContact = dbPrimary || metadataPrimary;

      const primaryContactEnglishName =
        (dbPrimary as any)?.english_name ||
        dbPrimary?.permissions?.english_name ||
        metadataPrimary?.englishName ||
        "";

      // Count primary tasks assigned for this company
      const companyPrimaryTasksCount = (primaryTasks ?? []).filter((t) => t.company_id === c.id).length;

      // Check if Retailer-only company (Brand onboarding 7-step is N/A for Retailers)
      const companyTypes = parsed.types && parsed.types.length > 0 ? parsed.types : [parsed.type || "Brand Owner"];
      const isRetailerOnly = companyTypes.every((t) => {
        const norm = t.toLowerCase();
        return norm.includes("retail") && !norm.includes("brand") && !norm.includes("manufacturer");
      });

      let onboardingCompletedCount = 0;
      let onboardingTotalCount = 7;
      let onboardingStatus: "completed" | "in_progress" | "not_started" | "not_applicable" = "not_started";
      let onboardingBadgeText = "0 / 7 미시작";
      let onboardingSteps: any[] = [];

      if (isRetailerOnly) {
        onboardingStatus = "not_applicable";
        onboardingBadgeText = "N/A";
      } else {
        const onboarding = evaluateCompanyOnboarding({
          companyId: c.id,
          parsedMeta: parsed,
          users,
          brandCount: activeBrandsCount,
          completeProductCount: completedProductsCount,
          totalProductCount: totalProductsCount,
          primaryTaskCount: companyPrimaryTasksCount,
          hasActiveAgreement: activeAgreementsSet.has(c.id),
        });
        onboardingCompletedCount = onboarding.completedCount;
        onboardingTotalCount = onboarding.totalCount;
        onboardingStatus = onboarding.status;
        onboardingBadgeText = onboarding.badgeText;
        onboardingSteps = onboarding.steps;
      }

      return {
        id: c.id,
        name: c.name,
        type: parsed.type || "Brand Owner",
        types: companyTypes,
        country: formatCanonicalCountryName(c.country),
        contactName: primaryContact ? primaryContact.name : "담당자 정보 없음",
        contactEnglishName: primaryContactEnglishName,
        contactPhone: primaryContact ? primaryContact.phone : "-",
        contactEmail: primaryContact ? primaryContact.email : "-",
        contactTitle: primaryContact ? primaryContact.title : "",
        contactPosition: primaryContact ? primaryContact.position : "",
        brandsCount: activeBrandsCount,
        productsCount: totalProductsCount,
        onboardingCompletedCount,
        onboardingTotalCount,
        onboardingStatus,
        onboardingBadgeText,
        onboardingSteps,
        appStatus: parsed.status === "Active" ? "Approved" : "Pending",
        partnerStatus: parsed.status,
        accountOwner: "Alex Kim",
        registeredUsersCount: users.length,
        latestLoginAt: (() => {
          const validTimestamps = users
            .map((u) => {
              const login =
                authMapById.get(u.id) ??
                (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null) ??
                null;
              return login ? new Date(login).getTime() : NaN;
            })
            .filter((t) => !isNaN(t));

          return validTimestamps.length > 0
            ? new Date(Math.max(...validTimestamps)).toISOString()
            : null;
        })(),
        lastContact: new Date(c.created_at).toLocaleDateString(),
      };
    })
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">회사 관리</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            K SELECT NETWORK 플랫폼에 등록된 한국 뷰티 기업들의 파트너 상태와 관련 브랜드를 관리합니다.
          </p>
        </div>
        <div className="shrink-0">
          <Link
            href="/admin/companies/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-955 px-4 py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <span className="text-sm font-bold">+</span> 신규 회사 추가
          </Link>
        </div>
      </div>
      {/* Integrated Search & Filter Companies Table */}
      <CompaniesTableClient
        companies={resolvedDbCompanies.map((c) => ({
          ...c,
          users: (companyUsers ?? [])
            .filter((u) => u.company_id === c.id)
            .map((u) => ({
              name: u.name,
              englishName: (u as any)?.english_name || u.permissions?.english_name || "",
              email: u.email,
              phone: u.phone,
              role: u.company_role,
              last_sign_in_at:
                authMapById.get(u.id) ??
                (u.email ? authMapByEmail.get(u.email.toLowerCase().trim()) : null) ??
                null,
            })),
        }))}
        partnerStatuses={configs.partner_statuses}
      />
    </div>
  );
}
