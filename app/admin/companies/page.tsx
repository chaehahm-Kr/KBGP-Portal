import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { getSystemCompanyConfigs } from "@/lib/settings/actions";
import { mockCompanies } from "@/lib/data/mockData";
import { CompaniesTableClient } from "@/components/admin/companies-table-client";

export const metadata: Metadata = {
  title: "회사 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminCompaniesPage() {
  await verifyAdminSession();
  const supabase = await createClient();

  const { data: dbCompanies } = await supabase
    .from("companies")
    .select(`
      id, name, country, status, intro, created_at,
      brands (id, is_active),
      products (id)
    `)
    .order("created_at", { ascending: false });

  const { data: companyUsers } = await supabase
    .from("company_users")
    .select("company_id, name, email, phone, title, position, is_primary, status, company_role")
    .order("created_at", { ascending: true });

  const configs = await getSystemCompanyConfigs();

  const resolvedDbCompanies = await Promise.all(
    (dbCompanies ?? []).map(async (c) => {
      const parsed = await parseCompanyMetadata(c);
      const activeBrandsCount = ((c.brands as any[]) || []).filter((b) => b.is_active).length;
      const totalProductsCount = ((c.products as any[]) || []).length;

      // Find primary contact from company_users first
      const users = (companyUsers ?? []).filter((u) => u.company_id === c.id);
      const dbPrimary = users.find((u) => u.is_primary) || users[0] || null;

      // Fallback to parsed metadata contacts
      const metadataPrimary = parsed.contacts.find((contact) => contact.isPrimary) || parsed.contacts[0] || null;

      const primaryContact = dbPrimary || metadataPrimary;

      return {
        id: c.id,
        name: c.name,
        type: parsed.type,
        country: c.country,
        contactName: primaryContact ? primaryContact.name : "담당자 정보 없음",
        contactPhone: primaryContact ? primaryContact.phone : "-",
        contactEmail: primaryContact ? primaryContact.email : "-",
        contactTitle: primaryContact ? primaryContact.title : "",
        contactPosition: primaryContact ? primaryContact.position : "",
        brandsCount: activeBrandsCount,
        productsCount: totalProductsCount,
        appStatus: parsed.status === "Active" ? "Approved" : "Pending",
        partnerStatus: parsed.status,
        accountOwner: "Alex Kim",
        lastContact: new Date(c.created_at).toLocaleDateString(),
      };
    })
  );

  // DB 데이터와 모의 데이터 병합
  const unifiedCompanies = [
    ...resolvedDbCompanies,
    ...mockCompanies.filter((mc) => !(dbCompanies ?? []).some((dc) => dc.name === mc.name)).map(mc => ({
      ...mc,
      contactName: mc.contactName || "담당자 정보 없음",
      contactPhone: mc.phone || "-",
      contactEmail: mc.email || "-",
      contactTitle: "팀장",
      contactPosition: "해외영업",
    })),
  ];

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
        companies={unifiedCompanies.map((c) => ({
          ...c,
          users: (companyUsers ?? [])
            .filter((u) => u.company_id === c.id)
            .map((u) => ({ name: u.name, email: u.email, phone: u.phone, role: u.company_role })),
        }))}
        partnerStatuses={configs.partner_statuses}
      />
    </div>
  );
}
