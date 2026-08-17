import { type SupabaseClient } from "@supabase/supabase-js";

const TRACKED_FIELDS = [
  "payment_method",
  "account_currency",
  "beneficiary_name",
  "beneficiary_address",
  "bank_name",
  "bank_address",
  "bank_country",
  "account_number",
  "swift_bic",
  "routing_number",
  "intermediary_bank_info",
  "remittance_note",
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

  for (const field of TRACKED_FIELDS) {
    const rawOld = oldValObj[field];
    const rawNew = newValObj[field];

    const oldStr = rawOld !== null && rawOld !== undefined ? String(rawOld).trim() : "";
    const newStr = rawNew !== null && rawNew !== undefined ? String(rawNew).trim() : "";

    if (oldStr !== newStr) {
      let finalOld = oldStr;
      let finalNew = newStr;

      if (field === "account_number" || field === "routing_number" || field === "intermediary_bank_info") {
        finalOld = oldStr.length > 4 ? "••••••••" + oldStr.slice(-4) : oldStr ? "••••" : "";
        finalNew = newStr.length > 4 ? "••••••••" + newStr.slice(-4) : newStr ? "••••" : "";
      } else if (field === "swift_bic") {
        finalOld = oldStr.length > 4 ? oldStr.slice(0, 4) + "••••" : oldStr ? "••••" : "";
        finalNew = newStr.length > 4 ? newStr.slice(0, 4) + "••••" : newStr ? "••••" : "";
      } else if (field === "beneficiary_address" || field === "bank_address") {
        finalOld = oldStr ? "[Address Detail Masked]" : "";
        finalNew = newStr ? "[Address Detail Masked]" : "";
      } else if (field === "remittance_note") {
        finalOld = oldStr ? "[Note Detail Masked]" : "";
        finalNew = newStr ? "[Note Detail Masked]" : "";
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
