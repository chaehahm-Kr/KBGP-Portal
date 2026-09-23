"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { verifyAdminSession } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveEffectiveSku } from "@/lib/product/types";
import { getEasternTodayString, formatEasternDateTime } from "@/lib/utils/timezone";

import type {
  PoRequestStatus,
  PoRequestLineInput,
  PoRequestInput,
  PoRequestLine,
  PoRequestHistoryEntry,
  PoRequestDetail,
} from "./request-types";

// In-memory / metadata store fallback for zero-downtime resilience
async function getRequestsFromMeta(companyId?: string): Promise<any[]> {
  const admin = createAdminClient();
  let query = admin.from("companies").select("id, intro");
  if (companyId) query = query.eq("id", companyId);
  const { data: comps } = await query;

  const results: any[] = [];
  (comps ?? []).forEach((c: any) => {
    if (c.intro && c.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        const parsed = JSON.parse(c.intro.substring("__COMPANY_METADATA__:".length));
        if (Array.isArray(parsed.po_requests)) {
          results.push(...parsed.po_requests);
        }
      } catch (e) {}
    }
  });
  return results;
}

async function saveRequestToMeta(companyId: string, requestObj: any): Promise<void> {
  const admin = createAdminClient();
  const { data: comp } = await admin.from("companies").select("intro").eq("id", companyId).single();

  let metaObj: any = {};
  if (comp && comp.intro && comp.intro.startsWith("__COMPANY_METADATA__:")) {
    try {
      metaObj = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
    } catch (e) {}
  }

  const existingList: any[] = Array.isArray(metaObj.po_requests) ? metaObj.po_requests : [];
  const idx = existingList.findIndex((r) => r.id === requestObj.id);
  if (idx >= 0) {
    existingList[idx] = requestObj;
  } else {
    existingList.unshift(requestObj);
  }

  metaObj.po_requests = existingList;
  const newIntro = `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`;
  await admin.from("companies").update({ intro: newIntro, updated_at: new Date().toISOString() }).eq("id", companyId);
}

// Generate unique Request Number: PR-YYYYMMDD-XXXX
function generateRequestNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PR-${dateStr}-${rand}`;
}

/**
 * PORTAL: Fetch all PO Requests for the authenticated company user
 */
export async function getPortalPoRequests(): Promise<PoRequestDetail[]> {
  const membership = await requireCompanyMembership();
  const companyId = membership.companyId;
  const admin = createAdminClient();

  let requests: any[] = [];
  try {
    const { data, error } = await admin
      .from("po_requests")
      .select(`
        *,
        company:company_id (id, name),
        lines:po_request_lines (
          id, product_id, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot,
          requested_qty, reference_unit_cost, estimated_line_total, admin_final_qty, admin_final_unit_cost, admin_final_line_total, line_note
        ),
        history:po_request_history (id, action, actor_name, actor_role, notes, created_at)
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      requests = data;
    }
  } catch (e) {}

  if (requests.length === 0) {
    requests = await getRequestsFromMeta(companyId);
  }

  return formatRequests(requests);
}

/**
 * PORTAL: Get PO Request detail for the authenticated company user (with security check)
 */
