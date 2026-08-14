import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";
import { convertInquiryToCompany, declineInquiry } from "@/lib/inquiries/actions";
import { ConvertInquiryForm } from "@/components/inquiries/convert-inquiry-form";
import { DeclineInquiryForm } from "@/components/inquiries/decline-inquiry-form";

export const metadata: Metadata = {
  title: "신청 접수 상세 | 관리자 콘솔",
};

type InquiryProduct = {
  name: string;
  category: string;
  priceKrw?: string;
  supplyPriceUsd?: string;
  packageVolume?: string;
  packageWeight?: string;
  monthlyCapacity?: string;
  note?: string;
};

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await verifyAdminSession();
  const supabase = await createClient();

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*")
    .eq("id", id)
    .single();

  if (!inquiry) {
    notFound();
  }

  const { data: attachments } = await supabase
    .from("inquiry_attachments")
    .select("id, product_index, original_name, storage_path")
    .eq("inquiry_id", id);

  const attachmentRows = attachments ?? [];
  const attachmentUrls = await Promise.all(
    attachmentRows.map((a) => getSignedFileUrl(a.storage_path, 3600, "inquiry-uploads"))
  );

  const products = (inquiry.products ?? []) as InquiryProduct[];

  return (
    <div className="w-full space-y-6">
      <h1 className="text-lg font-semibold text-zinc-900">{inquiry.inquiry_number}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {new Date(inquiry.received_at).toLocaleString("ko-KR")} 접수
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">회사 정보</h2>
        <dl className="mt-2 space-y-1 text-sm text-zinc-600">
          <div>
            <dt className="inline font-medium text-zinc-900">회사명: </dt>
            <dd className="inline">{inquiry.company_name}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-zinc-900">사업자등록번호: </dt>
            <dd className="inline">{inquiry.business_registration_number}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-zinc-900">주소: </dt>
            <dd className="inline">{inquiry.company_address}</dd>
          </div>
          {inquiry.brand_name && (
            <div>
              <dt className="inline font-medium text-zinc-900">브랜드명: </dt>
              <dd className="inline">{inquiry.brand_name}</dd>
            </div>
          )}
          {inquiry.homepage && (
            <div>
              <dt className="inline font-medium text-zinc-900">홈페이지: </dt>
              <dd className="inline">{inquiry.homepage}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">담당자</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {inquiry.contact_name}
          {inquiry.contact_title ? ` (${inquiry.contact_title})` : ""} ·{" "}
          {inquiry.contact_email} · {inquiry.contact_phone}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900">
          제품 정보 ({products.length}건)
        </h2>
        <div className="mt-3 space-y-3">
          {products.map((product, index) => (
            <div key={index} className="rounded-md border border-zinc-200 p-4 text-sm">
              <p className="font-medium text-zinc-900">
                {product.name} <span className="text-zinc-400">· {product.category}</span>
              </p>
              <p className="mt-1 text-zinc-600">
                국내 판매가 {product.priceKrw || "-"}원 · 공급가 ${product.supplyPriceUsd || "-"} ·
                월 생산 가능 {product.monthlyCapacity || "-"}
              </p>
              {product.note && <p className="mt-1 text-zinc-500">{product.note}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {attachmentRows
                  .map((a, i) => ({ ...a, url: attachmentUrls[i] }))
                  .filter((a) => a.product_index === index && a.url)
                  .map((a) => (
                    <a
                      key={a.id}
                      href={a.url!}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-zinc-900 underline underline-offset-2"
                    >
                      {a.original_name}
                    </a>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {inquiry.status === "pending" && (
        <section className="mt-8 space-y-4 border-t border-zinc-100 pt-6">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">회사로 전환</h2>
            <p className="mt-1 text-xs text-zinc-500">
              회사 계정을 만들고 담당자에게 포털 초대 메일을 보냅니다.
            </p>
            <div className="mt-3">
              <ConvertInquiryForm action={convertInquiryToCompany.bind(null, id)} />
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">거절</h2>
            <div className="mt-3">
              <DeclineInquiryForm action={declineInquiry.bind(null, id)} />
            </div>
          </div>
        </section>
      )}

      {inquiry.status === "converted" && inquiry.converted_company_id && (
        <p className="mt-8 text-sm text-emerald-700">
          전환 완료 —{" "}
          <Link
            href={`/admin/companies/${inquiry.converted_company_id}`}
            className="underline underline-offset-2"
          >
            회사 상세 보기
          </Link>
        </p>
      )}

      {inquiry.status === "declined" && (
        <p className="mt-8 text-sm text-zinc-500">
          거절됨{inquiry.decline_reason ? ` — ${inquiry.decline_reason}` : ""}
        </p>
      )}
    </div>
  );
}
