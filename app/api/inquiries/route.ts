import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import { validateUploadedFile } from "@/lib/files/validate";

export const runtime = "nodejs";

const globalForVerifications = global as unknown as {
  inMemoryVerifications?: Map<string, { code: string; expiresAt: Date; verified: boolean }>;
};
if (!globalForVerifications.inMemoryVerifications) {
  globalForVerifications.inMemoryVerifications = new Map();
}
const inMemoryCache = globalForVerifications.inMemoryVerifications;

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
  packageWidth: z.string().optional().default(""),
  packageDepth: z.string().optional().default(""),
  packageHeight: z.string().optional().default(""),
  dimensionUnit: z.enum(["cm", "inch"]).optional().default("cm"),
  packageWeight: z.string().optional().default(""),
  weightUnit: z.enum(["kg", "g", "lb"]).optional().default("g"),
  monthlyCapacity: z.string().optional().default(""),
  leadTime: z.string().optional().default(""),
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

  // 이메일 인증 완료 여부 확인
  const emailLower = input.email.trim().toLowerCase();
  let isVerified = false;

  try {
    const { data: verifications, error: verifyError } = await admin
      .from("email_verifications")
      .select("id, verified, expires_at")
      .eq("email", emailLower)
      .eq("verified", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!verifyError && verifications && verifications.length > 0) {
      const v = verifications[0];
      const notExpired = new Date(v.expires_at) > new Date(Date.now() - 30 * 60 * 1000); // 30분 내
      if (notExpired) {
        isVerified = true;
      }
    }
  } catch (dbError) {
    console.warn("[inquiries] DB verification query failed, checking in-memory:", dbError);
  }

  if (!isVerified) {
    const cached = inMemoryCache.get(emailLower);
    if (cached && cached.verified) {
      const notExpired = cached.expiresAt > new Date(Date.now() - 30 * 60 * 1000);
      if (notExpired) {
        isVerified = true;
      }
    }
  }

  if (!isVerified) {
    return NextResponse.json(
      { ok: false, errors: ["이메일 인증이 완료되지 않았습니다. 신청 전에 이메일 인증을 완료해 주세요."] },
      { status: 400 }
    );
  }

  // 1. Supabase Auth로 포털 사용자 계정 생성 (이메일은 발송하지 않음)
  const { data: invited, error: inviteError } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    user_metadata: { role: "portal", display_name: input.contactName },
  });

  if (inviteError || !invited.user) {
    console.error("[inquiries] create user failed", inviteError);
    if (inviteError?.code === "email_exists") {
      return NextResponse.json(
        { ok: false, errors: ["이미 등록된 이메일 주소입니다. 브랜드 포털에서 로그인해 주세요."] },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, errors: ["포털 계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요."] },
      { status: 500 }
    );
  }

  // 2. 회사(Companies) 레코드 생성
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: input.companyName,
      business_registration_number: input.businessNumber,
      country: "대한민국",
      contact_name: input.contactName,
      contact_phone: input.phone,
      intro: `__COMPANY_METADATA__:${JSON.stringify({
        description: "",
        address: input.companyAddress,
        website: input.homepage || "",
        contacts: [
          {
            name: input.contactName,
            title: input.contactTitle || "",
            email: input.email,
            phone: input.phone,
            isPrimary: true,
          },
        ],
        type: "Brand Owner",
      })}`,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    console.error("[inquiries] company insert failed", companyError);
    await admin.auth.admin.deleteUser(invited.user.id); // 롤백
    return NextResponse.json(
      { ok: false, errors: ["회사 정보 생성에 실패했습니다. 잠시 후 다시 시도해주세요."] },
      { status: 500 }
    );
  }

  // 3. 회사 유저 권한 매핑(Company Users) 생성
  const { error: companyUserError } = await admin.from("company_users").insert({
    id: invited.user.id,
    company_id: company.id,
    name: input.contactName,
    email: input.email,
    company_role: "company_admin",
    status: "invited",
    invited_at: null,
  });

  if (companyUserError) {
    console.error("[inquiries] company user insert failed", companyUserError);
    await admin.from("companies").delete().eq("id", company.id);
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json(
      { ok: false, errors: ["포털 사용자 권한 매핑에 실패했습니다."] },
      { status: 500 }
    );
  }

  // 4. 브랜드(Brands) 레코드 생성
  const { data: brand, error: brandError } = await admin
    .from("brands")
    .insert({
      company_id: company.id,
      name: input.brandName || input.companyName,
    })
    .select("id")
    .single();

  if (brandError || !brand) {
    console.error("[inquiries] brand insert failed", brandError);
    await admin.from("companies").delete().eq("id", company.id);
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json(
      { ok: false, errors: ["브랜드 생성에 실패했습니다."] },
      { status: 500 }
    );
  }

  // 5. 신청 고유번호 발급
  const { data: numberResult, error: numberError } = await admin.rpc("generate_inquiry_number");
  if (numberError) {
    console.warn("[inquiries] generate_inquiry_number RPC failed, falling back to timestamp", numberError);
  }
  const applicationNumber = numberResult || `APP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const defaultEligibility = [
    { itemKey: "stable_supply", response: "available" },
    { itemKey: "us_regulatory_compliance", response: "available" },
    { itemKey: "initial_test_quantity", response: "available" },
    { itemKey: "north_america_distribution", response: "available" },
    { itemKey: "joint_marketing", response: "available" },
    { itemKey: "sales_content_support", response: "available" },
  ];
  const finalEligibility = input.eligibilityResponses && input.eligibilityResponses.length === 6
    ? input.eligibilityResponses
    : defaultEligibility;

  // 6. 신청서(Applications) 생성 (submitted 상태)
  const { data: application, error: appError } = await admin
    .from("applications")
    .insert({
      company_id: company.id,
      application_number: applicationNumber,
      status: "submitted",
      motivation_note: "공개 마케팅 사이트 파트너십 신청 접수 건",
      self_check_answers: Array(6).fill(true),
      eligibility_responses: finalEligibility,
      created_by: invited.user.id,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (appError || !application) {
    console.error("[inquiries] application insert failed", appError);
    await admin.from("companies").delete().eq("id", company.id);
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json(
      { ok: false, errors: ["신청서 생성에 실패했습니다."] },
      { status: 500 }
    );
  }

  // 7. 상품 등록 루프 & 스토리지 업로드
  const CATEGORY_MAP: Record<string, string> = {
    "스킨케어": "skincare",
    "헤어/두피": "hair_scalp",
    "미용기기": "beauty_tools",
    "바디/헤어": "hair_scalp",
    "웰니스 패치": "wellness_patch",
    "데일리 케어": "daily_care",
    "기타": "daily_care",
    "Skincare": "skincare",
    "Hair & Scalp": "hair_scalp",
    "Beauty Tools": "beauty_tools",
    "Daily Care": "daily_care",
    "Wellness Patch": "wellness_patch",
    "Other": "daily_care",
  };

  const MAX_FILES_PER_PRODUCT = 3;
  const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
  let totalBytes = 0;

  for (const [productIndex, p] of input.products.entries()) {
    const retailPrice = Number(p.priceKrw.replace(/[^0-9]/g, "")) || null;
    const cat = CATEGORY_MAP[p.category] || "skincare";

    // 가로, 세로, 높이 단위 변환 (inch -> cm)
    let widthNum = Number(p.packageWidth) || null;
    let depthNum = Number(p.packageDepth) || null;
    let heightNum = Number(p.packageHeight) || null;
    if (p.dimensionUnit === "inch") {
      if (widthNum !== null) widthNum = Number((widthNum * 2.54).toFixed(3));
      if (depthNum !== null) depthNum = Number((depthNum * 2.54).toFixed(3));
      if (heightNum !== null) heightNum = Number((heightNum * 2.54).toFixed(3));
    }

    // 무게 단위 변환 (kg, lb -> g)
    let weightNum = Number(p.packageWeight) || null;
    if (weightNum !== null) {
      if (p.weightUnit === "kg") {
        weightNum = Number((weightNum * 1000).toFixed(3));
      } else if (p.weightUnit === "lb") {
        weightNum = Number((weightNum * 453.59237).toFixed(3));
      }
    }

    const formattedVolume = p.packageWidth && p.packageDepth && p.packageHeight
      ? `${p.packageWidth}x${p.packageDepth}x${p.packageHeight} ${p.dimensionUnit}`
      : null;

    const { data: product, error: prodError } = await admin
      .from("products")
      .insert({
        brand_id: brand.id,
        company_id: company.id,
        name: p.name,
        category: cat,
        volume: formattedVolume,
        estimated_retail_price: retailPrice,
        ingredients_text: p.note || null,
        status: "registered",
        package_width: widthNum,
        package_depth: depthNum,
        package_height: heightNum,
        package_weight: weightNum,
        lead_time: p.leadTime || null,
      })
      .select("id")
      .single();

    if (prodError || !product) {
      console.error(`[inquiries] product ${productIndex} insert failed`, prodError);
      continue;
    }

    // 8. 신청 상품(Application Products) 관계 매핑
    await admin.from("application_products").insert({
      application_id: application.id,
      product_id: product.id,
      company_id: company.id,
      review_status: "pending",
    });

    // 9. 제품 첨부 파일 업로드 및 product_images 매핑
    let fileCount = 0;
    for (const [key, value] of form.entries()) {
      if (!key.startsWith(`file_${productIndex}_`) || !(value instanceof File) || value.size === 0) continue;
      if (fileCount >= MAX_FILES_PER_PRODUCT) continue;

      totalBytes += value.size;
      if (totalBytes > MAX_TOTAL_BYTES) continue;

      const validation = await validateUploadedFile(value, ["image", "document"]);
      if (!validation.ok) continue;

      // 비공개 company-uploads 버킷 업로드
      const storagePath = `${company.id}/products/${product.id}/images/${crypto.randomUUID()}-${value.name}`;
      const { error: uploadError } = await admin.storage
        .from("company-uploads")
        .upload(storagePath, value, { contentType: validation.detectedMime });

      if (!uploadError) {
        await admin.from("product_images").insert({
          product_id: product.id,
          company_id: company.id,
          storage_path: storagePath,
          position: fileCount,
        });
        fileCount++;
      }
    }
  }

  // 10. inquiry 히스토리/스냅샷용 레코드 적재
  await admin.from("inquiries").insert({
    inquiry_number: applicationNumber,
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
    eligibility_responses: finalEligibility,
    status: "converted",
    converted_company_id: company.id,
  });

  // 11. 이메일 알림 발송
  await sendTemplatedEmail("inquiry_received_applicant", input.email, {
    inquiryNumber: applicationNumber,
    companyName: input.companyName,
  });

  const { data: staffMembers } = await admin
    .from("staff_members")
    .select("email")
    .eq("status", "active");

  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/applications/${application.id}`;
  for (const staff of staffMembers ?? []) {
    await sendTemplatedEmail("inquiry_received_internal", staff.email, {
      inquiryNumber: applicationNumber,
      companyName: input.companyName,
      productCount: String(input.products.length),
      link,
    });
  }

  return NextResponse.json({ ok: true, id: applicationNumber });
}
