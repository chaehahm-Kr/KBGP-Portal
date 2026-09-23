import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyShippingOrigins } from "@/lib/company/shipping-origin-actions";
import { getProductsForSupplier } from "@/lib/purchase-order/actions";
import { getPortalPoRequestDetail } from "@/lib/purchase-order/request-actions";
import { PoRequestForm } from "@/components/portal/po-request-form";

export const metadata: Metadata = {
  title: "발주 요청 수정 | K SELECT NETWORK 파트너 포털",
};

export default async function PortalEditPoRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireCompanyMembership();
  const companyId = membership.companyId;
  const admin = createAdminClient();

  let request;
  try {
    request = await getPortalPoRequestDetail(id);
  } catch (err) {
    notFound();
  }

  // Only allow editing DRAFT or CHANGE_REQUESTED
  if (request.status !== "DRAFT" && request.status !== "CHANGE_REQUESTED") {
    redirect(`/portal/orders/requests/${id}`);
  }

  try {
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

    if (contacts.length === 0) {
      contacts.push({
        id: membership.userId,
        name: currentUserName,
        email: currentUserEmail,
        title: "",
        is_primary: true,
      });
    }

    // 3. Fetch products
    const products = await getProductsForSupplier(companyId);

    return (
      <div className="space-y-6">
        <PoRequestForm
          initialRequest={request}
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
  } catch (err: any) {
    return (
      <div className="p-8 max-w-xl mx-auto border border-rose-200 bg-rose-50 rounded-2xl text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200 space-y-3 shadow-sm">
        <h2 className="text-base font-extrabold flex items-center gap-2">
          ⚠️ 발주 요청 수정 화면을 불러올 수 없습니다
        </h2>
        <p className="text-xs font-semibold leading-relaxed text-rose-700 dark:text-rose-300">
          {err?.message || "현재 계정에 연결된 회사 정보를 확인할 수 없습니다. 관리자에게 문의해주세요."}
        </p>
      </div>
    );
  }
}
