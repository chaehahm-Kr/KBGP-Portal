import { type SupabaseClient } from "@supabase/supabase-js";

const SENSITIVE_FIELDS = [
  "beneficiary_name",
  "bank_name",
  "account_number",
  "swift_bic",
  "routing_number",
  "bank_country",
  "beneficiary_address",
];

export async function logRemittanceChanges(
  adminDb: SupabaseClient,
  companyId: string,
  changedBy: string,
  changedByName: string,
  actorType: "letusto_admin" | "portal_admin",
  oldRem: any,
  newRem: any
) {
  const oldValObj = oldRem || {};
  const newValObj = newRem || {};

  for (const field of SENSITIVE_FIELDS) {
    const rawOld = oldValObj[field];
    const rawNew = newValObj[field];

    const oldStr = rawOld !== null && rawOld !== undefined ? String(rawOld).trim() : "";
    const newStr = rawNew !== null && rawNew !== undefined ? String(rawNew).trim() : "";

    if (oldStr !== newStr) {
      let finalOld = oldStr;
      let finalNew = newStr;

      if (field === "account_number") {
        finalOld = oldStr.length > 4 ? "••••••••" + oldStr.slice(-4) : oldStr ? "••••" : "";
        finalNew = newStr.length > 4 ? "••••••••" + newStr.slice(-4) : newStr ? "••••" : "";
      }

      const { error } = await adminDb.from("supplier_remittance_logs").insert({
        company_id: companyId,
        changed_by: changedBy,
        changed_by_name: changedByName,
        actor_type: actorType,
        field_name: field,
        old_value: finalOld || null,
        new_value: finalNew || null,
      });

      if (error) {
        console.error(`[supplier_remittance_logs] failed to insert for field ${field}:`, error);
      }
    }
  }
}
