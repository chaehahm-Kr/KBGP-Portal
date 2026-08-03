"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUploadedFile } from "@/lib/files/validate";
import type { CertificateType, ProductCategory } from "@/lib/product/types";

export type ProductFormState = { error: string } | undefined;

const MAX_IMAGES = 5;

const productSchema = z.object({
  brandId: z.string().uuid("브랜드를 선택해주세요."),
  manufactureSku: z.string().trim().min(1, "제조사 SKU를 입력해주세요."),
  nameEn: z.string().trim().min(1, "영문 제품명을 입력해주세요."),
  category: z.enum([
    "skincare",
    "hair_scalp",
    "beauty_tools",
    "daily_care",
    "wellness_patch",
  ] as const satisfies readonly ProductCategory[]),
  priceKrwRetail: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  priceUsdFob: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageWidth: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageDepth: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageHeight: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
  packageWeight: z.preprocess((val) => (val === "" || val === null ? undefined : val), z.coerce.number().min(0).optional()),
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

  const parsed = productSchema.safeParse({
    brandId: formData.get("brandId"),
    manufactureSku: formData.get("manufactureSku"),
    nameEn: formData.get("nameEn"),
    category: formData.get("category"),
    priceKrwRetail: formData.get("priceKrwRetail"),
    priceUsdFob: formData.get("priceUsdFob"),
    packageWidth: formData.get("packageWidth"),
    packageDepth: formData.get("packageDepth"),
    packageHeight: formData.get("packageHeight"),
    packageWeight: formData.get("packageWeight"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const supabase = await createClient();

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
      category: parsed.data.category,
      manufacture_sku: parsed.data.manufactureSku,
      price_krw_retail: parsed.data.priceKrwRetail ?? null,
      price_usd_fob: parsed.data.priceUsdFob ?? null,
      package_width: parsed.data.packageWidth ?? null,
      package_depth: parsed.data.packageDepth ?? null,
      package_height: parsed.data.packageHeight ?? null,
      package_weight: parsed.data.packageWeight ?? null,
    })
    .select("id")
    .single();

  if (insertError || !product) {
    console.error("Insert product error:", insertError);
    return { error: "제품 등록에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath("/portal/products");
  
  const submitAction = formData.get("submitAction") || "continue";
  if (submitAction === "list") {
    redirect("/portal/products");
  } else {
    redirect(`/portal/products/${product.id}`);
  }
}

export async function addProductImages(productId: string, formData: FormData) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const images = formData
    .getAll("images")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  if ((count ?? 0) + images.length > MAX_IMAGES) {
    throw new Error(`제품 이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
  }

  for (const [i, image] of images.entries()) {
    const validation = await validateUploadedFile(image, ["image"]);
    if (!validation.ok) continue;
    const path = `${companyId}/products/${productId}/images/${crypto.randomUUID()}.${extensionFor(
      validation.detectedMime
    )}`;
    const { error: uploadError } = await supabase.storage
      .from("company-uploads")
      .upload(path, image, { contentType: validation.detectedMime });
    if (!uploadError) {
      await supabase.from("product_images").insert({
        product_id: productId,
        company_id: companyId,
        storage_path: path,
        position: (count ?? 0) + i,
      });
    }
  }

  revalidatePath(`/portal/products/${productId}`);
}

export async function removeProductImage(productId: string, imageId: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  if ((count ?? 0) <= 1) {
    throw new Error("제품 이미지는 최소 1장이 있어야 합니다.");
  }

  await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .eq("product_id", productId)
    .eq("company_id", companyId);

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

  revalidatePath(`/portal/products/${productId}`);
}

const productUpdateSchema = z.object({
  name: z.string().trim().min(1, "제품명을 입력해주세요."),
  nameEn: z.string().trim().nullable().optional(),
  category: z.enum([
    "skincare",
    "hair_scalp",
    "beauty_tools",
    "daily_care",
    "wellness_patch",
  ] as const satisfies readonly ProductCategory[]),
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

    container40fthcQty: formData.get("container40fthcQty") || null,
    container40fthcWeight: formData.get("container40fthcWeight") || null,
    container40fthcCbm: formData.get("container40fthcCbm") || null,
  };

  const parsed = productUpdateSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

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
      letusto_sku: parsed.data.letustoSku || null,

      price_krw_retail: parsed.data.priceKrwRetail,
      price_krw_wholesale: parsed.data.priceKrwWholesale,
      price_usd_fob: parsed.data.priceUsdFob,

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

  const adminSupabase = createAdminClient();
  for (let index = 0; index < imageIdsInOrder.length; index++) {
    const id = imageIdsInOrder[index];
    const { error } = await adminSupabase
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

  revalidatePath(`/portal/products/${productId}`);
}

/**
 * 제품을 소프트 삭제(deleted_at 설정)합니다.
 */
export async function deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { companyId } = await requireCompanyMembership();
    const supabase = await createClient();

    // 제품이 해당 회사 소유인지 확인
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("company_id", companyId)
      .single();

    if (!product) {
      return { success: false, error: "제품을 찾을 수 없거나 삭제 권한이 없습니다." };
    }

    const { error: deleteError } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("company_id", companyId);

    if (deleteError) {
      console.error("Delete product error:", deleteError);
      return { success: false, error: "제품 삭제 중 오류가 발생했습니다." };
    }

    revalidatePath("/portal/products");
    revalidatePath(`/portal/products/${productId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "오류가 발생했습니다." };
  }
}