export async function getPortalPoRequestDetail(requestId: string): Promise<PoRequestDetail> {
  const membership = await requireCompanyMembership();
  const companyId = membership.companyId;
  const admin = createAdminClient();

  let req: any = null;
  try {
    const { data, error } = await admin
      .from("po_requests")
      .select(`
        *,
        company:company_id (id, name),
        lines:po_request_lines (
          id, product_id, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot,
          requested_qty, reference_unit_cost, estimated_line_total, admin_final_qty, admin_final_unit_cost, admin_final_line_total, line_note
        ),
        history:po_request_history (id, action, actor_name, actor_role, notes, created_at)
      `)
      .eq("id", requestId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!error && data) {
      req = data;
    }
  } catch (e) {}

  if (!req) {
    const fallbackList = await getRequestsFromMeta(companyId);
    req = fallbackList.find((r) => r.id === requestId && r.company_id === companyId);
  }

  if (!req) {
    throw new Error("발주 요청 정보를 찾을 수 없거나 접근 권한이 없습니다.");
  }

  // Enrich lines with product photo & current info if available
  const productIds = (req.lines || []).map((l: any) => l.product_id);
  const { data: dbProducts } = await admin
    .from("products")
    .select(`
      id, price_usd_fob, price_additional_info, carton_pack_qty,
      product_images (storage_path, position)
    `)
    .in("id", productIds);

  const { getSignedFileUrl } = await import("@/lib/files/storage");
  const prodMap = new Map((dbProducts ?? []).map((p: any) => [p.id, p]));

  const enrichedLines = await Promise.all(
    (req.lines || []).map(async (line: any) => {
      const p = prodMap.get(line.product_id);
      let photoUrl: string | null = null;
      if (p && p.product_images && p.product_images.length > 0) {
        try {
          photoUrl = await getSignedFileUrl(p.product_images[0].storage_path);
        } catch {}
      }

      const adminOverrides = p?.price_additional_info?.admin_overrides || {};
      const rawTiers = adminOverrides.price_tiers || p?.price_additional_info?.price_tiers || [];
      const priceTiers = Array.isArray(rawTiers)
        ? rawTiers.map((t: any) => ({ qty: Number(t.qty), price: Number(t.price) }))
        : [];

      return {
        ...line,
        photo_url: photoUrl,
        carton_pack_qty: p?.carton_pack_qty || 1,
        price_tiers: priceTiers,
        base_fob: p?.price_usd_fob || line.reference_unit_cost,
      };
    })
  );

  const formatted = formatSingleRequest({ ...req, lines: enrichedLines });
  return formatted;
}

/**
 * PORTAL: Create a new PO Request (Draft or Submitted)
 */
export async function createPoRequest(input: PoRequestInput): Promise<{ id: string; request_number: string }> {
  const membership = await requireCompanyMembership();
  const companyId = membership.companyId;
  const admin = createAdminClient();

  const { data: userProfile } = await admin
    .from("company_users")
    .select("id, name, email")
    .eq("id", membership.userId)
    .maybeSingle();

  const user = {
    id: membership.userId,
    name: userProfile?.name || "담당자",
    email: userProfile?.email || "",
  };

  if (!input.lines || input.lines.length === 0) {
    throw new Error("최소 1개 이상의 제품 품목을 추가해 주세요.");
  }

  // Fetch product snapshot master data
  const productIds = input.lines.map((l) => l.product_id);
  const { data: dbProducts, error: pErr } = await admin
    .from("products")
    .select("id, name, name_en, letusto_sku, manufacture_sku, price_usd_fob, price_additional_info")
    .in("id", productIds);

  if (pErr || !dbProducts || dbProducts.length === 0) {
    throw new Error("유효하지 않은 제품이 포함되어 있습니다.");
  }

  const prodMap = new Map(dbProducts.map((p) => [p.id, p]));
  const requestNumber = generateRequestNumber();
  const status: PoRequestStatus = input.submit_now ? "SUBMITTED" : "DRAFT";
  const now = new Date().toISOString();

  // Create line snapshots
  const linesPayload = input.lines.map((l) => {
    const p = prodMap.get(l.product_id);
    if (!p) throw new Error("선택한 제품 정보를 찾을 수 없습니다.");

    const adminOverrides = p.price_additional_info?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p.name_en || adminOverrides.name || p.name;
    const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p.letusto_sku);
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p.manufacture_sku);
    const estLineTotal = Number(l.requested_qty) * Number(l.reference_unit_cost);

    return {
      id: crypto.randomUUID(),
      product_id: p.id,
      product_name_snapshot: displayName,
      letusto_sku_snapshot: effectiveLetustoSku,
      manufacture_sku_snapshot: effectiveManufactureSku,
      requested_qty: Number(l.requested_qty),
      reference_unit_cost: Number(l.reference_unit_cost),
      estimated_line_total: estLineTotal,
      admin_final_qty: null,
      admin_final_unit_cost: null,
      admin_final_line_total: null,
      line_note: l.line_note || null,
      created_at: now,
      updated_at: now,
    };
  });

  const requestHeader = {
    id: crypto.randomUUID(),
    request_number: requestNumber,
    company_id: companyId,
    contact_user_id: input.contact_user_id || user.id,
    contact_name: input.contact_name || user.name || "담당자",
    contact_email: input.contact_email || user.email,
    shipping_origin_id: input.shipping_origin_id || null,
    requested_ready_date: input.requested_ready_date || null,
    status,
    notes: input.notes || null,
    admin_review_notes: null,
    change_request_reason: null,
    rejection_reason: null,
    converted_po_id: null,
    converted_po_number: null,
    submitted_at: input.submit_now ? now : null,
    reviewed_at: null,
    converted_at: null,
    created_by: user.id,
    created_at: now,
    updated_at: now,
  };

  const historyEntry: PoRequestHistoryEntry = {
    id: crypto.randomUUID(),
    po_request_id: requestHeader.id,
    action: input.submit_now ? "SUBMITTED" : "CREATED",
    actor_id: user.id,
    actor_name: user.name || "Portal User",
    actor_role: "Portal Partner",
    notes: input.submit_now ? "신규 발주 요청서 제출" : "발주 요청서 임시 저장",
    created_at: now,
  };

  // Try saving to DB tables first
  let dbSaved = false;
  try {
    const { error: insErr } = await admin.from("po_requests").insert(requestHeader);
    if (!insErr) {
      const lineInserts = linesPayload.map((l) => ({ ...l, po_request_id: requestHeader.id }));
      await admin.from("po_request_lines").insert(lineInserts);
      await admin.from("po_request_history").insert(historyEntry);
      dbSaved = true;
    }
  } catch (e) {}

  // Always save to metadata as backup
  await saveRequestToMeta(companyId, {
    ...requestHeader,
    lines: linesPayload,
    history: [historyEntry],
  });

  revalidatePath("/portal/orders/requests");
  revalidatePath("/admin/purchasing/requests");

  return { id: requestHeader.id, request_number: requestNumber };
}

