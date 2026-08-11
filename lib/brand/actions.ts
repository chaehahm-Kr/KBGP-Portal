"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCompanyMembership } from "@/lib/company/dal";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUploadedFile } from "@/lib/files/validate";

export type BrandFormState = { error: string } | undefined;

const brandSchema = z.object({
  name: z.string().trim().min(1, "브랜드명을 입력해주세요."),
  intro: z.string().trim().optional(),
});

export interface BrandTrademarks {
  has_kr_trademark: boolean;
  kr_trademark_number: string | null;
  kr_trademark_path: string | null;
  has_us_trademark: boolean;
  us_trademark_number: string | null;
  us_trademark_path: string | null;
  intro_text: string | null;
}

export async function parseBrandTrademarks(brand: any): Promise<BrandTrademarks> {
  // If database columns exist and are loaded
  if (brand.has_kr_trademark !== undefined && brand.has_kr_trademark !== null) {
    return {
      has_kr_trademark: brand.has_kr_trademark,
      kr_trademark_number: brand.kr_trademark_number || null,
      kr_trademark_path: brand.kr_trademark_path || null,
      has_us_trademark: brand.has_us_trademark,
      us_trademark_number: brand.us_trademark_number || null,
      us_trademark_path: brand.us_trademark_path || null,
      intro_text: brand.intro || null
    };
  }

  // Fallback to parsing from intro JSON string
  const intro = brand.intro || "";
  if (intro.startsWith("__JSON_METADATA__:")) {
    try {
      const jsonStr = intro.substring("__JSON_METADATA__:".length);
      const data = JSON.parse(jsonStr);
      return {
        has_kr_trademark: !!data.trademarks?.has_kr_trademark,
        kr_trademark_number: data.trademarks?.kr_trademark_number || null,
        kr_trademark_path: data.trademarks?.kr_trademark_path || null,
        has_us_trademark: !!data.trademarks?.has_us_trademark,
        us_trademark_number: data.trademarks?.us_trademark_number || null,
        us_trademark_path: data.trademarks?.us_trademark_path || null,
        intro_text: data.description || null
      };
    } catch (e) {
      // Ignore and fallback
    }
  }

  // Default fallback
  return {
    has_kr_trademark: false,
    kr_trademark_number: null,
    kr_trademark_path: null,
    has_us_trademark: false,
    us_trademark_number: null,
    us_trademark_path: null,
    intro_text: brand.intro || null
  };
}

async function uploadLogoIfProvided(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  brandId: string,
  formData: FormData
): Promise<{ path?: string; error?: string }> {
  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size === 0) {
    return {};
  }

  const validation = await validateUploadedFile(logo, ["image"]);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const ext = validation.detectedMime === "image/png" ? "png" : validation.detectedMime === "image/webp" ? "webp" : "jpg";
  const path = `${companyId}/brands/${brandId}/logo/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("company-uploads")
    .upload(path, logo, { contentType: validation.detectedMime, upsert: false });

  if (error) {
    return { error: "로고 이미지를 업로드하지 못했습니다." };
  }

  return { path };
}

async function uploadTrademarkFileIfProvided(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  brandId: string,
  fieldKey: string,
  storageName: string,
  formData: FormData
): Promise<{ path?: string; error?: string }> {
  const file = formData.get(fieldKey);
  if (!(file instanceof File) || file.size === 0) {
    return {};
  }

  // Allow both image and application/pdf/document types
  const validation = await validateUploadedFile(file, ["image", "document"]);
  if (!validation.ok) {
    return { error: `${storageName === "kr_trademark" ? "대한민국" : "미국"} 상표권 증빙: ${validation.error}` };
  }

  let ext = "pdf";
  if (validation.detectedMime.startsWith("image/")) {
    ext = validation.detectedMime === "image/png" ? "png" : validation.detectedMime === "image/webp" ? "webp" : "jpg";
  }
  const path = `${companyId}/brands/${brandId}/trademarks/${storageName}_${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("company-uploads")
    .upload(path, file, { contentType: validation.detectedMime, upsert: false });

  if (error) {
    return { error: `${storageName === "kr_trademark" ? "대한민국" : "미국"} 상표권 증빙 파일 업로드 실패` };
  }

  return { path };
}

