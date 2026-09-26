"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { validateUploadedFile } from "@/lib/files/validate";
import type { CertificateType, ProductCategory } from "@/lib/product/types";
import { recordProductChangeLog, computeProductFieldDiffs } from "@/lib/product/audit";

export type ProductFormState = { error: string } | undefined;

const MAX_IMAGES = 5;

const productSchema = z.object({
  brandId: z.string().uuid("브랜드를 선택해주세요."),
  manufactureSku: z.string().trim().min(1, "제조사 SKU를 입력해주세요."),
  nameEn: z.string().trim().min(1, "영문 제품명을 입력해주세요."),
  category: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.enum([
      "skincare",
      "hair_scalp",
      "beauty_tools",
      "daily_care",
      "wellness_patch",
    ] as const satisfies readonly ProductCategory[]).nullable().optional()
  ),
  priceKrwRetail: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  priceUsdFob: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageWidth: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageDepth: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageHeight: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageWeight: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  upc: z.string().trim().nullable().optional(),
  ean: z.string().trim().nullable().optional(),
});

function extensionFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/csv") return "csv";
  if (mime.includes("spreadsheet")) return "xlsx";
  return "jpg";
}

/**
 * 새 제품을 등록합니다. 필수 정보(브랜드, 제조사 SKU, 영문 제품명, 카테고리, 가격, 패키지)를 입력받아
 * 제품 레코드를 생성한 뒤, 제출 액션 타입에 따라 목록 또는 상세로 이동합니다.
 */
