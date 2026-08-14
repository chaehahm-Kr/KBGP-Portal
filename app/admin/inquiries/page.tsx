import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "신청 접수 | 관리자 콘솔",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "미처리",
  converted: "전환됨",
  declined: "거절됨",
};

/**
 * 마케팅 사이트(kselectnetwork.com)의 "신청서 접수" 폼에서 들어온 문의 목록.
 * companies/company_users와 분리된 상태이므로, 여기서는 아직 아무 포털 권한도
 * 없는 회사들이다 — "전환"해야만 실제 회사 계정이 생긴다.
 */
export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await verifyAdminSession();
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("inquiries")
    .select("id, inquiry_number, company_name, contact_name, contact_email, status, received_at, products")
    .order("received_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data: inquiries } = await query;

  return (
    <div className="w-full space-y-6">
      <h1 className="text-lg font-semibold text-zinc-900">신청 접수</h1>
      <p className="mt-1 text-sm text-zinc-500">
        마케팅 사이트에서 들어온 문의입니다. 검토 후 거래할 회사만 "전환"해서 포털
        계정을 발급합니다.
      </p>

      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/admin/inquiries" className="text-zinc-900 underline underline-offset-2">
          전체
        </Link>
        <Link
          href="/admin/inquiries?status=pending"
          className="text-zinc-900 underline underline-offset-2"
        >
          미처리
        </Link>
        <Link
          href="/admin/inquiries?status=converted"
          className="text-zinc-900 underline underline-offset-2"
        >
          전환됨
        </Link>
        <Link
          href="/admin/inquiries?status=declined"
          className="text-zinc-900 underline underline-offset-2"
        >
          거절됨
        </Link>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500">
            <th className="py-2 font-medium">접수번호</th>
            <th className="py-2 font-medium">회사명</th>
            <th className="py-2 font-medium">담당자</th>
            <th className="py-2 font-medium">제품 수</th>
            <th className="py-2 font-medium">상태</th>
            <th className="py-2 font-medium">접수일</th>
          </tr>
        </thead>
        <tbody>
          {(inquiries ?? []).map((inquiry) => (
            <tr key={inquiry.id} className="border-b border-zinc-100">
              <td className="py-3">
                <Link
                  href={`/admin/inquiries/${inquiry.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {inquiry.inquiry_number}
                </Link>
              </td>
              <td className="py-3 text-zinc-600">{inquiry.company_name}</td>
              <td className="py-3 text-zinc-600">
                {inquiry.contact_name} ({inquiry.contact_email})
              </td>
              <td className="py-3 text-zinc-600">
                {Array.isArray(inquiry.products) ? inquiry.products.length : 0}
              </td>
              <td className="py-3 text-zinc-600">
                {STATUS_LABEL[inquiry.status] ?? inquiry.status}
              </td>
              <td className="py-3 text-zinc-600">
                {new Date(inquiry.received_at).toLocaleDateString("ko-KR")}
              </td>
            </tr>
          ))}
          {(inquiries ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-zinc-400">
                접수 건이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