/**
 * PORTAL: Update an existing PO Request (if DRAFT or CHANGE_REQUESTED)
 */
export async function updatePoRequest(
  requestId: string,
  input: PoRequestInput
): Promise<{ success: boolean }> {
  const membership = await requireCompanyMembership();
  const companyId = membership.companyId;
  const admin = createAdminClient();

  const { data: userProfile } = await admin
    .from("company_users")
    .select("id, name, email")
    .eq("id", membership.userId)
    .maybeSingle();

  const user = {
    id: membership.userId,
    name: userProfile?.name || "담당자",
    email: userProfile?.email || "",
  };

  const existing = await getPortalPoRequestDetail(requestId);
  if (existing.company_id !== companyId) {
    throw new Error("접근 권한이 없습니다.");
  }

  if (existing.status !== "DRAFT" && existing.status !== "CHANGE_REQUESTED") {
    throw new Error("작성 중(DRAFT) 또는 수정 요청(CHANGE_REQUESTED) 상태인 경우에만 수정할 수 있습니다.");
  }

  const isResubmission = existing.status === "CHANGE_REQUESTED" && input.submit_now;
  const newStatus: PoRequestStatus = input.submit_now ? "SUBMITTED" : existing.status;
  const now = new Date().toISOString();

  // Snapshot updated products
  const productIds = input.lines.map((l) => l.product_id);
  const { data: dbProducts } = await admin
    .from("products")
    .select("id, name, name_en, letusto_sku, manufacture_sku, price_usd_fob, price_additional_info")
    .in("id", productIds);

  const prodMap = new Map((dbProducts ?? []).map((p) => [p.id, p]));

  const updatedLines = input.lines.map((l) => {
    const p = prodMap.get(l.product_id);
    const adminOverrides = p?.price_additional_info?.admin_overrides || {};
    const displayName = adminOverrides.name_en || p?.name_en || adminOverrides.name || p?.name || "제품";
    const effectiveLetustoSku = resolveEffectiveSku(adminOverrides.letusto_sku, p?.letusto_sku);
    const effectiveManufactureSku = resolveEffectiveSku(adminOverrides.manufacture_sku, p?.manufacture_sku);
    const estLineTotal = Number(l.requested_qty) * Number(l.reference_unit_cost);

    return {
      id: crypto.randomUUID(),
      po_request_id: requestId,
      product_id: l.product_id,
      product_name_snapshot: displayName,
      letusto_sku_snapshot: effectiveLetustoSku,
      manufacture_sku_snapshot: effectiveManufactureSku,
      requested_qty: Number(l.requested_qty),
      reference_unit_cost: Number(l.reference_unit_cost),
      estimated_line_total: estLineTotal,
      admin_final_qty: null,
      admin_final_unit_cost: null,
      admin_final_line_total: null,
      line_note: l.line_note || null,
      created_at: now,
      updated_at: now,
    };
  });

  const updatedHeader = {
    contact_user_id: input.contact_user_id || existing.contact_user_id,
    contact_name: input.contact_name || existing.contact_name,
    contact_email: input.contact_email || existing.contact_email,
    shipping_origin_id: input.shipping_origin_id || null,
    requested_ready_date: input.requested_ready_date || null,
    status: newStatus,
    notes: input.notes || null,
    submitted_at: input.submit_now ? now : existing.submitted_at,
    updated_at: now,
  };

  const historyEntry: PoRequestHistoryEntry = {
    id: crypto.randomUUID(),
    po_request_id: requestId,
    action: isResubmission ? "RESUBMITTED" : input.submit_now ? "SUBMITTED" : "UPDATED",
    actor_id: user.id,
    actor_name: user.name || "Portal User",
    actor_role: "Portal Partner",
    notes: isResubmission ? "수정 요청 사항 반영 후 재제출" : input.submit_now ? "요청서 제출 완료" : "요청서 내용 수정",
    created_at: now,
  };

  try {
    await admin.from("po_requests").update(updatedHeader).eq("id", requestId);
    await admin.from("po_request_lines").delete().eq("po_request_id", requestId);
    await admin.from("po_request_lines").insert(updatedLines);
    await admin.from("po_request_history").insert(historyEntry);
  } catch (e) {}

  await saveRequestToMeta(companyId, {
    ...existing,
    ...updatedHeader,
    lines: updatedLines,
    history: [historyEntry, ...(existing.history || [])],
  });

  revalidatePath(`/portal/orders/requests/${requestId}`);
  revalidatePath("/portal/orders/requests");
  revalidatePath("/admin/purchasing/requests");

  return { success: true };
}

