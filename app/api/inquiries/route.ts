import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import { validateUploadedFile } from "@/lib/files/validate";

export const runtime = "nodejs";

// 마케팅 사이트(kselectnetwork.com) 신청서 접수 폼과 동일한 한도.
// lib/application-form.ts(KBeautyWebsite/web)와 값이 반드시 같아야 한다 —
// 그쪽이 이미 브라우저에서 이 한도로 걸러 보내므로, 여기서 값이 다르면
// 정상 제출도 거부될 수 있다.
const MAX_PRODUCTS = 3;
const MAX_FILES_PER_PRODUCT = 3;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

const productSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  priceKrw: z.string().optional().default(""),
  supplyPriceUsd: z.string().optional().default(""),
  packageVolume: z.string().optional().default(""),
  packageWeight: z.string().optional().default(""),
  monthlyCapacity: z.string().optional().default(""),
  note: z.string().optional().default(""),
});

const eligibilityResponseSchema = z.object({
  itemKey: z.enum([
    "stable_supply",
    "us_regulatory_compliance",
    "initial_test_quantity",
    "north_america_distribution",
    "joint_marketing",
    "sales_content_support",
  ]),
  response: z.enum(["available", "discussion_required"]),
});

const payloadSchema = z.object({
  companyName: z.string().trim().min(1),
  businessNumber: z.string().trim().min(1),
  companyAddress: z.string().trim().min(1),
  brandName: z.string().optional().default(""),
  homepage: z.string().optional().default(""),
  contactName: z.string().trim().min(1),
  contactTitle: z.string().optional().default(""),
  email: z.email(),
  phone: z.string().trim().min(1),
  products: z.array(productSchema).min(1).max(MAX_PRODUCTS),
  agreePrivacy: z.literal(true),
  eligibilityResponses: z.array(eligibilityResponseSchema).length(6).optional(),
});

function newInquiryNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INQ-${stamp}-${rand}`;
}

/**
 * 마케팅 사이트의 /api/applications가 서버 간 호출로 이 라우트를 부른다
 * (브라우저가 직접 크로스오리진으로 부르지 않으므로 CORS 설정이 필요 없다).
 * 09_알림및문서관리규칙.md·10_보안과권한요구사항.md와 별개로, 이 엔드포인트
 * 자체는 "누구나 신청할 수 있어야" 하므로 로그인 세션을 요구하지 않는다 —
 * 대신 마케팅 사이트만 알고 있는 공유 시크릿으로 무작위 스팸 POST를 막는다.
 */
export async function POST(request: Request) {
  const expected = serverEnv.INQUIRY_INTAKE_SECRET
    ? `Bearer ${serverEnv.INQUIRY_INTAKE_SECRET}`
    : null;
  if (expected) {
    if (request.headers.get("authorization") !== expected) {
      return NextResponse.json({ ok: false, errors: ["unauthorized"] }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, errors: ["INQUIRY_INTAKE_SECRET not configured"] },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, errors: ["요청을 읽을 수 없습니다."] }, { status: 400 });
  }

  const rawPayload = form.get("payload");
  let parsedInput;
  try {
    parsedInput = JSON.parse(typeof rawPayload === "string" ? rawPayload : "");
  } catch {
    return NextResponse.json(
      { ok: false, errors: ["신청 내용을 해석할 수 없습니다."] },
      { status: 400 }
    );
  }

  const result = payloadSchema.safeParse(parsedInput);
  if (!result.success) {
    return NextResponse.json(
      { ok: false, errors: result.error.issues.map((i) => i.message) },
      { status: 422 }
    );
  }
  const input = result.data;

  const admin = createAdminClient();
  const inquiryNumber = newInquiryNumber();

  const { data: inquiry, error: insertError } = await admin
    .from("inquiries")
    .insert({
      inquiry_number: inquiryNumber,
      company_name: input.companyName,
      business_registration_number: input.businessNumber,
      company_address: input.companyAddress,
      brand_name: input.brandName || null,
      homepage: input.homepage || null,
      contact_name: input.contactName,
      contact_title: input.contactTitle || null,
      contact_email: input.email,
      contact_phone: input.phone,
      products: input.products,
      eligibility_responses: input.eligibilityResponses || null,
    })
    .select("id, inquiry_number")
    .single();

  if (insertError || !inquiry) {
    console.error("[inquiries] insert failed", insertError);
    return NextResponse.json(
      { ok: false, errors: ["접수 저장에 실패했습니다. 잠시 후 다시 시도해주세요."] },
      { status: 500 }
    );
  }

  // 첨부파일: file_<상품index>_<n> 키로 들어온다(마케팅 사이트 ApplyModal 규약).
  const perProduct = new Map<number, number>();
  let totalBytes = 0;

  for (const [key, value] of form.entries()) {
    if (!key.startsWith("file_") || !(value instanceof File) || value.size === 0) continue;

    const productIndex = Number(key.split("_")[1]);
    if (!Number.isInteger(productIndex) || productIndex < 0 || productIndex >= input.products.length) {
      continue;
    }

    const count = (perProduct.get(productIndex) ?? 0) + 1;
    if (count > MAX_FILES_PER_PRODUCT) continue;
    perProduct.set(productIndex, count);

    totalBytes += value.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json(
        { ok: false, errors: ["첨부파일 총 용량이 한도를 넘었습니다."] },
        { status: 413 }
      );
    }

    const validation = await validateUploadedFile(value, ["image", "document"]);
    if (!validation.ok) {
      // 첨부 검증 실패는 접수 자체를 막지 않는다 — 이미 inquiries 행은
      // 저장됐으므로, 문제 파일만 건너뛰고 나머지는 정상 접수한다.
      console.warn(`[inquiries] ${inquiry.inquiry_number} 첨부 거부: ${validation.error}`);
      continue;
    }

    const storagePath = `${inquiry.id}/${productIndex}/${crypto.randomUUID()}-${value.name}`;
    const { error: uploadError } = await admin.storage
      .from("inquiry-uploads")
      .upload(storagePath, value, { contentType: validation.detectedMime });

    if (!uploadError) {
      await admin.from("inquiry_attachments").insert({
        inquiry_id: inquiry.id,
        product_index: productIndex,
        original_name: value.name,
        storage_path: storagePath,
        size_bytes: value.size,
        content_type: validation.detectedMime,
      });
    }
  }

  await sendTemplatedEmail("inquiry_received_applicant", input.email, {
    inquiryNumber: inquiry.inquiry_number,
    companyName: input.companyName,
  });

  const { data: staffMembers } = await admin
    .from("staff_members")
    .select("email")
    .eq("status", "active");

  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/inquiries/${inquiry.id}`;
  for (const staff of staffMembers ?? []) {
    await sendTemplatedEmail("inquiry_received_internal", staff.email, {
      inquiryNumber: inquiry.inquiry_number,
      companyName: input.companyName,
      productCount: String(input.products.length),
      link,
    });
  }

  return NextResponse.json({ ok: true, id: inquiry.inquiry_number });
}