export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const { companyId } = await requireCompanyMembership();
  const submitAction = (formData.get("submitAction") as string) || "continue";
  const isDraft = submitAction === "list";

  const rawBrandId = (formData.get("brandId") as string)?.trim() || "";
  const rawManufactureSku = (formData.get("manufactureSku") as string)?.trim() || "";
  const rawNameEn = (formData.get("nameEn") as string)?.trim() || "";
  const rawCategory = (formData.get("category") as string)?.trim() || null;
  const rawPriceKrwRetail = formData.get("priceKrwRetail");
  const rawPriceUsdFob = formData.get("priceUsdFob");
  const rawPackageWidth = formData.get("packageWidth");
  const rawPackageDepth = formData.get("packageDepth");
  const rawPackageHeight = formData.get("packageHeight");
  const rawPackageWeight = formData.get("packageWeight");
  const upc = (formData.get("upc") as string)?.trim() || null;
  const ean = (formData.get("ean") as string)?.trim() || null;

  const sellingOnline = formData.get("sellingOnline") === "true" || formData.get("sellingOnline") === "on";
  const sellingOffline = formData.get("sellingOffline") === "true" || formData.get("sellingOffline") === "on";
  const salesLink1 = formData.get("salesLink1")?.toString().trim() || null;
  const salesLink2 = formData.get("salesLink2")?.toString().trim() || null;

  const supabase = await createClient();

  if (isDraft) {
    // DRAFT SAVE PATH: Allow required fields & UPC/EAN to be empty
    if (!rawBrandId) {
      return { error: "브랜드를 선택해주세요." };
    }

    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("id", rawBrandId)
      .eq("company_id", companyId)
      .single();

    if (!brand) {
      return { error: "선택한 브랜드를 찾을 수 없습니다." };
    }

    const manufactureSku = rawManufactureSku || `DRAFT-SKU-${Date.now().toString().slice(-6)}`;
    const nameEn = rawNameEn || "[임시저장] 신규 제품";
    const category = (["skincare", "hair_scalp", "beauty_tools", "daily_care", "wellness_patch"].includes(rawCategory || "") ? rawCategory : null) as ProductCategory | null;
    const priceKrwRetail = rawPriceKrwRetail && !isNaN(Number(rawPriceKrwRetail)) ? Number(rawPriceKrwRetail) : null;
    const priceUsdFob = rawPriceUsdFob && !isNaN(Number(rawPriceUsdFob)) ? Number(rawPriceUsdFob) : null;
    const packageWidth = rawPackageWidth && !isNaN(Number(rawPackageWidth)) ? Number(rawPackageWidth) : null;
    const packageDepth = rawPackageDepth && !isNaN(Number(rawPackageDepth)) ? Number(rawPackageDepth) : null;
    const packageHeight = rawPackageHeight && !isNaN(Number(rawPackageHeight)) ? Number(rawPackageHeight) : null;
    const packageWeight = rawPackageWeight && !isNaN(Number(rawPackageWeight)) ? Number(rawPackageWeight) : null;

    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert({
        brand_id: brand.id,
        company_id: companyId,
        name: nameEn,
        name_en: rawNameEn || null,
        category: category,
        manufacture_sku: manufactureSku,
        price_krw_retail: priceKrwRetail,
        price_usd_fob: priceUsdFob,
        package_width: packageWidth,
        package_depth: packageDepth,
        package_height: packageHeight,
        package_weight: packageWeight,
        upc,
        ean,
        selling_online: sellingOnline,
        selling_offline: sellingOffline,
        sales_link_1: salesLink1,
        sales_link_2: salesLink2,
      })
      .select("id")
      .single();

    if (insertError || !product) {
      console.error("Draft product insert error:", insertError);
      return { error: "임시 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
    }

    revalidatePath("/portal/products");
    redirect("/portal/products?saved=draft");
  }

  // FINAL SUBMIT PATH: Full required validation
  const parsed = productSchema.safeParse({
    brandId: rawBrandId,
    manufactureSku: rawManufactureSku,
    nameEn: rawNameEn,
    category: rawCategory,
    priceKrwRetail: rawPriceKrwRetail,
    priceUsdFob: rawPriceUsdFob,
    packageWidth: rawPackageWidth,
    packageDepth: rawPackageDepth,
    packageHeight: rawPackageHeight,
    packageWeight: rawPackageWeight,
    upc,
    ean,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  // UPC / EAN 최소 1개 필수 검증
  if (!upc && !ean) {
    return { error: "UPC 또는 EAN 번호 중 하나는 반드시 입력해야 합니다." };
  }

  if (sellingOnline && !salesLink1) {
    return { error: "온라인 판매 중인 경우, 최소 한 개 이상의 온라인 판매 링크(링크 1)를 입력해 주세요." };
  }

  // 브랜드 소유 확인
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", parsed.data.brandId)
    .eq("company_id", companyId)
    .single();

  if (!brand) {
    return { error: "선택한 브랜드를 찾을 수 없습니다." };
  }

  const { data: product, error: insertError } = await supabase
    .from("products")
    .insert({
      brand_id: brand.id,
      company_id: companyId,
      name: parsed.data.nameEn,
      name_en: parsed.data.nameEn,
      category: parsed.data.category || null,
      manufacture_sku: parsed.data.manufactureSku,
      price_krw_retail: parsed.data.priceKrwRetail ?? null,
      price_usd_fob: parsed.data.priceUsdFob ?? null,
      package_width: parsed.data.packageWidth ?? null,
      package_depth: parsed.data.packageDepth ?? null,
      package_height: parsed.data.packageHeight ?? null,
      package_weight: parsed.data.packageWeight ?? null,
      upc,
      ean,
      selling_online: sellingOnline,
      selling_offline: sellingOffline,
      sales_link_1: salesLink1,
      sales_link_2: salesLink2,
    })
    .select("id")
    .single();

  if (insertError || !product) {
    console.error("Insert product error:", insertError);
    return { error: "제품 등록에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath("/portal/products");
  redirect(`/portal/products/${product.id}`);
}

export interface ImageUploadItemResult {
  fileName: string;
  success: boolean;
  error?: string;
}

export interface ImageUploadResponse {
  success: boolean;
  uploadedCount: number;
  results: ImageUploadItemResult[];
  error?: string;
}

export async function addProductImages(productId: string, formData: FormData): Promise<ImageUploadResponse> {
  try {
    const { companyId } = await requireCompanyMembership();
    const supabase = await createClient();

    const images = formData
      .getAll("images")
      .filter((f): f is File => f instanceof File && f.size > 0);

    if (images.length === 0) {
      return {
        success: false,
        uploadedCount: 0,
        results: [],
        error: "업로드할 이미지가 선택되지 않았습니다.",
      };
    }

    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);

    const currentCount = count ?? 0;
    if (currentCount + images.length > MAX_IMAGES) {
      return {
        success: false,
        uploadedCount: 0,
        results: images.map((img) => ({
          fileName: img.name,
          success: false,
          error: `최대 ${MAX_IMAGES}장 등록 한도를 초과했습니다. (현재 ${currentCount}장 등록됨)`,
        })),
        error: `제품 이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다. (현재 ${currentCount}장 등록됨)`,
      };
    }

    let uploadedCount = 0;
    const results: ImageUploadItemResult[] = [];

    for (const [i, image] of images.entries()) {
      if (image.size > 10 * 1024 * 1024) {
        results.push({
          fileName: image.name,
          success: false,
          error: "파일 크기가 허용 한도(10MB)를 초과했습니다.",
        });
        continue;
      }

      const validation = await validateUploadedFile(image, ["image"]);
      if (!validation.ok) {
        results.push({
          fileName: image.name,
          success: false,
          error: validation.error || "지원하지 않는 파일 형식입니다. (JPG, PNG, WEBP만 가능)",
        });
        continue;
      }

      const path = `${companyId}/products/${productId}/images/${crypto.randomUUID()}.${extensionFor(
        validation.detectedMime
      )}`;

      const { error: uploadError } = await supabase.storage
        .from("company-uploads")
        .upload(path, image, { contentType: validation.detectedMime });

      if (uploadError) {
        console.error("Storage upload error for image:", image.name, uploadError);
        results.push({
          fileName: image.name,
          success: false,
          error: "스토리지 파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.",
        });
        continue;
      }

      const { error: insertError } = await supabase.from("product_images").insert({
        product_id: productId,
        company_id: companyId,
        storage_path: path,
        position: currentCount + uploadedCount,
      });

      if (insertError) {
        console.error("DB insert error for product_images:", insertError);
        results.push({
          fileName: image.name,
          success: false,
          error: "이미지 정보 데이터베이스 등록에 실패했습니다.",
        });
        continue;
      }

      results.push({
        fileName: image.name,
        success: true,
      });
      uploadedCount++;
    }

    if (uploadedCount > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
        const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
        await recordProductChangeLog({
          productId,
          userId: user?.id,
          userName: profile?.display_name || user?.email || "Brand User",
          userEmail: user?.email,
          source: "BRAND_PORTAL",
          companyName: company?.name || "Brand Portal",
          section: "미디어",
          actionType: "CREATE",
          summary: `제품 이미지 ${uploadedCount}장 추가`,
        });
      } catch (e) {}
    }

    revalidatePath(`/portal/products/${productId}`);
    revalidatePath(`/admin/products/${productId}`);

    const allSucceeded = uploadedCount === images.length;
    return {
      success: uploadedCount > 0,
      uploadedCount,
      results,
      error: !allSucceeded
        ? (uploadedCount === 0
            ? "모든 이미지 업로드에 실패했습니다."
            : `${images.length - uploadedCount}개 이미지 업로드에 실패했습니다.`)
        : undefined,
    };
  } catch (err: any) {
    console.error("Unexpected error in addProductImages:", err);
    return {
      success: false,
      uploadedCount: 0,
      results: [],
      error: err.message || "이미지 업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

export async function removeProductImage(productId: string, imageId: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId)
    .eq("company_id", companyId);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "미디어",
      actionType: "DELETE",
      summary: "제품 이미지 삭제",
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

/**
 * 09_알림및문서관리규칙.md 버전 관리 규칙: 같은 종류의 인증서를 다시 올리면 기존
 * 파일을 지우지 않고 새 버전으로 추가한다. 이전 버전도 계속 열람 가능해야 하므로
 * is_current만 내리고 행 자체는 남긴다.
 */
export async function addProductCertificate(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const { companyId } = await requireCompanyMembership();

  const certificateType = formData.get("certificateType");
  const file = formData.get("file");

  if (
    typeof certificateType !== "string" ||
    ![
      "ingredient_certification",
      "trademark",
      "fda_registration",
      "other",
    ].includes(certificateType)
  ) {
    return { error: "인증서 종류를 선택해주세요." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "파일을 선택해주세요." };
  }

  const validation = await validateUploadedFile(file, ["document", "image"]);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const supabase = await createClient();

  const { data: previous } = await supabase
    .from("product_certificates")
    .select("version")
    .eq("product_id", productId)
    .eq("certificate_type", certificateType)
    .eq("is_current", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (previous?.version ?? 0) + 1;
  const path = `${companyId}/products/${productId}/certificates/${crypto.randomUUID()}.${extensionFor(
    validation.detectedMime
  )}`;

  const { error: uploadError } = await supabase.storage
    .from("company-uploads")
    .upload(path, file, { contentType: validation.detectedMime });

  if (uploadError) {
    return { error: "파일 업로드에 실패했습니다." };
  }

  await supabase
    .from("product_certificates")
    .update({ is_current: false })
    .eq("product_id", productId)
    .eq("certificate_type", certificateType)
    .eq("is_current", true);

  await supabase.from("product_certificates").insert({
    product_id: productId,
    company_id: companyId,
    certificate_type: certificateType as CertificateType,
    storage_path: path,
    original_filename: file.name,
    version: nextVersion,
    is_current: true,
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "인허가 & 보증서",
      actionType: "CREATE",
      summary: `인허가/보증서 (${certificateType}) 업로드 (v${nextVersion})`,
      changes: {
        certificate_type: { label: "인증서 종류", before: null, after: certificateType },
        version: { label: "버전", before: null, after: `v${nextVersion}` },
        filename: { label: "파일명", before: null, after: file.name },
      },
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

const productUpdateSchema = z.object({
  name: z.string().trim().min(1, "제품명을 입력해주세요."),
  nameEn: z.string().trim().nullable().optional(),
  category: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.enum([
      "skincare",
      "hair_scalp",
      "beauty_tools",
      "daily_care",
      "wellness_patch",
    ] as const satisfies readonly ProductCategory[]).nullable().optional()
  ),
  volume: z.string().trim().nullable().optional(),
  estimatedRetailPrice: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  ingredientsText: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  colorMap: z.string().trim().nullable().optional(),
  origin: z.string().trim().nullable().optional(),
  leadTime: z.string().trim().nullable().optional(),

  // SKU
  parentSku: z.string().trim().nullable().optional(),
  childSku: z.string().trim().nullable().optional(),
  manufactureSku: z.string().trim().nullable().optional(),
  letustoSku: z.string().trim().nullable().optional(),
  upc: z.string().trim().nullable().optional(),
  ean: z.string().trim().nullable().optional(),
  sellingOnline: z.boolean().optional(),
  sellingOffline: z.boolean().optional(),
  salesLink1: z.string().trim().nullable().optional(),
  salesLink2: z.string().trim().nullable().optional(),

  // Prices
  priceKrwRetail: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  priceKrwWholesale: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  priceUsdFob: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? Number(v) : null)),

  // Logistics
  itemWidth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  itemDepth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  itemHeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  itemWeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),

  packageWidth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  packageDepth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  packageHeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  packageWeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),

  cartonPackQty: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  cartonWidth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  cartonDepth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  cartonHeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  cartonWeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  cartonCbm: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),

  paletteCartonQty: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  paletteWidth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  paletteDepth: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  paletteHeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  paletteWeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),

  container20ftQty: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  container20ftWeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  container20ftCbm: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),

  container40ftQty: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  container40ftWeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  container40ftCbm: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),

  container40fthcQty: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  container40fthcWeight: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
  container40fthcCbm: z.string().trim().nullable().optional().transform((v) => (v ? Number(v) : null)),
});