/**
 * 08_주요화면과AC.md 화면 6(브랜드 등록·수정).
 * "브랜드명은 같은 회사 내에서 중복될 수 없다"는 규칙은 0003 마이그레이션의 부분
 * 유니크 인덱스(brands_company_name_active_unique)가 데이터베이스 차원에서 강제한다.
 */
export async function createBrand(
  _prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  const { companyId } = await requireCompanyMembership();

  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    intro: formData.get("intro"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const hasKrTrademark = formData.get("hasKrTrademark") === "true";
  const krTrademarkNumber = hasKrTrademark ? (formData.get("krTrademarkNumber") as string)?.trim() || null : null;
  const hasUsTrademark = formData.get("hasUsTrademark") === "true";
  const usTrademarkNumber = hasUsTrademark ? (formData.get("usTrademarkNumber") as string)?.trim() || null : null;

  const supabase = await createClient();

  const insertPayload: Record<string, any> = {
    company_id: companyId,
    name: parsed.data.name,
    intro: parsed.data.intro || null,
    has_kr_trademark: hasKrTrademark,
    kr_trademark_number: krTrademarkNumber,
    has_us_trademark: hasUsTrademark,
    us_trademark_number: usTrademarkNumber,
  };

  let brand: { id: string } | null = null;
  let insertError: any = null;

  // Attempt database columns insert
  const { data, error } = await supabase
    .from("brands")
    .insert(insertPayload)
    .select("id")
    .single();

  brand = data;
  insertError = error;

  // Fallback to JSON serialization in 'intro' if columns don't exist yet (42703 or PGRST204)
  if (insertError && (insertError.code === "42703" || insertError.code === "PGRST204")) {
    const fallbackIntroObj = {
      description: parsed.data.intro || "",
      trademarks: {
        has_kr_trademark: hasKrTrademark,
        kr_trademark_number: krTrademarkNumber,
        kr_trademark_path: null,
        has_us_trademark: hasUsTrademark,
        us_trademark_number: usTrademarkNumber,
        us_trademark_path: null,
      }
    };
    const fallbackIntroString = `__JSON_METADATA__:${JSON.stringify(fallbackIntroObj)}`;

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("brands")
      .insert({
        company_id: companyId,
        name: parsed.data.name,
        intro: fallbackIntroString
      })
      .select("id")
      .single();

    brand = fallbackData;
    insertError = fallbackError;
  }

  if (insertError || !brand) {
    console.error("createBrand query error:", insertError);
    if (insertError?.code === "23505") {
      return { error: "이미 같은 이름의 브랜드가 등록되어 있습니다." };
    }
    return { error: "브랜드 등록에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  // Upload logo
  const { path: logoPath, error: logoError } = await uploadLogoIfProvided(
    supabase,
    companyId,
    brand.id,
    formData
  );
  if (logoError) {
    return { error: logoError };
  }

  // Upload trademark files
  let krTrademarkPath: string | null = null;
  if (hasKrTrademark) {
    const fileRes = await uploadTrademarkFileIfProvided(supabase, companyId, brand.id, "krTrademarkFile", "kr_trademark", formData);
    if (fileRes.error) return { error: fileRes.error };
    if (fileRes.path) krTrademarkPath = fileRes.path;
  }

  let usTrademarkPath: string | null = null;
  if (hasUsTrademark) {
    const fileRes = await uploadTrademarkFileIfProvided(supabase, companyId, brand.id, "usTrademarkFile", "us_trademark", formData);
    if (fileRes.error) return { error: fileRes.error };
    if (fileRes.path) usTrademarkPath = fileRes.path;
  }

  // Apply uploaded paths to DB columns or JSON in 'intro'
  const finalUpdatePayload: Record<string, any> = {
    ...(logoPath ? { logo_path: logoPath } : {}),
  };

  const trademarkPaths = {
    has_kr_trademark: hasKrTrademark,
    kr_trademark_number: krTrademarkNumber,
    has_us_trademark: hasUsTrademark,
    us_trademark_number: usTrademarkNumber,
    ...(krTrademarkPath ? { kr_trademark_path: krTrademarkPath } : {}),
    ...(usTrademarkPath ? { us_trademark_path: usTrademarkPath } : {}),
  };

  const { error: finalUpdateError } = await supabase
    .from("brands")
    .update({ ...finalUpdatePayload, ...trademarkPaths })
    .eq("id", brand.id);

  // If path update fails due to columns not existing, update via intro JSON
  if (finalUpdateError && (finalUpdateError.code === "42703" || finalUpdateError.code === "PGRST204")) {
    const fallbackIntroObj = {
      description: parsed.data.intro || "",
      trademarks: {
        has_kr_trademark: hasKrTrademark,
        kr_trademark_number: krTrademarkNumber,
        kr_trademark_path: krTrademarkPath,
        has_us_trademark: hasUsTrademark,
        us_trademark_number: usTrademarkNumber,
        us_trademark_path: usTrademarkPath,
      }
    };
    const fallbackIntroString = `__JSON_METADATA__:${JSON.stringify(fallbackIntroObj)}`;
    await supabase
      .from("brands")
      .update({
        ...finalUpdatePayload,
        intro: fallbackIntroString
      })
      .eq("id", brand.id);
  }

  redirect("/portal/brands");
}

export async function updateBrand(
  brandId: string,
  _prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  const { companyId } = await requireCompanyMembership();

  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    intro: formData.get("intro"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const hasKrTrademark = formData.get("hasKrTrademark") === "true";
  const krTrademarkNumber = hasKrTrademark ? (formData.get("krTrademarkNumber") as string)?.trim() || null : null;
  const hasUsTrademark = formData.get("hasUsTrademark") === "true";
  const usTrademarkNumber = hasUsTrademark ? (formData.get("usTrademarkNumber") as string)?.trim() || null : null;

  const supabase = await createClient();

  // Upload logo
  const { path: logoPath, error: logoError } = await uploadLogoIfProvided(
    supabase,
    companyId,
    brandId,
    formData
  );
  if (logoError) {
    return { error: logoError };
  }

  // Upload KR trademark file
  let krPathToUpdate: string | null | undefined = undefined;
  if (hasKrTrademark) {
    const fileRes = await uploadTrademarkFileIfProvided(supabase, companyId, brandId, "krTrademarkFile", "kr_trademark", formData);
    if (fileRes.error) return { error: fileRes.error };
    if (fileRes.path) {
      krPathToUpdate = fileRes.path;
    }
  } else {
    krPathToUpdate = null; // Unchecked -> clear
  }

  if (formData.get("deleteKrTrademarkFile") === "true") {
    krPathToUpdate = null;
  }

  // Upload US trademark file
  let usPathToUpdate: string | null | undefined = undefined;
  if (hasUsTrademark) {
    const fileRes = await uploadTrademarkFileIfProvided(supabase, companyId, brandId, "usTrademarkFile", "us_trademark", formData);
    if (fileRes.error) return { error: fileRes.error };
    if (fileRes.path) {
      usPathToUpdate = fileRes.path;
    }
  } else {
    usPathToUpdate = null; // Unchecked -> clear
  }

  if (formData.get("deleteUsTrademarkFile") === "true") {
    usPathToUpdate = null;
  }

  const updatePayload: Record<string, any> = {
    name: parsed.data.name,
    intro: parsed.data.intro || null,
    updated_at: new Date().toISOString(),
    ...(logoPath ? { logo_path: logoPath } : {}),
  };

  const trademarkPayload = {
    has_kr_trademark: hasKrTrademark,
    kr_trademark_number: krTrademarkNumber,
    has_us_trademark: hasUsTrademark,
    us_trademark_number: usTrademarkNumber,
    ...(krPathToUpdate !== undefined ? { kr_trademark_path: krPathToUpdate } : {}),
    ...(usPathToUpdate !== undefined ? { us_trademark_path: usPathToUpdate } : {}),
  };

  // Attempt database columns update
  const { error: updateError } = await supabase
    .from("brands")
    .update({ ...updatePayload, ...trademarkPayload })
    .eq("id", brandId);

  // Fallback to JSON serialization in 'intro' if columns don't exist yet (42703 or PGRST204)
  if (updateError && (updateError.code === "42703" || updateError.code === "PGRST204")) {
    // Collect current values to preserve paths if not modified
    const currentKrPath = formData.get("currentKrTrademarkPath") as string || null;
    const currentUsPath = formData.get("currentUsTrademarkPath") as string || null;

    const fallbackIntroObj = {
      description: parsed.data.intro || "",
      trademarks: {
        has_kr_trademark: hasKrTrademark,
        kr_trademark_number: krTrademarkNumber,
        kr_trademark_path: krPathToUpdate !== undefined ? krPathToUpdate : currentKrPath,
        has_us_trademark: hasUsTrademark,
        us_trademark_number: usTrademarkNumber,
        us_trademark_path: usPathToUpdate !== undefined ? usPathToUpdate : currentUsPath,
      }
    };

    if (krPathToUpdate === null) fallbackIntroObj.trademarks.kr_trademark_path = null;
    if (usPathToUpdate === null) fallbackIntroObj.trademarks.us_trademark_path = null;

    const fallbackIntroString = `__JSON_METADATA__:${JSON.stringify(fallbackIntroObj)}`;

    const { error: fallbackUpdateError } = await supabase
      .from("brands")
      .update({
        ...updatePayload,
        intro: fallbackIntroString
      })
      .eq("id", brandId);

    if (fallbackUpdateError) {
      if (fallbackUpdateError.code === "23505") {
        return { error: "이미 같은 이름의 브랜드가 등록되어 있습니다." };
      }
      return { error: "브랜드 정보를 저장하지 못했습니다." };
    }
  } else if (updateError) {
    console.error("updateBrand query error:", updateError);
    if (updateError.code === "23505") {
      return { error: "이미 같은 이름의 브랜드가 등록되어 있습니다." };
    }
    return { error: "브랜드 정보를 저장하지 못했습니다." };
  }

  redirect("/portal/brands");
}

export async function adminUpdateBrand(
  brandId: string,
  companyId: string,
  _prevState: BrandFormState,
  formData: FormData
): Promise<BrandFormState> {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const parsed = brandSchema.safeParse({
    name: formData.get("name"),
    intro: formData.get("intro"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." };
  }

  const hasKrTrademark = formData.get("hasKrTrademark") === "true";
  const krTrademarkNumber = hasKrTrademark ? (formData.get("krTrademarkNumber") as string)?.trim() || null : null;
  const hasUsTrademark = formData.get("hasUsTrademark") === "true";
  const usTrademarkNumber = hasUsTrademark ? (formData.get("usTrademarkNumber") as string)?.trim() || null : null;

  // Upload logo
  const { path: logoPath, error: logoError } = await uploadLogoIfProvided(
    supabase,
    companyId,
    brandId,
    formData
  );
  if (logoError) {
    return { error: logoError };
  }

  // Upload KR trademark file
  let krPathToUpdate: string | null | undefined = undefined;
  if (hasKrTrademark) {
    const fileRes = await uploadTrademarkFileIfProvided(supabase, companyId, brandId, "krTrademarkFile", "kr_trademark", formData);
    if (fileRes.error) return { error: fileRes.error };
    if (fileRes.path) {
      krPathToUpdate = fileRes.path;
    }
  } else {
    krPathToUpdate = null;
  }

  if (formData.get("deleteKrTrademarkFile") === "true") {
    krPathToUpdate = null;
  }

  // Upload US trademark file
  let usPathToUpdate: string | null | undefined = undefined;
  if (hasUsTrademark) {
    const fileRes = await uploadTrademarkFileIfProvided(supabase, companyId, brandId, "usTrademarkFile", "us_trademark", formData);
    if (fileRes.error) return { error: fileRes.error };
    if (fileRes.path) {
      usPathToUpdate = fileRes.path;
    }
  } else {
    usPathToUpdate = null;
  }

  if (formData.get("deleteUsTrademarkFile") === "true") {
    usPathToUpdate = null;
  }

  const updatePayload: Record<string, any> = {
    name: parsed.data.name,
    intro: parsed.data.intro || null,
    updated_at: new Date().toISOString(),
    ...(logoPath ? { logo_path: logoPath } : {}),
  };

  const trademarkPayload = {
    has_kr_trademark: hasKrTrademark,
    kr_trademark_number: krTrademarkNumber,
    has_us_trademark: hasUsTrademark,
    us_trademark_number: usTrademarkNumber,
    ...(krPathToUpdate !== undefined ? { kr_trademark_path: krPathToUpdate } : {}),
    ...(usPathToUpdate !== undefined ? { us_trademark_path: usPathToUpdate } : {}),
  };

  // Attempt database columns update
  const { error: updateError } = await supabase
    .from("brands")
    .update({ ...updatePayload, ...trademarkPayload })
    .eq("id", brandId);

  // Fallback to JSON serialization if columns don't exist yet
  if (updateError && (updateError.code === "42703" || updateError.code === "PGRST204")) {
    const currentKrPath = formData.get("currentKrTrademarkPath") as string || null;
    const currentUsPath = formData.get("currentUsTrademarkPath") as string || null;

    const fallbackIntroObj = {
      description: parsed.data.intro || "",
      trademarks: {
        has_kr_trademark: hasKrTrademark,
        kr_trademark_number: krTrademarkNumber,
        kr_trademark_path: krPathToUpdate !== undefined ? krPathToUpdate : currentKrPath,
        has_us_trademark: hasUsTrademark,
        us_trademark_number: usTrademarkNumber,
        us_trademark_path: usPathToUpdate !== undefined ? usPathToUpdate : currentUsPath,
      }
    };

    if (krPathToUpdate === null) fallbackIntroObj.trademarks.kr_trademark_path = null;
    if (usPathToUpdate === null) fallbackIntroObj.trademarks.us_trademark_path = null;

    const fallbackIntroString = `__JSON_METADATA__:${JSON.stringify(fallbackIntroObj)}`;

    const { error: fallbackUpdateError } = await supabase
      .from("brands")
      .update({
        ...updatePayload,
        intro: fallbackIntroString
      })
      .eq("id", brandId);

    if (fallbackUpdateError) {
      if (fallbackUpdateError.code === "23505") {
        return { error: "이미 같은 이름의 브랜드가 등록되어 있습니다." };
      }
      return { error: "브랜드 정보를 저장하지 못했습니다." };
    }
  } else if (updateError) {
    console.error("adminUpdateBrand query error:", updateError);
    if (updateError.code === "23505") {
      return { error: "이미 같은 이름의 브랜드가 등록되어 있습니다." };
    }
    return { error: "브랜드 정보를 저장하지 못했습니다." };
  }

  revalidatePath(`/admin/companies/${companyId}`);
  return undefined;
}

/**
 * 08_주요화면과AC.md 화면 6 예외: "이미 신청서에 사용된 브랜드를 삭제하려 할 때 →
 * 물리 삭제 대신 '더 이상 사용하지 않음' 처리, 기존 신청 이력은 유지". 신청서
 * 기능(명세서 03) 이전이라도 정책을 미리 물리 삭제가 아닌 논리 삭제로 통일해둔다.
 */
export async function deactivateBrand(brandId: string) {
  const { companyId } = await requireCompanyMembership();
  const supabase = await createClient();

  await supabase
    .from("brands")
    .update({ is_active: false })
    .eq("id", brandId)
    .eq("company_id", companyId);

  revalidatePath("/portal/brands");
}

export async function adminCreateBrand(
  companyId: string,
  name: string,
  intro: string | null,
  hasKrTrademark: boolean,
  krTrademarkNumber: string | null,
  hasUsTrademark: boolean,
  usTrademarkNumber: string | null
) {
  await verifyAdminSession();
  const supabase = createAdminClient();

  const insertPayload = {
    company_id: companyId,
    name: name.trim(),
    intro: intro || null,
    has_kr_trademark: hasKrTrademark,
    kr_trademark_number: krTrademarkNumber,
    has_us_trademark: hasUsTrademark,
    us_trademark_number: usTrademarkNumber,
  };

  const { data: brand, error } = await supabase
    .from("brands")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !brand) {
    console.error("adminCreateBrand query error:", error);
    if (error?.code === "23505") {
      throw new Error("이미 이 회사에 같은 이름의 브랜드가 등록되어 있습니다.");
    }
    throw new Error(error?.message || "브랜드 등록에 실패했습니다.");
  }

  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/brands");
  return brand;
}
