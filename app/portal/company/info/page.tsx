import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyMembership, getPortalTenantContext } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { getCompanyShippingOrigins } from "@/lib/company/shipping-origin-actions";
import { hasMenuPermission, hasPortalPermission } from "@/lib/company/permissions";
import { CompanyProfileManager } from "@/components/portal/company-profile-manager";
import { AccessDeniedView } from "@/components/portal/access-denied";
import { COMPANY_PROFILE_SELECT } from "@/lib/company/profile-columns";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "회사 정보 관리 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalCompanyInfoPage() {
  const canRead = await hasPortalPermission("company_info", "read");
  if (!canRead) {
    return (
      <AccessDeniedView
        title="접근 권한이 없습니다."
        message="회사 정보 메뉴를 이용할 권한이 없습니다. 권한 조정을 원하시면 회사 관리자에게 문의해주세요."
      />
    );
  }

  const membership = await getPortalTenantContext();
  const supabase = membership.supabase;

  const { data: company } = await supabase
    .from("companies")
    .select(`id, name, business_registration_number, country, contact_name, contact_phone, intro, status, created_at, ${COMPANY_PROFILE_SELECT}`)
    .eq("id", membership.companyId)
    .single();

  if (!company) {
    notFound();
  }

  const parsedMeta = await parseCompanyMetadata(company);

  // Query actual company users from the database for the contacts list
  let { data: dbUsers, error: usersError } = await supabase
    .from("company_users")
    .select(`
      id, name, email, company_role, status, title, position, phone, is_primary, permissions, english_name,
      task_assignments:company_task_assignments(task_code, is_primary, email_notify)
    `)
    .eq("company_id", membership.companyId)
    .order("created_at", { ascending: true });

  // Safe fallback if database columns do not exist yet (migration 0017 not applied)
  if (usersError && (usersError.code === "42703" || usersError.message.includes("column"))) {
    const { data: fallbackUsers } = await supabase
      .from("company_users")
      .select("id, name, email, company_role, status, permissions, english_name")
      .eq("company_id", membership.companyId)
      .order("created_at", { ascending: true });

    dbUsers = (fallbackUsers ?? []).map((u: any) => ({
      ...u,
      title: "",
      position: "",
      phone: "",
      is_primary: false,
    }));
  }

  const contacts = (dbUsers || []).map((u: any) => {
    const p = u.permissions || {};
    return {
      id: u.id,
      name: u.name || "",
      phone: u.phone || "",
      email: u.email || "",
      title: u.title || "",
      position: u.position || "",
      isPrimary: u.is_primary || false,
      status: u.status,
      permissions: u.permissions || null,
      koreanLastName: p.korean_last_name || p.koreanLastName || null,
      koreanFirstName: p.korean_first_name || p.koreanFirstName || null,
      englishFirstName: p.english_first_name || p.englishFirstName || p.first_name || p.firstName || null,
      englishLastName: p.english_last_name || p.englishLastName || p.last_name || p.lastName || null,
      englishName: u.english_name || p.english_name || p.englishName || null,
      korean_last_name: p.korean_last_name || p.koreanLastName || null,
      korean_first_name: p.korean_first_name || p.koreanFirstName || null,
      english_first_name: p.english_first_name || p.englishFirstName || p.first_name || p.firstName || null,
      english_last_name: p.english_last_name || p.englishLastName || p.last_name || p.lastName || null,
      english_name: u.english_name || p.english_name || p.englishName || null,
    };
  });

  // Overwrite contacts in parsedMeta with the actual database company_users
  parsedMeta.contacts = contacts;

  // Query task assignments
  const { getCompanyTaskAssignments } = await import("@/lib/company/task-actions");
  const taskAssignments = await getCompanyTaskAssignments(membership.companyId);

  // Check category-specific permissions for sensitive tabs
  const canReadBankInfo = await hasPortalPermission("bank_info", "read");
  const canReadAgreements = await hasPortalPermission("agreements", "read");

  const adminDb = createAdminClient();

  // Query supplier profile
  const { data: supplierProfile } = await adminDb
    .from("supplier_profiles")
    .select("*")
    .eq("company_id", membership.companyId)
    .maybeSingle();

  // Query supplier remittance and mask it if user is not admin
  let supplierRemittance = null;
  const isCompanyAdmin = membership.companyRole === "company_admin";

  if (canReadBankInfo) {
    const { data: dbRemittance } = await adminDb
      .from("supplier_remittances")
      .select("*")
      .eq("company_id", membership.companyId)
      .maybeSingle();

    if (dbRemittance) {
      if (isCompanyAdmin) {
        supplierRemittance = dbRemittance;
      } else {
        const rawAcc = dbRemittance.account_number || "";
        const maskedAcc = rawAcc.length > 4
          ? "••••••••" + rawAcc.slice(-4)
          : rawAcc ? "••••" : "";

        supplierRemittance = {
          company_id: dbRemittance.company_id,
          bank_name: dbRemittance.bank_name || null,
          account_number: maskedAcc || null,
          payment_method: dbRemittance.payment_method || null,
          beneficiary_name: null,
          beneficiary_address: null,
          bank_address: null,
          bank_country: null,
          swift_bic: null,
          routing_number: null,
          account_currency: dbRemittance.account_currency || "USD",
          intermediary_bank_info: null,
          remittance_note: null,
          created_at: dbRemittance.created_at,
          updated_at: dbRemittance.updated_at,
        };
      }
    }
  }

  // Fetch warehouses of this company or system default warehouses
  const { data: warehouses } = await adminDb
    .from("warehouses")
    .select("id, name, code, address1, status")
    .or(`company_id.eq.${membership.companyId},company_id.is.null`)
    .order("created_at", { ascending: true });

  // Fetch shipping origins
  const shippingOrigins = await getCompanyShippingOrigins(membership.companyId);
  const canEditCompanyInfo = isCompanyAdmin || (await hasMenuPermission("company_info", "write"));
  const canWriteAgreements = isCompanyAdmin || (await hasPortalPermission("agreements", "write"));

  // Fetch Company Agreement only if user has agreements read permission
  let initialAgreement = null;
  if (canReadAgreements) {
    const { getCompanyAgreement } = await import("@/lib/agreement/actions");
    const { agreement } = await getCompanyAgreement(membership.companyId);
    initialAgreement = agreement;
  }

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <CompanyProfileManager
      company={company}
      parsedMeta={parsedMeta}
      companyRole={membership.companyRole}
      taskAssignments={taskAssignments}
      companyUsers={dbUsers ?? []}
      initialSupplierProfile={supplierProfile || null}
      initialSupplierRemittance={supplierRemittance || null}
      warehouses={warehouses || []}
      initialShippingOrigins={shippingOrigins}
      canEditCompanyInfo={canEditCompanyInfo}
      canReadBankInfo={canReadBankInfo}
      canReadAgreements={canReadAgreements}
      canWriteAgreements={canWriteAgreements}
      initialAgreement={initialAgreement}
      userEmail={user?.email || ""}
    />
  );
}