export async function updateProduct(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const bulletPoints = formData
    .getAll("bulletPoints")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  const rawData = {
    name: formData.get("name"),
    nameEn: formData.get("nameEn") || null,
    category: formData.get("category"),
    volume: formData.get("volume") || null,
    estimatedRetailPrice: formData.get("estimatedRetailPrice") || null,
    ingredientsText: formData.get("ingredientsText") || null,
    description: formData.get("description") || null,
    color: formData.get("color") || null,
    colorMap: formData.get("colorMap") || null,
    origin: formData.get("origin") || null,
    leadTime: formData.get("leadTime") || null,

    parentSku: formData.get("parentSku") || null,
    childSku: formData.get("childSku") || null,
    manufactureSku: formData.get("manufactureSku") || null,
    letustoSku: formData.get("letustoSku") || null,
    upc: formData.get("upc") || null,
    ean: formData.get("ean") || null,
    sellingOnline: formData.get("sellingOnline") === "true" || formData.get("sellingOnline") === "on",
    sellingOffline: formData.get("sellingOffline") === "true" || formData.get("sellingOffline") === "on",
    salesLink1: formData.get("salesLink1") || null,
    salesLink2: formData.get("salesLink2") || null,

    priceKrwRetail: formData.get("priceKrwRetail") || null,
    priceKrwWholesale: formData.get("priceKrwWholesale") || null,
    priceUsdFob: formData.get("priceUsdFob") || null,

    itemWidth: formData.get("itemWidth") || null,
    itemDepth: formData.get("itemDepth") || null,
    itemHeight: formData.get("itemHeight") || null,
    itemWeight: formData.get("itemWeight") || null,

    packageWidth: formData.get("packageWidth") || null,
    packageDepth: formData.get("packageDepth") || null,
    packageHeight: formData.get("packageHeight") || null,
    packageWeight: formData.get("packageWeight") || null,

    cartonPackQty: formData.get("cartonPackQty") || null,
    cartonWidth: formData.get("cartonWidth") || null,
    cartonDepth: formData.get("cartonDepth") || null,
    cartonHeight: formData.get("cartonHeight") || null,
    cartonWeight: formData.get("cartonWeight") || null,
    cartonCbm: formData.get("cartonCbm") || null,

    paletteCartonQty: formData.get("paletteCartonQty") || null,
    paletteWidth: formData.get("paletteWidth") || null,
    paletteDepth: formData.get("paletteDepth") || null,
    paletteHeight: formData.get("paletteHeight") || null,
    paletteWeight: formData.get("paletteWeight") || null,

    container20ftQty: formData.get("container20ftQty") || null,
    container20ftWeight: formData.get("container20ftWeight") || null,
    container20ftCbm: formData.get("container20ftCbm") || null,

    container40ftQty: formData.get("container40ftQty") || null,
    container40ftWeight: formData.get("container40ftWeight") || null,
    container40ftCbm: formData.get("container40ftCbm") || null,

    container40fthcQty: formData.get("container40fthcQty") || null,
    container40fthcWeight: formData.get("container40fthcWeight") || null,
    container40fthcCbm: formData.get("container40fthcCbm") || null,
  };

  const parsed = productUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  // UPC / EAN 최소 1개 필수 검증
  const upc = parsed.data.upc || null;
  const ean = parsed.data.ean || null;

  if (!upc && !ean) {
    return { error: "UPC 또는 EAN 번호 중 하나는 반드시 입력해야 합니다." };
  }

  if (parsed.data.sellingOnline && !parsed.data.salesLink1) {
    return { error: "온라인 판매 중인 경우, 최소 한 개 이상의 온라인 판매 링크(링크 1)를 입력해 주세요." };
  }

  // 1. Fetch current product state before updating for audit diff calculation
  const { data: beforeProduct } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("company_id", companyId)
    .single();

  // Parse and sanitize tiered pricing
  const rawPriceTiers = formData.get("priceTiers");
  let parsedPriceTiers: { qty: number; price: number }[] = [];
  if (rawPriceTiers && typeof rawPriceTiers === "string") {
    try {
      const parsedJson = JSON.parse(rawPriceTiers);
      if (Array.isArray(parsedJson)) {
        parsedPriceTiers = parsedJson
          .map((item: any) => ({
            qty: Number(item.qty || item.minimum_order_quantity || item.moq || 0),
            price: Number(item.price || item.unit_price || item.supply_price || 0),
          }))
          .filter((item) => item.qty > 0 && item.price > 0);
      }
    } catch (e) {
      console.error("Failed to parse priceTiers:", e);
    }
  }

  const existingMeta = (beforeProduct?.price_additional_info as Record<string, any>) || {};
  const updatedPriceAdditionalInfo = {
    ...existingMeta,
    price_tiers: parsedPriceTiers,
    tiered_prices: parsedPriceTiers,
    container_40ft_qty: parsed.data.container40ftQty,
    container_40ft_weight: parsed.data.container40ftWeight,
    container_40ft_cbm: parsed.data.container40ftCbm,
  };

  const effectiveLetustoSku = parsed.data.letustoSku && parsed.data.letustoSku.trim() !== ""
    ? parsed.data.letustoSku.trim()
    : beforeProduct?.letusto_sku || null;

  const { error: updateError } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      name_en: parsed.data.nameEn || null,
      category: parsed.data.category,
      volume: parsed.data.volume || null,
      estimated_retail_price: parsed.data.estimatedRetailPrice,
      ingredients_text: parsed.data.ingredientsText || null,
      description: parsed.data.description || null,
      bullet_points: bulletPoints,
      color: parsed.data.color || null,
      color_map: parsed.data.colorMap || null,
      origin: parsed.data.origin || null,
      lead_time: parsed.data.leadTime || null,

      parent_sku: parsed.data.parentSku || null,
      child_sku: parsed.data.childSku || null,
      manufacture_sku: parsed.data.manufactureSku || null,
      letusto_sku: effectiveLetustoSku,
      upc: upc,
      ean: ean,
      selling_online: !!parsed.data.sellingOnline,
      selling_offline: !!parsed.data.sellingOffline,
      sales_link_1: parsed.data.salesLink1 || null,
      sales_link_2: parsed.data.salesLink2 || null,

      price_krw_retail: parsed.data.priceKrwRetail,
      price_krw_wholesale: parsed.data.priceKrwWholesale,
      price_usd_fob: parsed.data.priceUsdFob,
      price_additional_info: updatedPriceAdditionalInfo,

      item_width: parsed.data.itemWidth,
      item_depth: parsed.data.itemDepth,
      item_height: parsed.data.itemHeight,
      item_weight: parsed.data.itemWeight,

      package_width: parsed.data.packageWidth,
      package_depth: parsed.data.packageDepth,
      package_height: parsed.data.packageHeight,
      package_weight: parsed.data.packageWeight,

      carton_pack_qty: parsed.data.cartonPackQty,
      carton_width: parsed.data.cartonWidth,
      carton_depth: parsed.data.cartonDepth,
      carton_height: parsed.data.cartonHeight,
      carton_weight: parsed.data.cartonWeight,
      carton_cbm: parsed.data.cartonCbm,

      palette_carton_qty: parsed.data.paletteCartonQty,
      palette_width: parsed.data.paletteWidth,
      palette_depth: parsed.data.paletteDepth,
      palette_height: parsed.data.paletteHeight,
      palette_weight: parsed.data.paletteWeight,

      container_20ft_qty: parsed.data.container20ftQty,
      container_20ft_weight: parsed.data.container20ftWeight,
      container_20ft_cbm: parsed.data.container20ftCbm,

      container_40fthc_qty: parsed.data.container40fthcQty,
      container_40fthc_weight: parsed.data.container40fthcWeight,
      container_40fthc_cbm: parsed.data.container40fthcCbm,

      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("company_id", companyId);

  if (updateError) {
    console.error("Product update error:", updateError);
    return { error: "제품 정보 수정에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath(`/portal/products/${productId}`);
  revalidatePath("/portal/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");

  // 2. Calculate field diffs
  if (beforeProduct) {
    const afterObj: Record<string, any> = {
      ...rawData,
      bullet_points: bulletPoints,
      upc,
      ean,
    };
    const { diffs, sectionNames } = computeProductFieldDiffs(beforeProduct, afterObj);

    // Only record change log if there are actual diffs (Requirement TEST F)
    if (Object.keys(diffs).length > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let userName = "Brand User";
        let companyName = "Brand Portal";

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.display_name) userName = profile.display_name;

          const { data: company } = await supabase
            .from("companies")
            .select("name")
            .eq("id", companyId)
            .maybeSingle();
          if (company?.name) companyName = company.name;

          const changedFieldLabels = Object.values(diffs).map((d) => d.label);
          const summary = `포털 상품 정보 수정 (${changedFieldLabels.slice(0, 3).join(", ")}${
            changedFieldLabels.length > 3 ? ` 외 ${changedFieldLabels.length - 3}개` : ""
          })`;

          await recordProductChangeLog({
            productId,
            userId: user.id,
            userName,
            userEmail: user.email,
            source: "BRAND_PORTAL",
            companyName,
            section: Array.from(sectionNames).join(", ") || "기본 정보",
            actionType: "UPDATE",
            summary,
            changes: diffs,
          });
        }
      } catch (logErr) {
        console.warn("⚠️ Portal audit log error:", logErr);
      }
    }
  }

  revalidatePath(`/portal/products/${productId}`);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
}

