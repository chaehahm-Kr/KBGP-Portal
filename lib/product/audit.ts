import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditSource = "ADMIN" | "BRAND_PORTAL" | "SYSTEM" | "AUTOMATION";

export type AuditActionType = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "STATUS_CHANGE";

export interface FieldChange {
  label: string;
  before: any;
  after: any;
}

export interface RecordProductChangeInput {
  productId: string;
  userId?: string | null;
  userName: string;
  userEmail?: string | null;
  source: AuditSource;
  companyName?: string | null;
  section: string;
  actionType: AuditActionType;
  summary: string;
  changes?: Record<string, FieldChange> | null;
}

export interface ProductChangeLogItem {
  id: string;
  productId: string;
  userId: string | null;
  userName: string;
  userEmail: string | null;
  source: AuditSource;
  companyName: string | null;
  section: string;
  actionType: AuditActionType;
  summary: string;
  changes: Record<string, FieldChange> | null;
  createdAt: string;
}

/**
 * Record a product change log event into product_change_logs table and update product's last_updated metadata.
 * Log failures are caught and logged to console to prevent blocking the main transaction.
 */
export async function recordProductChangeLog(input: RecordProductChangeInput): Promise<void> {
  try {
    const admin = createAdminClient();

    // 1. Insert into product_change_logs
    const { error: insertError } = await admin.from("product_change_logs").insert({
      product_id: input.productId,
      user_id: input.userId || null,
      user_name: input.userName,
      user_email: input.userEmail || null,
      source: input.source,
      company_name: input.companyName || (input.source === "ADMIN" ? "Admin" : null),
      section: input.section,
      action_type: input.actionType,
      summary: input.summary,
      changes: input.changes || null,
    });

    if (insertError) {
      console.warn("⚠️ [recordProductChangeLog] insert error:", insertError.message);
    }

    // 2. Update last_updated metadata on products table for list view optimization
    const { error: updateError } = await admin
      .from("products")
      .update({
        updated_at: new Date().toISOString(),
        last_updated_by_name: input.userName,
        last_updated_source: input.source,
        last_updated_by_id: input.userId || null,
      })
      .eq("id", input.productId);

    if (updateError) {
      // If columns are not yet in schema cache, fallback silently
      console.warn("⚠️ [recordProductChangeLog] product last_updated update warning:", updateError.message);
    }
  } catch (err) {
    console.error("❌ [recordProductChangeLog] Unexpected error:", err);
  }
}

/**
 * Fetch change history logs for a specific product
 */
export async function getProductChangeHistory(productId: string): Promise<ProductChangeLogItem[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_change_logs")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("⚠️ [getProductChangeHistory] error:", error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      source: row.source,
      companyName: row.company_name,
      section: row.section,
      actionType: row.action_type,
      summary: row.summary,
      changes: row.changes,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error("❌ [getProductChangeHistory] error:", err);
    return [];
  }
}
