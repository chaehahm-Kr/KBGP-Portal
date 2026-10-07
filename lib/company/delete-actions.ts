"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordActivity } from "@/lib/activity/log";
import { removeStorageFolder } from "@/lib/files/storage-folder";

/**
 * 회사 삭제 정책 (ADM-CMP-DEL-001)
 *
 * companies 를 지우면 DB가 소속 사용자 연결·신청서·문의 등 30여 개 테이블을
 * CASCADE 로 함께 지운다. 실수로 이력이 사라지지 않도록, 아래 "차단 항목"이
 * 하나라도 있으면 삭제를 거부한다 — 즉 상품·브랜드·거래 이력이 전혀 없는
 * "빈 회사"만 삭제할 수 있다.
 */
const BLOCKERS: { table: string; column: string; label: string }[] = [
  { table: "products", column: "company_id", label: "등록 상품" },
  { table: "brands", column: "company_id", label: "브랜드" },
  { table: "purchase_orders", column: "supplier_id", label: "발주(PO)" },
  { table: "supplier_invoices", column: "supplier_company_id", label: "공급사 인보이스" },
  { table: "supplier_remittance_logs", column: "company_id", label: "송금 이력" },
  { table: "landed_cost_expenses", column: "vendor_company_id", label: "물류·부대비용" },
  { table: "goods_readiness", column: "supplier_id", label: "출고 준비" },
  { table: "company_agreements", column: "company_id", label: "계약" },
  { table: "retailer_orders", column: "company_id", label: "리테일러 주문" },
];

/** 차단 항목은 아니지만 회사와 함께 삭제되는 데이터 — 확인 창에 보여준다. */
const CASCADES: { table: string; column: string; label: string }[] = [
  { table: "company_users", column: "company_id", label: "포털 사용자 연결" },
  { table: "applications", column: "company_id", label: "입점 신청서" },
  { table: "partner_inquiries", column: "company_id", label: "문의 케이스" },
];

export type CompanyDeletionItem = { label: string; count: number };

export type CompanyDeletionCheck = {
  deletable: boolean;
  blockers: CompanyDeletionItem[];
  cascades: CompanyDeletionItem[];
};

async function countRows(
  admin: ReturnType<typeof createAdminClient>,
  items: { table: string; column: string; label: string }[],
  companyId: string
): Promise<CompanyDeletionItem[]> {
  const results = await Promise.all(
    items.map(async ({ table, column, label }) => {
      const { count, error } = await admin
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(column, companyId);
      if (error) {
        // 확인할 수 없는 항목은 안전하게 "있음"으로 간주해 삭제를 막는다.
        console.error(`[company-delete] count failed for ${table}`, error);
        return { label, count: -1 };
      }
      return { label, count: count ?? 0 };
    })
  );
  return results;
}

export async function getCompanyDeletionCheck(companyId: string): Promise<CompanyDeletionCheck> {
  await verifyAdminSession();
  const admin = createAdminClient();

  const [blockerCounts, cascadeCounts] = await Promise.all([
    countRows(admin, BLOCKERS, companyId),
    countRows(admin, CASCADES, companyId),
  ]);

  const blockers = blockerCounts.filter((b) => b.count !== 0);
  return {
    deletable: blockers.length === 0,
    blockers,
    cascades: cascadeCounts.filter((c) => c.count > 0),
  };
}

export async function adminDeleteCompany(
  companyId: string,
  confirmName: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: company, error: fetchError } = await admin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  if (fetchError || !company) {
    return { success: false, error: "회사를 찾을 수 없습니다." };
  }
  if (confirmName.trim() !== company.name.trim()) {
    return { success: false, error: "확인용 회사명이 일치하지 않습니다." };
  }

  // 화면에서 본 뒤 데이터가 바뀌었을 수 있으므로 서버에서 다시 확인한다.
  const check = await getCompanyDeletionCheck(companyId);
  if (!check.deletable) {
    const reasons = check.blockers
      .map((b) => (b.count < 0 ? `${b.label}(확인 불가)` : `${b.label} ${b.count}건`))
      .join(", ");
    return { success: false, error: `삭제할 수 없습니다. 남아 있는 항목: ${reasons}` };
  }

  const { error: deleteError } = await admin.from("companies").delete().eq("id", companyId);
  if (deleteError) {
    console.error("[company-delete] delete failed", deleteError);
    if (deleteError.code === "23503") {
      return { success: false, error: "다른 데이터에서 참조 중이라 삭제할 수 없습니다." };
    }
    return { success: false, error: "회사 삭제 중 오류가 발생했습니다." };
  }

  // 회사 폴더의 업로드 파일(로고·증빙 등)은 DB와 별개라 따로 정리한다.
  await removeStorageFolder(admin, "company-uploads", companyId);

  await recordActivity({
    entityType: "company",
    entityId: companyId,
    beforeState: company.name,
    afterState: "deleted",
    changedBy: session.userId,
    reason: check.cascades.length
      ? `함께 삭제: ${check.cascades.map((c) => `${c.label} ${c.count}건`).join(", ")}`
      : null,
  });

  revalidatePath("/admin/companies");
  revalidatePath("/admin/brands");
  return { success: true };
}