/**
 * PORTAL: Cancel a PO Request
 */
export async function cancelPoRequest(requestId: string): Promise<{ success: boolean }> {
  const membership = await requireCompanyMembership();
  const companyId = membership.companyId;
  const admin = createAdminClient();

  const { data: userProfile } = await admin
    .from("company_users")
    .select("id, name, email")
    .eq("id", membership.userId)
    .maybeSingle();

  const user = {
    id: membership.userId,
    name: userProfile?.name || "담당자",
    email: userProfile?.email || "",
  };

  const existing = await getPortalPoRequestDetail(requestId);
  if (existing.company_id !== companyId) {
    throw new Error("접근 권한이 없습니다.");
  }

  if (existing.status === "CONVERTED_TO_PO") {
    throw new Error("이미 정식 PO로 전환된 요청은 취소할 수 없습니다.");
  }

  const now = new Date().toISOString();
  const historyEntry: PoRequestHistoryEntry = {
    id: crypto.randomUUID(),
    po_request_id: requestId,
    action: "CANCELLED",
    actor_id: user.id,
    actor_name: user.name || "Portal User",
    actor_role: "Portal Partner",
    notes: "파트너에 의해 발주 요청 취소됨",
    created_at: now,
  };

  try {
    await admin.from("po_requests").update({ status: "CANCELLED", updated_at: now }).eq("id", requestId);
    await admin.from("po_request_history").insert(historyEntry);
  } catch (e) {}

  await saveRequestToMeta(companyId, {
    ...existing,
    status: "CANCELLED",
    updated_at: now,
    history: [historyEntry, ...(existing.history || [])],
  });

  revalidatePath(`/portal/orders/requests/${requestId}`);
  revalidatePath("/portal/orders/requests");
  revalidatePath("/admin/purchasing/requests");

  return { success: true };
}

/**
 * ADMIN: Get all PO Requests with filters & status metrics
 */
