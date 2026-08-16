import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { CompanyProfileManager } from "@/components/portal/company-profile-manager";

export const metadata: Metadata = {
  title: "회사 정보 관리 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalCompanyInfoPage() {
  const membership = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, business_registration_number, country, contact_name, contact_phone, intro, status, created_at")
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
      id, name, email, company_role, status, title, position, phone, is_primary,
      task_assignments:company_task_assignments(task_code, is_primary, email_notify)
    `)
    .eq("company_id", membership.companyId)
    .order("created_at", { ascending: true });

  // Safe fallback if database columns do not exist yet (migration 0017 not applied)
  if (usersError && (usersError.code === "42703" || usersError.message.includes("column"))) {
    const { data: fallbackUsers } = await supabase
      .from("company_users")
      .select("id, name, email, company_role, status")
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

  const contacts = (dbUsers || []).map((u: any) => ({
    id: u.id,
    name: u.name || "",
    phone: u.phone || "",
    email: u.email || "",
    title: u.title || "",
    position: u.position || "",
    isPrimary: u.is_primary || false,
    status: u.status,
  }));

  // Overwrite contacts in parsedMeta with the actual database company_users
  parsedMeta.contacts = contacts;

  // Query task assignments
  const { getCompanyTaskAssignments } = await import("@/lib/company/task-actions");
  const taskAssignments = await getCompanyTaskAssignments(membership.companyId);

  const adminDb = createAdminClient();

  // Query supplier profile
  const { data: supplierProfile } = await adminDb
    .from("supplier_profiles")
    .select("*")
    .eq("company_id", membership.companyId)
    .maybeSingle();

  // Query supplier remittance and mask it if user is not admin
  const { data: dbRemittance } = await adminDb
    .from("supplier_remittances")
    .select("*")
    .eq("company_id", membership.companyId)
    .maybeSingle();

  let supplierRemittance = null;
  const isCompanyAdmin = membership.companyRole === "company_admin";

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

  // Fetch warehouses of this company
  const { data: warehouses } = await adminDb
    .from("warehouses")
    .select("id, name, code, address1, status")
    .eq("company_id", membership.companyId)
    .order("created_at", { ascending: true });

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
    />
  );
}
