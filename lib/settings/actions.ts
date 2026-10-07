"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export interface PartnerStatusConfig {
  id: string;
  label: string;
  color: string; // e.g. "emerald", "amber", "rose", "blue", "zinc"
}

export interface CompanyConfigsPayload {
  company_types: string[];
  partner_statuses: PartnerStatusConfig[];
}

function getLocalFallbackConfigs(): CompanyConfigsPayload {
  try {
    const filePath = path.join(process.cwd(), "lib/settings/default-settings.json");
    if (fs.existsSync(filePath)) {
      const dataStr = fs.readFileSync(filePath, "utf8");
      return JSON.parse(dataStr);
    }
  } catch (e) {
    console.error("Failed to read local fallback configs:", e);
  }
  return {
    company_types: ["Brand Owner", "Manufacturer", "Distributor", "Exporter"],
    partner_statuses: [
      { id: "Active", label: "Active", color: "emerald" },
      { id: "Pending", label: "Pending", color: "amber" },
      { id: "Inactive", label: "Inactive", color: "rose" }
    ]
  };
}

export async function getSystemCompanyConfigs(): Promise<CompanyConfigsPayload> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "company_configs")
      .maybeSingle();

    if (!error && data && data.value) {
      const val = data.value as any;
      const local = getLocalFallbackConfigs();
      return {
        company_types: val.company_types || local.company_types,
        partner_statuses: val.partner_statuses || local.partner_statuses,
      };
    }
  } catch (err) {
    console.error("System settings table not available yet, using fallback config.", err);
  }

  // Default fallback
  return getLocalFallbackConfigs();
}

export async function updateSystemCompanyConfigs(payload: CompanyConfigsPayload) {
  await verifyAdminSession();
  const supabase = await createClient();

  // Try updating the DB configs key 'company_configs'
  const { error } = await supabase
    .from("system_settings")
    .upsert({
      key: "company_configs",
      value: payload,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    // Vercel 서버리스는 파일시스템이 읽기 전용이라 파일로 대신 저장할 수 없다 — DB 저장 실패를 그대로 알린다.
    console.error("Failed to save configs to system_settings:", error);
    throw new Error("설정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }

  revalidatePath("/admin/settings/company-configs");
  revalidatePath("/admin/companies");
}
