import type { Metadata } from "next";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyShippingOrigins } from "@/lib/company/shipping-origin-actions";
import { getProductsForSupplier } from "@/lib/purchase-order/actions";
import { PoRequestForm } from "@/components/portal/po-request-form";

export const metadata: Metadata = {
  title: "신규 발주 요청 작성 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalNewPoRequestPage() {
  const membership = await requireCompanyMembership();
  const companyId = membership.companyId;
  const admin = createAdminClient();

  // Fetch company info
  const { data: company } = await admin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  // Fetch current user details
  const { data: currentUserData } = await admin
    .from("company_users")
    .select("id, name, email")
    .eq("id", membership.userId)
    .maybeSingle();

  const currentUserName = currentUserData?.name || "담당자";
  const currentUserEmail = currentUserData?.email || "";

  // 1. Fetch company shipping origins
  const origins = await getCompanyShippingOrigins(companyId);

  // 2. Fetch active company users
  const { data: dbContacts } = await admin
    .from("company_users")
    .select("id, name, email, title, is_primary, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  const contacts = (dbContacts ?? []).map((c: any) => ({
    id: c.id,
    name: c.name || "담당자",
    email: c.email || "",
    title: c.title || "",
    is_primary: c.is_primary || false,
  }));

  // If no contacts in table, fallback to current membership user
  if (contacts.length === 0) {
    contacts.push({
      id: membership.userId,
      name: currentUserName,
      email: currentUserEmail,
      title: "",
      is_primary: true,
    });
  }

  // 3. Fetch products for this supplier company
  const products = await getProductsForSupplier(companyId);

  return (
    <div className="space-y-6">
      <PoRequestForm
        companyId={companyId}
        companyName={company?.name || "파트너사"}
        origins={origins}
        contacts={contacts}
        currentUser={{
          id: membership.userId,
          name: currentUserName,
          email: currentUserEmail,
        }}
        products={products}
      />
    </div>
  );
}
