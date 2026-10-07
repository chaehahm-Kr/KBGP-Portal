"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminUnreadCounts {
  applications: number;
  poRequests: number;
  products: number;
  supplierInvoices: number;
  totalPurchasing: number;
  totalFinance: number;
  totalProducts: number;
}

/**
 * PO 요청 워크플로(0092_po_requests_workflow)는 아직 운영 DB에 적용되지 않았다.
 * 현재 po_requests 는 0127 이 만든 임시 테이블(id, created_at, admin_read_at,
 * admin_read_by)뿐이라 status 로 필터하면 매 폴링마다 "column does not exist"
 * 오류가 난다. 0092 를 적용한 뒤 true 로 바꾸면 배지 집계가 다시 켜진다.
 */
const PO_REQUESTS_WORKFLOW_ENABLED = false;

export type AdminNotificationEntity =
  | "application"
  | "po_request"
  | "product"
  | "supplier_invoice";

/**
 * Returns accurate unread/NEW counts across all 4 key Admin work areas.
 * Unread Count = Items received/submitted in Admin that have NOT yet had their detail view opened (admin_read_at IS NULL).
 */
export async function getAdminUnreadCounts(): Promise<AdminUnreadCounts> {
  const admin = createAdminClient();

  try {
    const [appsRes, poReqsRes, prodsRes, invsRes] = await Promise.all([
      // 1. Applications: Non-draft, non-deleted applications submitted for admin review where admin_read_at is NULL
      admin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .neq("status", "draft")
        .neq("status", "deleted")
        .is("admin_read_at", null),

      // 2. PO Requests: Submitted/Under Review PO requests where admin_read_at is NULL
      PO_REQUESTS_WORKFLOW_ENABLED
        ? admin
            .from("po_requests")
            .select("id", { count: "exact", head: true })
            .in("status", ["SUBMITTED", "UNDER_REVIEW", "CHANGE_REQUESTED"])
            .is("admin_read_at", null)
        : Promise.resolve({ count: 0 }),

      // 3. Products: Registered / submitted products for admin review where admin_read_at is NULL
      admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .neq("status", "draft")
        .is("admin_read_at", null),

      // 4. Supplier Invoices: Non-draft, non-void supplier invoices where admin_read_at is NULL
      admin
        .from("supplier_invoices")
        .select("id", { count: "exact", head: true })
        .neq("invoice_status", "DRAFT")
        .neq("invoice_status", "VOID")
        .is("admin_read_at", null),
    ]);

    const applications = appsRes.count ?? 0;
    const poRequests = poReqsRes.count ?? 0;
    const products = prodsRes.count ?? 0;
    const supplierInvoices = invsRes.count ?? 0;

    return {
      applications,
      poRequests,
      products,
      supplierInvoices,
      totalPurchasing: poRequests,
      totalFinance: supplierInvoices,
      totalProducts: products,
    };
  } catch (err) {
    console.error("Error fetching admin unread counts:", err);
    return {
      applications: 0,
      poRequests: 0,
      products: 0,
      supplierInvoices: 0,
      totalPurchasing: 0,
      totalFinance: 0,
      totalProducts: 0,
    };
  }
}

/**
 * Marks an item as READ by setting admin_read_at to now() upon successful first detail view.
 * Persistent in database across page reloads, logout/login, and multi-admin sessions.
 */
export async function markAdminItemAsRead(
  entity: AdminNotificationEntity,
  id: string,
  adminUserId?: string
): Promise<boolean> {
  if (!id) return false;

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    admin_read_at: now,
  };
  if (adminUserId) {
    updatePayload.admin_read_by = adminUserId;
  }

  let table = "";
  let pathsToRevalidate: string[] = ["/admin"];

  switch (entity) {
    case "application":
      table = "applications";
      pathsToRevalidate.push(
        "/admin/applications",
        `/admin/applications/${id}`
      );
      break;
    case "po_request":
      table = "po_requests";
      pathsToRevalidate.push(
        "/admin/purchasing/requests",
        `/admin/purchasing/requests/${id}`,
        "/admin/purchasing/dashboard"
      );
      break;
    case "product":
      table = "products";
      pathsToRevalidate.push(
        "/admin/products",
        `/admin/products/${id}`
      );
      break;
    case "supplier_invoice":
      table = "supplier_invoices";
      pathsToRevalidate.push(
        "/admin/finance/invoices",
        `/admin/finance/invoices/${id}`
      );
      break;
    default:
      return false;
  }

  try {
    const { error } = await admin
      .from(table)
      .update(updatePayload)
      .eq("id", id)
      .is("admin_read_at", null);

    if (error) {
      // If error occurs (e.g. column doesn't exist yet before migration), fail silently without crashing page
      console.warn(`[markAdminItemAsRead] failed for ${entity} ${id}:`, error.message);
      return false;
    }

    pathsToRevalidate.forEach((p) => {
      try {
        revalidatePath(p);
      } catch {}
    });

    return true;
  } catch (err) {
    console.warn(`[markAdminItemAsRead] error for ${entity} ${id}:`, err);
    return false;
  }
}
