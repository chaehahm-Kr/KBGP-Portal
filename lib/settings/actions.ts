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
      .single();

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
    console.warn("Failed to save configs to database system_settings table, falling back to local file:", error);
    
    // Fallback: Write directly to default-settings.json file!
    try {
      const filePath = path.join(process.cwd(), "lib/settings/default-settings.json");
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    } catch (fsErr) {
      console.error("Failed to write fallback settings file:", fsErr);
      throw new Error("설정 저장에 실패했습니다. DB 마이그레이션이 적용되었는지 확인해주세요.");
    }
  }

  revalidatePath("/admin/settings/company-configs");
  revalidatePath("/admin/companies");
}