export async function addProductVideoUrl(productId: string, videoUrl: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  if (!videoUrl || !videoUrl.trim()) {
    throw new Error("올바른 동영상 URL을 입력해주세요.");
  }

  await supabase.from("product_videos").insert({
    product_id: productId,
    company_id: companyId,
    video_url: videoUrl.trim(),
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "미디어",
      actionType: "CREATE",
      summary: `제품 동영상 링크 등록 (${videoUrl.trim()})`,
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

export async function addProductVideoFile(productId: string, formData: FormData) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const file = formData.get("videoFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("동영상 파일을 선택해주세요.");
  }

  if (file.size > 50 * 1024 * 1024) {
    throw new Error("동영상 파일 용량은 50MB를 초과할 수 없습니다.");
  }
  if (!file.type.startsWith("video/")) {
    throw new Error("동영상 파일 형식만 업로드 가능합니다.");
  }

  const path = `${companyId}/products/${productId}/videos/${crypto.randomUUID()}.${extensionFor(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from("company-uploads")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    throw new Error("동영상 파일 업로드에 실패했습니다.");
  }

  await supabase.from("product_videos").insert({
    product_id: productId,
    company_id: companyId,
    storage_path: path,
  });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "미디어",
      actionType: "CREATE",
      summary: `제품 동영상 파일 업로드 (${file.name})`,
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

export async function removeProductVideo(productId: string, videoId: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("product_videos")
    .select("storage_path")
    .eq("id", videoId)
    .eq("product_id", productId)
    .eq("company_id", companyId)
    .single();

  if (video?.storage_path) {
    await supabase.storage.from("company-uploads").remove([video.storage_path]);
  }

  await supabase
    .from("product_videos")
    .delete()
    .eq("id", videoId)
    .eq("product_id", productId)
    .eq("company_id", companyId);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "미디어",
      actionType: "DELETE",
      summary: "제품 동영상 삭제",
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

export async function uploadIngredientsFile(productId: string, language: "ko" | "en", formData: FormData) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const file = formData.get("ingredientsFile");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("파일을 선택해주세요.");
  }

  const validation = await validateUploadedFile(file, ["document", "image"]);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const columnName = language === "en" ? "ingredients_file_path_en" : "ingredients_file_path";

  // 기존 파일 조회 및 삭제
  const { data: product } = await supabase
    .from("products")
    .select(columnName)
    .eq("id", productId)
    .eq("company_id", companyId)
    .single();

  const oldPath = product ? (product as any)[columnName] : null;

  if (oldPath) {
    try {
      await supabase.storage.from("company-uploads").remove([oldPath]);
    } catch (e) {
      console.error("Failed to remove old file:", e);
    }
  }

  const path = `${companyId}/products/${productId}/ingredients/${language}_${crypto.randomUUID()}.${extensionFor(
    validation.detectedMime
  )}`;

  const { error: uploadError } = await supabase.storage
    .from("company-uploads")
    .upload(path, file, { contentType: validation.detectedMime });

  if (uploadError) {
    throw new Error("파일 업로드에 실패했습니다.");
  }

  await supabase
    .from("products")
    .update({ [columnName]: path })
    .eq("id", productId)
    .eq("company_id", companyId);

  // Synchronize to product_certificates for "ingredient_certification"
  if (language === "ko") {
    const { data: previous } = await supabase
      .from("product_certificates")
      .select("version")
      .eq("product_id", productId)
      .eq("certificate_type", "ingredient_certification")
      .eq("is_current", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (previous?.version ?? 0) + 1;

    await supabase
      .from("product_certificates")
      .update({ is_current: false })
      .eq("product_id", productId)
      .eq("certificate_type", "ingredient_certification")
      .eq("is_current", true);

    await supabase.from("product_certificates").insert({
      product_id: productId,
      company_id: companyId,
      certificate_type: "ingredient_certification",
      storage_path: path,
      original_filename: file.name,
      version: nextVersion,
      is_current: true,
    });
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "인허가 & 보증서",
      actionType: "CREATE",
      summary: `${language === "ko" ? "국문" : "영문"} 전성분표 파일 업로드 (${file.name})`,
      changes: {
        [columnName]: {
          label: language === "ko" ? "국문 전성분표 파일" : "영문 전성분표 파일",
          before: oldPath ? "이전 파일" : null,
          after: file.name,
        },
      },
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

export async function deleteIngredientsFile(productId: string, language: "ko" | "en") {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const columnName = language === "en" ? "ingredients_file_path_en" : "ingredients_file_path";

  const { data: product } = await supabase
    .from("products")
    .select(columnName)
    .eq("id", productId)
    .eq("company_id", companyId)
    .single();

  const oldPath = product ? (product as any)[columnName] : null;

  if (oldPath) {
    try {
      await supabase.storage.from("company-uploads").remove([oldPath]);
    } catch (e) {
      console.error("Failed to remove old file:", e);
    }
  }

  await supabase
    .from("products")
    .update({ [columnName]: null })
    .eq("id", productId)
    .eq("company_id", companyId);

  // Synchronize to product_certificates for "ingredient_certification"
  if (language === "ko") {
    await supabase
      .from("product_certificates")
      .update({ is_current: false })
      .eq("product_id", productId)
      .eq("certificate_type", "ingredient_certification")
      .eq("is_current", true);
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "인허가 & 보증서",
      actionType: "DELETE",
      summary: `${language === "ko" ? "국문" : "영문"} 전성분표 파일 삭제`,
      changes: {
        [columnName]: {
          label: language === "ko" ? "국문 전성분표 파일" : "영문 전성분표 파일",
          before: "기존 파일",
          after: null,
        },
      },
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

export async function updateProductImagesOrder(productId: string, imageIdsInOrder: string[]) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { data: currentImages } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", productId)
    .eq("company_id", companyId);

  const currentIds = new Set((currentImages ?? []).map((img) => img.id));
  if (currentIds.size !== imageIdsInOrder.length || !imageIdsInOrder.every(id => currentIds.has(id))) {
    throw new Error("올바르지 않은 이미지 목록입니다.");
  }

  for (let index = 0; index < imageIdsInOrder.length; index++) {
    const id = imageIdsInOrder[index];
    const { error } = await supabase
      .from("product_images")
      .update({ position: index })
      .eq("id", id)
      .eq("product_id", productId)
      .eq("company_id", companyId);

    if (error) {
      console.error("Failed to update image position:", error);
      throw new Error(`이미지 순서 저장 실패: ${error.message}`);
    }
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
    const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
    await recordProductChangeLog({
      productId,
      userId: user?.id,
      userName: profile?.display_name || user?.email || "Brand User",
      userEmail: user?.email,
      source: "BRAND_PORTAL",
      companyName: company?.name || "Brand Portal",
      section: "미디어",
      actionType: "UPDATE",
      summary: "제품 이미지 노출 순서 변경",
    });
  } catch (e) {}

  revalidatePath(`/portal/products/${productId}`);
}

/**
 * 제품을 소프트 삭제(Soft Delete)합니다.
 * 회사 권한 검증, 이미 삭제 여부 검증, 이중 지속성(Dual Persistence) 및 감사 로그를 보장합니다.
 */
export async function deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { companyId } = await requireCompanyMembership();
    const supabase = await createClient();

    // 1. 제품 조회 (존재 여부 및 소속 회사 검증 분리)
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("id, name, name_en, manufacture_sku, letusto_sku, company_id, selection_status, sales_status, price_additional_info")
      .eq("id", productId)
      .maybeSingle();

    if (fetchError || !product) {
      console.warn(`[deleteProduct] Product not found: ${productId}`, fetchError);
      return { success: false, error: "제품을 찾을 수 없습니다." };
    }

    if (product.company_id !== companyId) {
      console.warn(`[deleteProduct] Unauthorized delete attempt by company ${companyId} on product ${productId} (owned by ${product.company_id})`);
      return { success: false, error: "이 제품을 삭제할 권한이 없습니다." };
    }

    // 2. 이미 삭제된 상태인지 검증
    const currentMeta = (product.price_additional_info as any) || {};
    const isAlreadyDeleted = Boolean((product as any).deleted_at || currentMeta.deleted_at);
    if (isAlreadyDeleted) {
      return { success: false, error: "이미 삭제된 제품입니다." };
    }

    const now = new Date().toISOString();
    const updatedPriceInfo = {
      ...currentMeta,
      deleted_at: now,
    };

    // 3. 이중 지속성(Dual Persistence) 업데이트
    // 시도 1: deleted_at 컬럼과 상태 업데이트
    let updateSuccess = false;
    try {
      const { error: colUpdateError } = await supabase
        .from("products")
        .update({
          deleted_at: now,
          selection_status: "NOT_SELECTED",
          sales_status: "ENDED",
          price_additional_info: updatedPriceInfo,
        })
        .eq("id", productId)
        .eq("company_id", companyId);

      if (!colUpdateError) {
        updateSuccess = true;
      } else {
        console.warn("[deleteProduct] Column update attempt with deleted_at failed:", colUpdateError.message);
      }
    } catch (e: any) {
      console.warn("[deleteProduct] Exception in deleted_at column update:", e?.message);
    }

    // 시도 2: 만약 deleted_at 컬럼 미존재 시 fallback 지속성 업데이트
    if (!updateSuccess) {
      const { error: fallbackError } = await supabase
        .from("products")
        .update({
          selection_status: "NOT_SELECTED",
          sales_status: "ENDED",
          price_additional_info: updatedPriceInfo,
        })
        .eq("id", productId)
        .eq("company_id", companyId);

      if (fallbackError) {
        console.error("[deleteProduct] Fallback soft-delete update failed:", fallbackError);
        return { success: false, error: "제품을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요." };
      }
    }

    // 4. 감사 이력(Audit Change Log) 기록
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle() : { data: null };
      const { data: company } = await supabase.from("companies").select("name").eq("id", companyId).maybeSingle();
      await recordProductChangeLog({
        productId,
        userId: user?.id,
        userName: profile?.display_name || user?.email || "Brand User",
        userEmail: user?.email,
        source: "BRAND_PORTAL",
        companyName: company?.name || "Brand Portal",
        section: "삭제/복구",
        actionType: "DELETE",
        summary: `브랜드사 상품 삭제 (Soft Delete) - SKU: ${product.letusto_sku || product.manufacture_sku || "N/A"}`,
        changes: {
          deleted_at: {
            label: "삭제 일시",
            before: null,
            after: now,
          },
          selection_status: {
            label: "선정 상태",
            before: product.selection_status || "UNREVIEWED",
            after: "NOT_SELECTED",
          },
          sales_status: {
            label: "판매 상태",
            before: product.sales_status || "PREPARING",
            after: "ENDED",
          },
        },
      });
    } catch (logErr) {
      console.warn("[deleteProduct] Change log recording warning:", logErr);
    }

    // 5. 캐시 무효화 (Portal & Admin 동시 갱신)
    revalidatePath("/portal/products");
    revalidatePath(`/portal/products/${productId}`);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    return { success: true };
  } catch (err: any) {
    console.error("[deleteProduct] Unexpected exception:", err);
    return { success: false, error: "제품을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }
}
