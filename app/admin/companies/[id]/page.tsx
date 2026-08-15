import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBrandTrademarks } from "@/lib/brand/actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { parseCompanyMetadata } from "@/lib/company/admin-actions";
import { getSystemCompanyConfigs } from "@/lib/settings/actions";
import { CompanyDetailManager } from "@/components/admin/company-detail-manager";

export const metadata: Metadata = {
  title: "회사 상세 정보 | K SELECT NETWORK 어드민",
};

export default async function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params;
    const session = await verifyAdminSession();
    const supabase = await createClient();

    const { data: company } = await supabase
      .from("companies")
      .select(
        "id, name, business_registration_number, country, contact_name, contact_phone, intro, status, created_at"
      )
      .eq("id", id)
      .single();

    if (!company) {
      notFound();
    }

    const parsedMeta = await parseCompanyMetadata(company);
    const configs = await getSystemCompanyConfigs();

    // Safely fetch brands with trademark columns
    let brandsData: any[] = [];
    const { data: brandsWithTrademarks, error: brandsError } = await supabase
      .from("brands")
      .select("id, name, intro, logo_path, is_active, has_kr_trademark, kr_trademark_number, kr_trademark_path, has_us_trademark, us_trademark_number, us_trademark_path")
      .eq("company_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!brandsError && brandsWithTrademarks) {
      brandsData = brandsWithTrademarks;
    } else {
      // Fallback to core columns if database migration hasn't been run yet
      const { data: coreBrands } = await supabase
        .from("brands")
        .select("id, name, intro, logo_path, is_active")
        .eq("company_id", id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      brandsData = coreBrands ?? [];
    }

    // Resolve signed URLs for logos and trademark certificate files
    const resolvedBrands = await Promise.all(
      brandsData.map(async (brand) => {
        const tm = await parseBrandTrademarks(brand);
        const logoUrl = brand.logo_path ? await getSignedFileUrl(brand.logo_path) : null;
        const krUrl = tm.kr_trademark_path ? await getSignedFileUrl(tm.kr_trademark_path) : null;
        const usUrl = tm.us_trademark_path ? await getSignedFileUrl(tm.us_trademark_path) : null;
        return {
          id: brand.id,
          name: brand.name,
          logoUrl,
          introText: tm.intro_text,
          hasKr: tm.has_kr_trademark,
          krNum: tm.kr_trademark_number,
          krUrl,
          hasUs: tm.has_us_trademark,
          usNum: tm.us_trademark_number,
          usUrl,
        };
      })
    );

    const admin = createAdminClient();

    // 4.1 Fetch attributes master data for completeness rate computation (Use admin client to bypass RLS)
    const { data: dbAllAttrs } = await admin
      .from("attributes")
      .select("code, scope, is_required")
      .eq("is_active", true);
    const commonAttrCodes = (dbAllAttrs ?? [])
      .filter((a) => a.scope === "COMMON")
      .map((a) => a.code);

    // 4.2 Fetch category-profile mappings
    const { data: dbCatProfileMaps } = await admin
      .from("category_profile_mappings")
      .select("category_code, profile_code")
      .eq("is_active", true);
    const catToProfile = new Map((dbCatProfileMaps ?? []).map((m) => [m.category_code, m.profile_code]));

    // 4.3 Fetch profile-attributes mappings
    const { data: dbProfAttrs } = await admin
      .from("profile_attributes")
      .select("profile_code, attribute_code, is_required_override")
      .eq("is_active", true);

    const profileToAttrs = new Map<string, string[]>();
    (dbProfAttrs ?? []).forEach((pa) => {
      const list = profileToAttrs.get(pa.profile_code) || [];
      list.push(pa.attribute_code);
      profileToAttrs.set(pa.profile_code, list);
    });

    // 4.4 Fetch all product attribute values
    const { data: dbAllAttrValues } = await admin
      .from("product_attribute_values")
      .select("product_id, attribute_code, value_json, text_value");

    const valuesByProduct = new Map<string, Map<string, any>>();
    (dbAllAttrValues ?? []).forEach((val) => {
      const pMap = valuesByProduct.get(val.product_id) || new Map<string, any>();
      pMap.set(val.attribute_code, val);
      valuesByProduct.set(val.product_id, pMap);
    });

    // 4.5 Fetch product images product_id set to evaluate images upload status for draft qualification
    const { data: dbProductImages } = await admin
      .from("product_images")
      .select("product_id");
    const productImagesForDraft = new Set((dbProductImages ?? []).map((img) => img.product_id));

    const getProductCompleteness = (productId: string, categoryCode: string | null | undefined): number => {
      if (!categoryCode) return 0;
      const profileCode = catToProfile.get(categoryCode);
      const targetAttrCodes = new Set<string>(commonAttrCodes);
      if (profileCode) {
        const pAttrs = profileToAttrs.get(profileCode) || [];
        pAttrs.forEach((code) => targetAttrCodes.add(code));
      }
      if (targetAttrCodes.size === 0) return 100;
      const pValues = valuesByProduct.get(productId) || new Map<string, any>();
      let filled = 0;
      targetAttrCodes.forEach((code) => {
        const valObj = pValues.get(code);
        if (valObj) {
          const val = valObj.value_json;
          if (Array.isArray(val)) {
            if (val.length > 0) filled++;
          } else if (val !== null && val !== undefined && String(val).trim() !== "") {
            filled++;
          }
        }
      });
      return Math.round((filled / targetAttrCodes.size) * 100);
    };

    const { data: rawProducts } = await supabase
      .from("products")
      .select("id, name, name_en, category, category_code, brand_id, company_id, manufacture_sku, letusto_sku, parent_sku, child_sku, price_krw_retail, price_usd_fob, package_width, package_depth, package_height, package_weight, price_additional_info, origin, upc, ean, selection_status, sales_status")
      .eq("company_id", id);

    const resolvedProducts = (rawProducts ?? []).map((p) => {
      const adminOverrides = (p.price_additional_info as any)?.admin_overrides || {};
      const effectiveBrandId = p.brand_id;
      const effectiveCategory = adminOverrides.category !== undefined && adminOverrides.category !== "" ? adminOverrides.category : p.category;
      const effectiveNameEn = adminOverrides.name_en !== undefined && adminOverrides.name_en !== "" ? adminOverrides.name_en : p.name_en;
      const effectiveManufactureSku = adminOverrides.manufacture_sku !== undefined && adminOverrides.manufacture_sku !== "" ? adminOverrides.manufacture_sku : p.manufacture_sku;
      const effectiveOrigin = adminOverrides.origin !== undefined && adminOverrides.origin !== "" ? adminOverrides.origin : p.origin;
      const effectivePriceKrwRetail = adminOverrides.price_krw_retail !== undefined ? parseFloat(adminOverrides.price_krw_retail) : (p.price_krw_retail || 0);
      const effectivePriceUsdFob = adminOverrides.price_usd_fob !== undefined ? parseFloat(adminOverrides.price_usd_fob) : (p.price_usd_fob || 0);
      const effectiveUpc = adminOverrides.upc !== undefined && adminOverrides.upc !== "" ? adminOverrides.upc : p.upc;
      const effectiveEan = adminOverrides.ean !== undefined && adminOverrides.ean !== "" ? adminOverrides.ean : p.ean;

      const pkgWidth = adminOverrides.package_width !== undefined ? parseFloat(adminOverrides.package_width) : Number(p.package_width || 0);
      const pkgDepth = adminOverrides.package_depth !== undefined ? parseFloat(adminOverrides.package_depth) : Number(p.package_depth || 0);
      const pkgHeight = adminOverrides.package_height !== undefined ? parseFloat(adminOverrides.package_height) : Number(p.package_height || 0);
      const pkgWeight = adminOverrides.package_weight !== undefined ? parseFloat(adminOverrides.package_weight) : Number(p.package_weight || 0);

      const completenessRate = getProductCompleteness(p.id, p.category_code);
      const missingFields: string[] = [];
      if (!effectiveBrandId) missingFields.push("브랜드");
      if (!p.category_code || completenessRate < 100) missingFields.push("카테고리");
      if (!(effectiveNameEn || "").trim()) missingFields.push("영문 제품명");
      if (!(effectiveManufactureSku || "").trim()) missingFields.push("제조사 SKU");
      if (!(effectiveOrigin || "").trim()) missingFields.push("원산지");
      if (Number(effectivePriceKrwRetail) <= 0) missingFields.push("소비자 판매가");
      if (Number(effectivePriceUsdFob) <= 0) missingFields.push("FOB 수출 가격");
      
      if (pkgWidth <= 0 || pkgDepth <= 0 || pkgHeight <= 0 || pkgWeight <= 0) {
        missingFields.push("패키지 배송 규격");
      }
      if (!(effectiveUpc || "").trim() && !(effectiveEan || "").trim()) {
        missingFields.push("식별 바코드(UPC 또는 EAN)");
      }
      
      const hasImages = productImagesForDraft.has(p.id);
      if (!hasImages) {
        missingFields.push("대표 이미지");
      }

      const isDraft = missingFields.length > 0;

      return {
        id: p.id,
        name: p.name,
        name_en: p.name_en,
        brand_id: p.brand_id,
        price_additional_info: p.price_additional_info,
        manufacture_sku: p.manufacture_sku,
        display_manufacture_sku: effectiveManufactureSku,
        letusto_sku: adminOverrides.letusto_sku !== undefined ? adminOverrides.letusto_sku : p.letusto_sku,
        is_draft: isDraft,
        selection_status: p.selection_status || "UNREVIEWED",
        sales_status: p.sales_status || "PREPARING",
      };
    });

    const { data: applications } = await supabase
      .from("applications")
      .select("id, application_number, status, submitted_at")
      .eq("company_id", id)
      .neq("status", "draft")
      .order("submitted_at", { ascending: false });

    const { data: companyUsers } = await supabase
      .from("company_users")
      .select("id, name, email, status, company_role, title, position, phone, is_primary, permissions")
      .eq("company_id", id)
      .order("created_at", { ascending: true });

    // Hydrate task assignments on companyUsers
    let assignments: any[] = [];
    try {
      const { data, error } = await supabase
        .from("company_task_assignments")
        .select("user_id, task_code, is_primary, email_notify")
        .eq("company_id", id);
      if (!error && data) {
        assignments = data;
      }
    } catch (e) {
      console.warn("company_task_assignments table not ready in admin detail page", e);
    }

    const hydratedUsers = (companyUsers ?? []).map((u: any) => ({
      ...u,
      task_assignments: assignments.filter((a: any) => a.user_id === u.id)
    }));

    const brandNameById = new Map(brandsData.map((b) => [b.id, b.name]));

    // Query task assignments
    const { getCompanyTaskAssignments } = await import("@/lib/company/task-actions");
    const taskAssignments = await getCompanyTaskAssignments(id);

    // Fetch user roles to check for super_admin
    const { data: userRoles } = await admin
      .from("staff_roles")
      .select("role")
      .eq("staff_id", session.userId);
    const isSuperAdmin = (userRoles ?? []).some((r) => r.role === "super_admin");

    // Fetch staff member department to check for Finance department
    const { data: staff } = await admin
      .from("staff_members")
      .select("department_id")
      .eq("id", session.userId)
      .single();
    
    let isFinanceUser = false;
    if (staff?.department_id) {
      const { data: dept } = await admin
        .from("departments")
        .select("name")
        .eq("id", staff.department_id)
        .single();
      if (dept?.name === "Finance") {
        isFinanceUser = true;
      }
    }

    // Fetch Supplier Profile and Remittance details
    const { data: supplierProfile } = await admin
      .from("supplier_profiles")
      .select("*")
      .eq("company_id", id)
      .maybeSingle();

    const { data: supplierRemittance } = await admin
      .from("supplier_remittances")
      .select("*")
      .eq("company_id", id)
      .maybeSingle();

    return (
      <CompanyDetailManager
        company={company}
        parsedMeta={parsedMeta}
        companyUsers={hydratedUsers}
        brands={resolvedBrands}
        products={resolvedProducts}
        applications={applications ?? []}
        brandNameById={brandNameById}
        typeOptions={configs.company_types}
        statusOptions={configs.partner_statuses}
        taskAssignments={taskAssignments}
        isSuperAdmin={isSuperAdmin}
        isFinanceUser={isFinanceUser}
        initialSupplierProfile={supplierProfile || null}
        initialSupplierRemittance={supplierRemittance || null}
      />
    );
  } catch (err: any) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-250 text-rose-950 font-mono text-xs space-y-4 rounded-lg m-6">
        <h1 className="text-lg font-bold text-rose-800">🚨 [어드민 상세정보 서버 에러 디버그]</h1>
        <p className="font-semibold text-sm">에러 메시지: {err.message}</p>
        <div className="bg-white p-4 border border-rose-100 rounded overflow-x-auto whitespace-pre leading-relaxed text-[11px] text-rose-900 max-h-[400px]">
          {err.stack || "스택 정보 없음"}
        </div>
      </div>
    );
  }
}