export async function getAdminPoRequests(filters?: {
  search?: string;
  company_id?: string;
  status?: string;
}): Promise<{ requests: PoRequestDetail[]; counts: Record<string, number> }> {
  await verifyAdminSession();
  const admin = createAdminClient();

  let rawList: any[] = [];
  try {
    const { data, error } = await admin
      .from("po_requests")
      .select(`
        *,
        company:company_id (id, name),
        lines:po_request_lines (
          id, product_id, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot,
          requested_qty, reference_unit_cost, estimated_line_total, admin_final_qty, admin_final_unit_cost, admin_final_line_total, line_note
        ),
        history:po_request_history (id, action, actor_name, actor_role, notes, created_at)
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      rawList = data;
    }
  } catch (e) {}

  if (rawList.length === 0) {
    rawList = await getRequestsFromMeta();
  }

  const allFormatted = formatRequests(rawList);

  // Compute status counts
  const counts: Record<string, number> = {
    ALL: allFormatted.length,
    SUBMITTED: 0,
    UNDER_REVIEW: 0,
    CHANGE_REQUESTED: 0,
    CONVERTED_TO_PO: 0,
    REJECTED: 0,
    DRAFT: 0,
    CANCELLED: 0,
  };

  allFormatted.forEach((r) => {
    if (counts[r.status] !== undefined) {
      counts[r.status]++;
    }
  });

  // Apply filters
  let filtered = allFormatted;
  if (filters?.status && filters.status !== "ALL") {
    filtered = filtered.filter((r) => r.status === filters.status);
  }
  if (filters?.company_id && filters.company_id !== "ALL") {
    filtered = filtered.filter((r) => r.company_id === filters.company_id);
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.request_number.toLowerCase().includes(q) ||
        r.company_name.toLowerCase().includes(q) ||
        (r.contact_name || "").toLowerCase().includes(q) ||
        (r.contact_email || "").toLowerCase().includes(q) ||
        r.lines.some(
          (l) =>
            l.product_name_snapshot.toLowerCase().includes(q) ||
            (l.letusto_sku_snapshot || "").toLowerCase().includes(q)
        )
    );
  }

  return { requests: filtered, counts };
}

/**
 * ADMIN: Get single PO Request detail for Review & Adjustments
 */
export async function getAdminPoRequestDetail(requestId: string): Promise<PoRequestDetail> {
  await verifyAdminSession();
  const admin = createAdminClient();

  let req: any = null;
  try {
    const { data, error } = await admin
      .from("po_requests")
      .select(`
        *,
        company:company_id (id, name),
        lines:po_request_lines (
          id, product_id, product_name_snapshot, letusto_sku_snapshot, manufacture_sku_snapshot,
          requested_qty, reference_unit_cost, estimated_line_total, admin_final_qty, admin_final_unit_cost, admin_final_line_total, line_note
        ),
        history:po_request_history (id, action, actor_name, actor_role, notes, created_at)
      `)
      .eq("id", requestId)
      .maybeSingle();

    if (!error && data) {
      req = data;
    }
  } catch (e) {}

  if (!req) {
    const fallbackList = await getRequestsFromMeta();
    req = fallbackList.find((r) => r.id === requestId);
  }

  if (!req) {
    throw new Error("요청서 정보를 찾을 수 없습니다.");
  }

  // Fetch origins info & product photos
  const { getCompanyShippingOrigins } = await import("@/lib/company/shipping-origin-actions");
  const origins = await getCompanyShippingOrigins(req.company_id);
  const matchedOrigin = origins.find((o: any) => o.id === req.shipping_origin_id || o.origin_id === req.shipping_origin_id);

  const productIds = (req.lines || []).map((l: any) => l.product_id);
  const { data: dbProducts } = await admin
    .from("products")
    .select(`
      id, price_usd_fob, price_additional_info, carton_pack_qty,
      product_images (storage_path, position)
    `)
    .in("id", productIds);

  const { getSignedFileUrl } = await import("@/lib/files/storage");
  const prodMap = new Map((dbProducts ?? []).map((p: any) => [p.id, p]));

  const enrichedLines = await Promise.all(
    (req.lines || []).map(async (line: any) => {
      const p = prodMap.get(line.product_id);
      let photoUrl: string | null = null;
      if (p && p.product_images && p.product_images.length > 0) {
        try {
          photoUrl = await getSignedFileUrl(p.product_images[0].storage_path);
        } catch {}
      }

      const adminOverrides = p?.price_additional_info?.admin_overrides || {};
      const rawTiers = adminOverrides.price_tiers || p?.price_additional_info?.price_tiers || [];
      const priceTiers = Array.isArray(rawTiers)
        ? rawTiers.map((t: any) => ({ qty: Number(t.qty), price: Number(t.price) }))
        : [];

      return {
        ...line,
        photo_url: photoUrl,
        carton_pack_qty: p?.carton_pack_qty || 1,
        price_tiers: priceTiers,
        base_fob: p?.price_usd_fob || line.reference_unit_cost,
        // Default admin final values to requested values if not yet set
        admin_final_qty: line.admin_final_qty !== null && line.admin_final_qty !== undefined ? line.admin_final_qty : line.requested_qty,
        admin_final_unit_cost: line.admin_final_unit_cost !== null && line.admin_final_unit_cost !== undefined ? line.admin_final_unit_cost : line.reference_unit_cost,
        admin_final_line_total: line.admin_final_line_total !== null && line.admin_final_line_total !== undefined ? line.admin_final_line_total : line.estimated_line_total,
      };
    })
  );

  const formatted = formatSingleRequest({
    ...req,
    shipping_origin_name: matchedOrigin?.name,
    shipping_origin_address: matchedOrigin ? [matchedOrigin.city, matchedOrigin.country].filter(Boolean).join(", ") : null,
    lines: enrichedLines,
  });

  return formatted;
}

/**
 * ADMIN: Transition status to UNDER_REVIEW
 */
export async function startReviewPoRequest(requestId: string): Promise<{ success: boolean }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const req = await getAdminPoRequestDetail(requestId);
  const now = new Date().toISOString();

  const historyEntry: PoRequestHistoryEntry = {
    id: crypto.randomUUID(),
    po_request_id: requestId,
    action: "REVIEW_STARTED",
    actor_id: session.userId,
    actor_name: "Admin",
    actor_role: "Letusto Admin",
    notes: "어드민 담당자 발주 요청 검토 시작",
    created_at: now,
  };

  try {
    await admin.from("po_requests").update({ status: "UNDER_REVIEW", reviewed_at: now, updated_at: now }).eq("id", requestId);
    await admin.from("po_request_history").insert(historyEntry);
  } catch (e) {}

  await saveRequestToMeta(req.company_id, {
    ...req,
    status: "UNDER_REVIEW",
    reviewed_at: now,
    updated_at: now,
    history: [historyEntry, ...(req.history || [])],
  });

  revalidatePath(`/admin/purchasing/requests/${requestId}`);
  revalidatePath("/admin/purchasing/requests");
  revalidatePath(`/portal/orders/requests/${requestId}`);
  revalidatePath("/portal/orders/requests");

  return { success: true };
}

/**
 * ADMIN: Request changes back to Portal (CHANGE_REQUESTED)
 */
export async function requestChangesPoRequest(requestId: string, reason: string): Promise<{ success: boolean }> {
  const session = await verifyAdminSession();
  if (!reason || !reason.trim()) {
    throw new Error("수정 요청 사유를 입력해 주세요.");
  }

  const admin = createAdminClient();
  const req = await getAdminPoRequestDetail(requestId);
  const now = new Date().toISOString();

  const historyEntry: PoRequestHistoryEntry = {
    id: crypto.randomUUID(),
    po_request_id: requestId,
    action: "CHANGE_REQUESTED",
    actor_id: session.userId,
    actor_name: "Admin",
    actor_role: "Letusto Admin",
    notes: `수정 요청 사유: ${reason.trim()}`,
    created_at: now,
  };

  try {
    await admin
      .from("po_requests")
      .update({
        status: "CHANGE_REQUESTED",
        change_request_reason: reason.trim(),
        updated_at: now,
      })
      .eq("id", requestId);
    await admin.from("po_request_history").insert(historyEntry);
  } catch (e) {}

  await saveRequestToMeta(req.company_id, {
    ...req,
    status: "CHANGE_REQUESTED",
    change_request_reason: reason.trim(),
    updated_at: now,
    history: [historyEntry, ...(req.history || [])],
  });

  revalidatePath(`/admin/purchasing/requests/${requestId}`);
  revalidatePath("/admin/purchasing/requests");
  revalidatePath(`/portal/orders/requests/${requestId}`);
  revalidatePath("/portal/orders/requests");

  return { success: true };
}

/**
 * ADMIN: Reject a PO Request (REJECTED)
 */
export async function rejectPoRequest(requestId: string, reason: string): Promise<{ success: boolean }> {
  const session = await verifyAdminSession();
  if (!reason || !reason.trim()) {
    throw new Error("반려 사유를 입력해 주세요.");
  }

  const admin = createAdminClient();
  const req = await getAdminPoRequestDetail(requestId);
  const now = new Date().toISOString();

  const historyEntry: PoRequestHistoryEntry = {
    id: crypto.randomUUID(),
    po_request_id: requestId,
    action: "REJECTED",
    actor_id: session.userId,
    actor_name: "Admin",
    actor_role: "Letusto Admin",
    notes: `반려 사유: ${reason.trim()}`,
    created_at: now,
  };

  try {
    await admin
      .from("po_requests")
      .update({
        status: "REJECTED",
        rejection_reason: reason.trim(),
        updated_at: now,
      })
      .eq("id", requestId);
    await admin.from("po_request_history").insert(historyEntry);
  } catch (e) {}

  await saveRequestToMeta(req.company_id, {
    ...req,
    status: "REJECTED",
    rejection_reason: reason.trim(),
    updated_at: now,
    history: [historyEntry, ...(req.history || [])],
  });

  revalidatePath(`/admin/purchasing/requests/${requestId}`);
  revalidatePath("/admin/purchasing/requests");
  revalidatePath(`/portal/orders/requests/${requestId}`);
  revalidatePath("/portal/orders/requests");

  return { success: true };
}

/**
 * ADMIN: Update Final Qty and Final Unit Price adjustments for line items
 */
export async function updateAdminRequestAdjustments(
  requestId: string,
  lineAdjustments: { id: string; admin_final_qty: number; admin_final_unit_cost: number }[]
): Promise<{ success: boolean }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();
  const req = await getAdminPoRequestDetail(requestId);
  const now = new Date().toISOString();

  const updatedLines = req.lines.map((line) => {
    const adj = lineAdjustments.find((a) => a.id === line.id);
    if (adj) {
      const finalQty = Number(adj.admin_final_qty);
      const finalCost = Number(adj.admin_final_unit_cost);
      return {
        ...line,
        admin_final_qty: finalQty,
        admin_final_unit_cost: finalCost,
        admin_final_line_total: finalQty * finalCost,
        updated_at: now,
      };
    }
    return line;
  });

  try {
    for (const adj of lineAdjustments) {
      const finalQty = Number(adj.admin_final_qty);
      const finalCost = Number(adj.admin_final_unit_cost);
      await admin
        .from("po_request_lines")
        .update({
          admin_final_qty: finalQty,
          admin_final_unit_cost: finalCost,
          admin_final_line_total: finalQty * finalCost,
          updated_at: now,
        })
        .eq("id", adj.id);
    }
  } catch (e) {}

  await saveRequestToMeta(req.company_id, {
    ...req,
    lines: updatedLines,
    updated_at: now,
  });

  revalidatePath(`/admin/purchasing/requests/${requestId}`);
  return { success: true };
}

/**
 * Link created Official PO to the PO Request and mark as CONVERTED_TO_PO
 */
export async function linkCreatedPoToRequest(
  requestId: string,
  poId: string,
  poNumber?: string
): Promise<{ success: boolean }> {
  const session = await verifyAdminSession();
  const admin = createAdminClient();
  const req = await getAdminPoRequestDetail(requestId);
  const now = new Date().toISOString();
  const effectivePoNumber = poNumber || poId;

  const historyEntry: PoRequestHistoryEntry = {
    id: crypto.randomUUID(),
    po_request_id: requestId,
    action: "CONVERTED_TO_PO",
    actor_id: session.userId,
    actor_name: "Admin",
    actor_role: "Letusto Admin",
    notes: `정식 발주서(${effectivePoNumber})로 전환 완료`,
    created_at: now,
  };

  try {
    await admin
      .from("po_requests")
      .update({
        status: "CONVERTED_TO_PO",
        converted_po_id: poId,
        converted_po_number: poNumber,
        converted_at: now,
        updated_at: now,
      })
      .eq("id", requestId);
    await admin.from("po_request_history").insert(historyEntry);
  } catch (e) {}

  await saveRequestToMeta(req.company_id, {
    ...req,
    status: "CONVERTED_TO_PO",
    converted_po_id: poId,
    converted_po_number: poNumber,
    converted_at: now,
    updated_at: now,
    history: [historyEntry, ...(req.history || [])],
  });

  revalidatePath(`/admin/purchasing/requests/${requestId}`);
  revalidatePath("/admin/purchasing/requests");
  revalidatePath(`/portal/orders/requests/${requestId}`);
  revalidatePath("/portal/orders/requests");

  return { success: true };
}

// Helpers for formatting response objects
function formatRequests(rawList: any[]): PoRequestDetail[] {
  return rawList.map(formatSingleRequest);
}

function formatSingleRequest(r: any): PoRequestDetail {
  const lines: PoRequestLine[] = (r.lines || []).map((l: any) => ({
    id: l.id,
    po_request_id: l.po_request_id || r.id,
    product_id: l.product_id,
    product_name_snapshot: l.product_name_snapshot || l.product_name || "제품",
    letusto_sku_snapshot: l.letusto_sku_snapshot || l.letusto_sku || null,
    manufacture_sku_snapshot: l.manufacture_sku_snapshot || l.manufacture_sku || null,
    requested_qty: Number(l.requested_qty || 0),
    reference_unit_cost: Number(l.reference_unit_cost || 0),
    estimated_line_total: Number(l.estimated_line_total || Number(l.requested_qty || 0) * Number(l.reference_unit_cost || 0)),
    admin_final_qty: l.admin_final_qty !== null && l.admin_final_qty !== undefined ? Number(l.admin_final_qty) : Number(l.requested_qty || 0),
    admin_final_unit_cost: l.admin_final_unit_cost !== null && l.admin_final_unit_cost !== undefined ? Number(l.admin_final_unit_cost) : Number(l.reference_unit_cost || 0),
    admin_final_line_total: l.admin_final_line_total !== null && l.admin_final_line_total !== undefined ? Number(l.admin_final_line_total) : Number(l.requested_qty || 0) * Number(l.reference_unit_cost || 0),
    line_note: l.line_note || null,
    photo_url: l.photo_url || null,
    carton_pack_qty: l.carton_pack_qty || 1,
    price_tiers: l.price_tiers || [],
    base_fob: l.base_fob || l.reference_unit_cost,
  }));

  const totalRequestedQty = lines.reduce((sum, l) => sum + l.requested_qty, 0);
  const totalEstimatedAmount = lines.reduce((sum, l) => sum + l.estimated_line_total, 0);
  const totalFinalQty = lines.reduce((sum, l) => sum + (l.admin_final_qty || l.requested_qty), 0);
  const totalFinalAmount = lines.reduce((sum, l) => sum + (l.admin_final_line_total || l.estimated_line_total), 0);

  const history: PoRequestHistoryEntry[] = (r.history || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return {
    id: r.id,
    request_number: r.request_number || "PR-PENDING",
    company_id: r.company_id,
    company_name: r.company?.name || r.company_name || "(회사명 미확인)",
    contact_user_id: r.contact_user_id || null,
    contact_name: r.contact_name || null,
    contact_email: r.contact_email || null,
    shipping_origin_id: r.shipping_origin_id || null,
    shipping_origin_name: r.shipping_origin_name || null,
    shipping_origin_address: r.shipping_origin_address || null,
    requested_ready_date: r.requested_ready_date || null,
    status: r.status || "DRAFT",
    notes: r.notes || null,
    admin_review_notes: r.admin_review_notes || null,
    change_request_reason: r.change_request_reason || null,
    rejection_reason: r.rejection_reason || null,
    converted_po_id: r.converted_po_id || null,
    converted_po_number: r.converted_po_number || null,
    submitted_at: r.submitted_at || null,
    reviewed_at: r.reviewed_at || null,
    converted_at: r.converted_at || null,
    created_by: r.created_by || null,
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
    lines,
    history,
    total_requested_qty: totalRequestedQty,
    total_estimated_amount: totalEstimatedAmount,
    total_final_qty: totalFinalQty,
    total_final_amount: totalFinalAmount,
  };
}
