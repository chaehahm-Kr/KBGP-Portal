import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
import { createNotification } from "@/lib/notification/actions";
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import { validateUploadedFile } from "@/lib/files/validate";
import { getPersonStructuredNames, getPersonGreetingName, getPersonDisplayName } from "@/lib/user/name-helper";
import { generateNextApplicationNumber } from "@/lib/application/number-generator";

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
  dimensionUnit: z.enum(["cm", "inch", ""]).optional().default("cm"),
  packageWeight: z.string().optional().default(""),
  weightUnit: z.enum(["kg", "g", "lb", ""]).optional().default("g"),
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
  country: z.string().optional().default("대한민국"),
  addressLine1: z.string().optional().default(""),
  addressLine2: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  postalCode: z.string().optional().default(""),
  companyAddress: z.string().trim().min(1),
  brandName: z.string().optional().default(""),
  homepage: z.string().optional().default(""),
  contactName: z.string().trim().min(1),
  koreanLastName: z.string().optional().default(""),
  koreanFirstName: z.string().optional().default(""),
  englishFirstName: z.string().optional().default(""),
  englishLastName: z.string().optional().default(""),
  contactTitle: z.string().optional().default(""),
  contactDepartment: z.string().optional().default(""),
  email: z.email(),
  phone: z.string().trim().min(1),
  phoneCountryCode: z.string().optional().default("+82"),
  phoneNumber: z.string().optional().default(""),
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

  // 1. Retailer Application Branch (if partnerType/partner_type === 'retailer' or retailer mode)
  const isRetailerPayload =
    parsedInput?.partnerType === "retailer" ||
    parsedInput?.partner_type === "retailer" ||
    parsedInput?.type === "retailer" ||
    (parsedInput?.companyName && parsedInput?.contactName && parsedInput?.email && (!parsedInput?.products || parsedInput?.products.length === 0));

  if (isRetailerPayload) {
    const admin = createAdminClient();
    const companyName = String(parsedInput.companyName || "").trim();
    const contactName = String(parsedInput.contactName || "").trim();
    const email = String(parsedInput.email || "").trim().toLowerCase();
    const phone = String(parsedInput.phone || "").trim();
    const address = String(parsedInput.companyAddress || parsedInput.streetAddress || "").trim();

    if (!companyName || !contactName || !email) {
      return NextResponse.json(
        { ok: false, errors: ["Company Name, Owner/Contact Name, and Email are required for Retailer Applications."] },
        { status: 422 }
      );
    }

    let applicationNumber = `APP-RET-${Date.now().toString().slice(-6)}`;
    try {
      const { data: numberResult } = await admin.rpc("generate_application_number");
      if (numberResult) applicationNumber = numberResult;
    } catch (e) {}

    const { data: appRow, error: appError } = await admin
      .from("applications")
      .insert({
        application_number: applicationNumber,
        partner_type: "retailer",
        entry_mode: "public_application",
        status: "submitted",
        applicant_company_name: companyName,
        applicant_contact_name: contactName,
        applicant_contact_email: email,
        applicant_contact_phone: phone,
        applicant_address: { address, city: parsedInput.city || "", state: parsedInput.state || "", zip: parsedInput.zipCode || "" },
        eligibility_responses: parsedInput.readinessAnswers || parsedInput.eligibilityResponses || [],
        self_check_answers: Array.isArray(parsedInput.readinessAnswers)
          ? parsedInput.readinessAnswers.map((r: any) => r.response === "ready")
          : [true, true, true, true],
        motivation_note: parsedInput.comments || "Public Retailer Application via K SELECT HUB",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (appError || !appRow) {
      console.error("[inquiries] Retailer application insert failed:", appError);
      return NextResponse.json(
        { ok: false, errors: ["신청서 저장에 실패했습니다. 다시 시도해 주세요."] },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: applicationNumber, applicationId: appRow.id });
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

  const structuredName = getPersonStructuredNames({
    koreanLastName: input.koreanLastName,
    koreanFirstName: input.koreanFirstName,
    firstName: input.englishFirstName,
    lastName: input.englishLastName,
    name: input.contactName,
  });

  const resolvedContactName = structuredName.koreanLastName && structuredName.koreanFirstName
    ? `${structuredName.koreanLastName}${structuredName.koreanFirstName}`
    : (input.contactName || structuredName.canonicalEnglishName);
  const resolvedEnglishName = structuredName.canonicalEnglishName || null;

  // 1. Supabase Auth로 포털 사용자 계정 생성 (이메일은 발송하지 않음)
  const { data: invited, error: inviteError } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: false,
    user_metadata: { role: "portal", display_name: resolvedContactName },
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
      country: input.country?.trim() || "대한민국",
      contact_name: resolvedContactName,
      contact_phone: input.phone,
      intro: `__COMPANY_METADATA__:${JSON.stringify({
        description: "",
        address: input.companyAddress,
        address_1: input.addressLine1 || "",
        address_2: input.addressLine2 || "",
        city: input.city || "",
        state: input.state || "",
        zip_code: input.postalCode || "",
        website: input.homepage || "",
        contacts: [
          {
            name: resolvedContactName,
            englishName: resolvedEnglishName,
            koreanLastName: structuredName.koreanLastName,
            koreanFirstName: structuredName.koreanFirstName,
            englishFirstName: structuredName.englishFirstName,
            englishLastName: structuredName.englishLastName,
            title: input.contactTitle || "",
            position: input.contactTitle || "",
            department: input.contactDepartment || "",
            email: input.email,
            phone: input.phone,
            phoneCountryCode: input.phoneCountryCode || "+82",
            phoneNumber: input.phoneNumber || input.phone,
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
  const permissionsObj = {
    korean_last_name: structuredName.koreanLastName,
    korean_first_name: structuredName.koreanFirstName,
    english_first_name: structuredName.englishFirstName,
    english_last_name: structuredName.englishLastName,
    first_name: structuredName.englishFirstName,
    last_name: structuredName.englishLastName,
    english_name: resolvedEnglishName,
    phone_country_code: input.phoneCountryCode || "+82",
    phone_number: input.phoneNumber || input.phone,
    job_title: input.contactTitle || "",
    department: input.contactDepartment || "",
  };

  const { error: companyUserError } = await admin.from("company_users").insert({
    id: invited.user.id,
    company_id: company.id,
    name: resolvedContactName,
    english_name: resolvedEnglishName,
    email: input.email,
    company_role: "company_admin",
    status: "invited",
    invited_at: null,
    title: input.contactTitle || null,
    position: input.contactDepartment || null,
    phone: input.phone || null,
    permissions: permissionsObj,
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

  // 5. 신청 고유번호 발급 (ADM-APP-005-R1: APP-YYYYMMDD-M####)
  const { applicationNumber } = await generateNextApplicationNumber(admin, "public_application");

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
      partner_type: "brand",
      entry_mode: "public_application",
      status: "submitted",
      applicant_company_name: input.companyName,
      applicant_contact_name: input.contactName,
      applicant_contact_email: input.email,
      applicant_contact_phone: input.phone,
      applicant_address: {
        country: input.country || "대한민국",
        address_line_1: input.addressLine1 || "",
        address_line_2: input.addressLine2 || "",
        city: input.city || "",
        state: input.state || "",
        postal_code: input.postalCode || "",
        formatted: input.companyAddress,
      },
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
    let widthNum = p.packageWidth?.trim() ? Number(p.packageWidth) : null;
    if (isNaN(widthNum as number)) widthNum = null;
    let depthNum = p.packageDepth?.trim() ? Number(p.packageDepth) : null;
    if (isNaN(depthNum as number)) depthNum = null;
    let heightNum = p.packageHeight?.trim() ? Number(p.packageHeight) : null;
    if (isNaN(heightNum as number)) heightNum = null;

    if (p.dimensionUnit === "inch") {
      if (widthNum !== null) widthNum = Number((widthNum * 2.54).toFixed(3));
      if (depthNum !== null) depthNum = Number((depthNum * 2.54).toFixed(3));
      if (heightNum !== null) heightNum = Number((heightNum * 2.54).toFixed(3));
    }

    // 무게 단위 변환 (kg, lb -> g)
    let weightNum = p.packageWeight?.trim() ? Number(p.packageWeight) : null;
    if (isNaN(weightNum as number)) weightNum = null;
    if (weightNum !== null) {
      if (p.weightUnit === "kg") {
        weightNum = Number((weightNum * 1000).toFixed(3));
      } else if (p.weightUnit === "lb") {
        weightNum = Number((weightNum * 453.59237).toFixed(3));
      }
    }

    const formattedVolume = p.packageWidth?.trim() && p.packageDepth?.trim() && p.packageHeight?.trim()
      ? `${p.packageWidth.trim()}x${p.packageDepth.trim()}x${p.packageHeight.trim()} ${p.dimensionUnit || "cm"}`
      : null;

    const { data: product, error: prodError } = await admin
      .from("products")
      .insert({
        brand_id: brand.id,
        company_id: company.id,
        name: p.name,
        category: cat,
        volume: formattedVolume,
        price_krw_retail: retailPrice,
        estimated_retail_price: null,
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
    contactName: resolvedContactName,
    contact_name: resolvedContactName,
    greeting_name: getPersonGreetingName({
      koreanLastName: structuredName.koreanLastName,
      koreanFirstName: structuredName.koreanFirstName,
      firstName: structuredName.englishFirstName,
      name: resolvedContactName,
      email: input.email,
    }),
    display_name: getPersonDisplayName({
      koreanLastName: structuredName.koreanLastName,
      koreanFirstName: structuredName.koreanFirstName,
      firstName: structuredName.englishFirstName,
      lastName: structuredName.englishLastName,
      name: resolvedContactName,
      email: input.email,
    }),
  });

  const { data: staffMembers } = await admin
    .from("staff_members")
    .select("id, email, user_id")
    .eq("status", "active");

  const appDetailRelativePath = `/admin/applications/${application.id}`;
  const link = `${publicEnv.NEXT_PUBLIC_SITE_URL}${appDetailRelativePath}`;

  for (const staff of staffMembers ?? []) {
    // In-app admin notification
    const targetUserId = staff.user_id || staff.id;
    if (targetUserId) {
      try {
        await createNotification(
          targetUserId,
          null,
          `신규 브랜드 파트너십 신청 — ${input.companyName}`,
          `${input.companyName}의 신규 브랜드 파트너십 신청서(#${applicationNumber})가 접수되었습니다.`,
          appDetailRelativePath
        );
      } catch (notifErr) {
        console.warn("[inquiries] createNotification failed for staff:", staff.email, notifErr);
      }
    }

    // Templated email
    try {
      await sendTemplatedEmail("inquiry_received_internal", staff.email, {
        inquiryNumber: applicationNumber,
        companyName: input.companyName,
        productCount: String(input.products.length),
        link,
      });
    } catch (emailErr) {
      console.warn("[inquiries] sendTemplatedEmail failed for staff:", staff.email, emailErr);
    }
  }

  return NextResponse.json({ ok: true, id: applicationNumber });
}
