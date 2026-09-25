"use server";

import { revalidatePath } from "next/cache";
import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notification/actions";
import { validateUploadedFile } from "@/lib/files/validate";
import { getSignedFileUrl } from "@/lib/files/storage";
import type {
  CaseStatus,
  MessageType,
  InquiryMessageItem,
  PartnerInquiryItem,
} from "@/lib/inquiry/types";
import { ALL_CASE_CATEGORY_LABELS } from "@/lib/inquiry/types";

export interface RetailerStoreItem {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
}

export interface RetailerOrderItem {
  id: string;
  orderNumber: string;
  orderStatus: string;
  storeId?: string | null;
  totalAmount: number;
  createdAt: string;
}

export interface RetailerProductItem {
  id: string;
  name: string;
  nameEn?: string | null;
  brandName?: string | null;
  sku: string;
}

export interface RetailerCaseContext {
  stores: RetailerStoreItem[];
  orders: RetailerOrderItem[];
  products: RetailerProductItem[];
  protections: any[];
}

function extensionFor(mime: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  return "bin";
}

/**
 * Fetch threaded messages for a retailer inquiry
 */
async function getMessagesForInquiry(
  supabase: any,
  item: any,
  defaultSenderName: string
): Promise<InquiryMessageItem[]> {
  try {
    const { data: dbMessages, error: msgError } = await supabase
      .from("partner_inquiry_messages")
      .select("*")
      .eq("inquiry_id", item.id)
      .order("created_at", { ascending: true });

    if (msgError || !dbMessages || dbMessages.length === 0) {
      const fallback: InquiryMessageItem[] = [
        {
          id: "initial-" + item.id,
          senderType: item.created_source === "admin" ? "admin" : "partner",
          senderName: item.created_source === "admin" ? "K SELECT Support" : defaultSenderName,
          content: item.content,
          messageType: "message",
          isActionFlag: Boolean(item.is_action_required),
          attachmentUrl: item.attachment_url || null,
          attachmentFilename: item.attachment_filename || null,
          createdAt: item.created_at,
        },
      ];
      if (item.reply_content) {
        fallback.push({
          id: "reply-" + item.id,
          senderType: "admin",
          senderName: "K SELECT Support",
          content: item.reply_content,
          messageType: item.is_action_required ? "action_required" : "message",
          isActionFlag: Boolean(item.is_action_required),
          attachmentUrl: null,
          attachmentFilename: null,
          createdAt: item.replied_at || item.created_at,
        });
      }
      return fallback;
    }

    const result: InquiryMessageItem[] = [];

    // Check if initial message exists
    const hasInitial = dbMessages.some((m: any) => m.content === item.content);
    if (!hasInitial) {
      result.push({
        id: "initial-" + item.id,
        senderType: item.created_source === "admin" ? "admin" : "partner",
        senderName: item.created_source === "admin" ? "K SELECT Support" : defaultSenderName,
        content: item.content,
        messageType: "message",
        isActionFlag: Boolean(item.is_action_required),
        attachmentUrl: item.attachment_url || null,
        attachmentFilename: item.attachment_filename || null,
        createdAt: item.created_at,
      });
    }

    for (const m of dbMessages) {
      let attachmentUrl = null;
      if (m.attachment_path) {
        attachmentUrl = await getSignedFileUrl(m.attachment_path);
      }
      result.push({
        id: m.id,
        senderType: m.sender_type as "partner" | "admin" | "system",
        senderName: m.sender_type === "admin" ? "K SELECT Support" : (m.sender_name || defaultSenderName),
        content: m.content,
        messageType: (m.message_type || "message") as MessageType,
        isActionFlag: Boolean(m.is_action_flag),
        attachmentUrl,
        attachmentFilename: m.attachment_filename,
        createdAt: m.created_at,
      });
    }

    return result;
  } catch (e) {
    return [];
  }
}

/**
 * Fetch all Support Inquiries for the authenticated Retailer Company
 */
export async function getRetailerSupportInquiries(): Promise<PartnerInquiryItem[]> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    // 1. Fetch Company & Role
    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id, name")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) return [];

    const { data: userRoleRow } = await adminClient
      .from("retailer_user_roles")
      .select("role, has_all_stores_access")
      .eq("user_id", session.userId)
      .eq("company_id", companyId)
      .maybeSingle();

    const userRole = userRoleRow?.role || "employee";
    const hasAllStoresAccess = userRoleRow?.has_all_stores_access ?? (userRole === "owner");

    // 2. Fetch Assigned Store IDs if restricted
    let storeIds: string[] = [];
    if (!hasAllStoresAccess && userRole !== "owner" && userRole !== "buyer") {
      const { data: assigned } = await adminClient
        .from("retailer_user_store_access")
        .select("store_id")
        .eq("user_id", session.userId)
        .eq("company_id", companyId);
      storeIds = (assigned || []).map((a) => a.store_id);
    }

    // 3. Query Inquiries
    let query = adminClient
      .from("partner_inquiries")
      .select(`
        *,
        companies ( name ),
        stores ( id, name, city ),
        retailer_orders:related_order_id ( id, order_number ),
        retailer_order_fulfillments:related_fulfillment_id ( id, fulfillment_number, tracking_number ),
        products:related_product_id ( id, name, name_en, letusto_sku, manufacture_sku )
      `)
      .eq("company_id", companyId)
      .eq("source_type", "retailer")
      .order("updated_at", { ascending: false });

    // Store restriction: if employee/store_manager with limited stores, filter store_id in storeIds or store_id is null
    if (!hasAllStoresAccess && userRole !== "owner" && userRole !== "buyer" && storeIds.length > 0) {
      // In supabase postgREST, store_id.in.(...) or store_id.is.null
      query = query.or(`store_id.in.(${storeIds.join(",")}),store_id.is.null`);
    }

    // Protect confidential financial/payment cases from non-accounting, non-owner/buyer employees
    if (userRole === "employee") {
      query = query.neq("category", "payment_terms");
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error("Error fetching retailer support inquiries:", error);
      return [];
    }

    // Map items
    const items: PartnerInquiryItem[] = await Promise.all(
      data.map(async (item: any) => {
        let attachmentUrl = null;
        if (item.attachment_path) {
          attachmentUrl = await getSignedFileUrl(item.attachment_path);
        }

        const messages = await getMessagesForInquiry(
          adminClient,
          { ...item, attachment_url: attachmentUrl },
          companyUser?.name || "Retailer Member"
        );

        const store = item.stores;
        const order = item.retailer_orders;
        const ful = item.retailer_order_fulfillments;
        const prod = item.products;

        return {
          id: item.id,
          company_id: item.company_id,
          created_by: item.created_by,
          category: item.category,
          title: item.title,
          content: item.content,
          attachment_path: item.attachment_path,
          attachment_filename: item.attachment_filename,
          attachment_url: attachmentUrl,
          case_number: item.case_number,
          status: item.status as CaseStatus,
          source_type: "retailer",
          reply_content: item.reply_content,
          replied_by: item.replied_by,
          replied_at: item.replied_at,
          is_action_required: Boolean(item.is_action_required),
          closed_at: item.closed_at,
          closed_by: item.closed_by,
          closed_by_side: item.closed_by_side,
          created_source: item.created_source,
          priority: item.priority || "normal",
          created_at: item.created_at,
          updated_at: item.updated_at,
          companyName: item.companies?.name || "Retailer",
          store_id: item.store_id,
          store_name: store?.name || null,
          related_order_id: item.related_order_id,
          related_order_number: order?.order_number || null,
          related_fulfillment_id: item.related_fulfillment_id,
          related_fulfillment_number: ful?.fulfillment_number || null,
          related_product_id: item.related_product_id,
          related_product_name: prod?.name || null,
          related_product_sku: prod?.letusto_sku || prod?.manufacture_sku || null,
          related_protection_id: item.related_protection_id,
          messages,
        };
      })
    );

    return items;
  } catch (err) {
    console.error("Failed in getRetailerSupportInquiries:", err);
    return [];
  }
}

/**
 * Fetch creation context (accessible stores, recent orders, active products, protections)
 */
export async function getRetailerCaseCreationContext() {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return { stores: [], orders: [], products: [], protections: [] };
    }

    // 1. Fetch Stores
    const { data: stores } = await adminClient
      .from("stores")
      .select("id, name, city, state")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    // 2. Fetch Recent Orders
    const { data: orders } = await adminClient
      .from("retailer_orders")
      .select("id, order_number, order_status, store_id, total_amount, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Fetch Curated Selling Products
    const { data: products } = await adminClient
      .from("products")
      .select("id, name, name_en, letusto_sku, manufacture_sku, brands(name)")
      .eq("status", "selling")
      .order("name", { ascending: true })
      .limit(50);

    // 4. Fetch 90-Day Initial Protections
    const { data: protections } = await adminClient
      .from("retailer_initial_trial_protections")
      .select("id, store_id, product_id, status, trial_start_date, trial_end_date")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      stores: stores || [],
      orders: (orders || []).map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        orderStatus: o.order_status,
        storeId: o.store_id,
        totalAmount: Number(o.total_amount || 0),
        createdAt: o.created_at,
      })),
      products: (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        nameEn: p.name_en,
        brandName: p.brands?.name || "K SELECT",
        sku: p.letusto_sku || p.manufacture_sku || "KS-SKU",
      })),
      protections: protections || [],
    };
  } catch (err) {
    console.error("Error fetching retailer case creation context:", err);
    return { stores: [], orders: [], products: [], protections: [] };
  }
}

/**
 * Create a new Retailer Support Inquiry Case
 */
export async function createRetailerSupportInquiryAction(formData: FormData): Promise<{
  success: boolean;
  caseNumber?: string;
  error?: string;
}> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("company_id, name")
      .eq("id", session.userId)
      .maybeSingle();

    const companyId = companyUser?.company_id;
    if (!companyId) {
      return { success: false, error: "Authenticated company not found." };
    }

    const category = String(formData.get("category") || "general").trim();
    const title = String(formData.get("title") || "").trim();
    const content = String(formData.get("content") || "").trim();
    const storeId = (formData.get("store_id") as string)?.trim() || null;
    const relatedOrderId = (formData.get("related_order_id") as string)?.trim() || null;
    const relatedProductId = (formData.get("related_product_id") as string)?.trim() || null;
    const relatedProtectionId = (formData.get("related_protection_id") as string)?.trim() || null;
    const file = formData.get("file");

    if (!title) return { success: false, error: "Please enter a subject title." };
    if (!content) return { success: false, error: "Please enter your message details." };

    let attachmentPath = null;
    let attachmentFilename = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > 20 * 1024 * 1024) {
        return { success: false, error: "Attachment file exceeds maximum 20MB limit." };
      }

      const validation = await validateUploadedFile(file, ["image", "document"]);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      const path = `${companyId}/inquiries/${crypto.randomUUID()}.${extensionFor(validation.detectedMime)}`;
      const { error: uploadError } = await adminClient.storage
        .from("company-uploads")
        .upload(path, file, { contentType: validation.detectedMime });

      if (uploadError) {
        console.error("Failed to upload retailer inquiry attachment:", uploadError);
        return { success: false, error: "Failed to upload attachment file." };
      }

      attachmentPath = path;
      attachmentFilename = file.name;
    }

    const insertPayload: any = {
      company_id: companyId,
      created_by: session.userId,
      source_type: "retailer",
      category,
      title,
      content,
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
      status: "open",
      is_action_required: false,
      created_source: "portal",
      priority: "normal",
      store_id: storeId,
      related_order_id: relatedOrderId,
      related_product_id: relatedProductId,
      related_protection_id: relatedProtectionId,
    };

    const { data: newInquiry, error: insertError } = await adminClient
      .from("partner_inquiries")
      .insert(insertPayload)
      .select("id, case_number")
      .single();

    if (insertError || !newInquiry) {
      console.error("Failed to insert retailer inquiry:", insertError);
      return { success: false, error: "Failed to create support inquiry. Please try again." };
    }

    // Insert Initial Message into thread
    await adminClient.from("partner_inquiry_messages").insert({
      inquiry_id: newInquiry.id,
      sender_type: "partner",
      sender_id: session.userId,
      sender_name: companyUser?.name || "Retailer Member",
      content,
      attachment_path: attachmentPath,
      attachment_filename: attachmentFilename,
      message_type: "message",
      is_action_flag: false,
    });

    // Notify Active Admin Staff
    const [{ data: company }, { data: staffMembers }] = await Promise.all([
      adminClient.from("companies").select("name").eq("id", companyId).maybeSingle(),
      adminClient.from("staff_members").select("id").eq("status", "active"),
    ]);

    const catInfo = ALL_CASE_CATEGORY_LABELS[category] || { en: category, ko: category };
    for (const staff of staffMembers ?? []) {
      await createNotification(
        staff.id,
        session.userId,
        `[Retailer Support] ${newInquiry.case_number || "New Case"}`,
        `[${company?.name || "Retailer"}] has submitted a support case (${catInfo.en}): "${title}"`,
        "/admin/partner-inquiries"
      );
    }

    revalidatePath("/retailer/support");
    revalidatePath("/support");
    revalidatePath("/admin/partner-inquiries");

    return { success: true, caseNumber: newInquiry.case_number || "CASE" };
  } catch (err: any) {
    console.error("createRetailerSupportInquiryAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Add a reply to an existing Support Case
 */
export async function addRetailerInquiryReplyAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await verifyRetailerSession();
    const adminClient = createAdminClient();

    const inquiryId = String(formData.get("inquiry_id") || "").trim();
    const content = String(formData.get("content") || "").trim();
    const file = formData.get("file");

    if (!inquiryId) return { success: false, error: "Inquiry ID missing." };
    if (!content) return { success: false, error: "Please enter your reply message." };

    // Verify ownership and closed status
    const { data: inquiry, error: inqErr } = await adminClient
      .from("partner_inquiries")
      .select("id, company_id, status, case_number, title")
      .eq("id", inquiryId)
      .maybeSingle();

    if (inqErr || !inquiry) {
      return { success: false, error: "Support case not found." };
    }

    if (inquiry.status === "closed" || inquiry.status === "resolved") {
      return {
        success: false,
        error: "This case has been closed and is read-only. Please create a new inquiry if you need further assistance.",
      };
    }

    let attachmentPath = null;
    let attachmentFilename = null;

    if (file instanceof File && file.size > 0) {
      if (file.size > 20 * 1024 * 1024) {
        return { success: false, error: "Attachment file exceeds maximum 20MB limit." };
      }

      const validation = await validateUploadedFile(file, ["image", "document"]);
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      const path = `${inquiry.company_id}/inquiries/${crypto.randomUUID()}.${extensionFor(validation.detectedMime)}`;
      const { error: uploadError } = await adminClient.storage
        .from("company-uploads")
        .upload(path, file, { contentType: validation.detectedMime });

      if (uploadError) {
        return { success: false, error: "Failed to upload attachment file." };
      }

      attachmentPath = path;
      attachmentFilename = file.name;
    }

    const { data: companyUser } = await adminClient
      .from("company_users")
      .select("name")
      .eq("id", session.userId)
      .maybeSingle();

    // 1. Insert Reply Message
    const { error: msgErr } = await adminClient
      .from("partner_inquiry_messages")
      .insert({
        inquiry_id: inquiry.id,
        sender_type: "partner",
        sender_id: session.userId,
        sender_name: companyUser?.name || "Retailer Member",
        content,
        attachment_path: attachmentPath,
        attachment_filename: attachmentFilename,
        message_type: "message",
        is_action_flag: false,
      });

    if (msgErr) {
      console.error("Error inserting inquiry message:", msgErr);
      return { success: false, error: "Failed to post message." };
    }

    // 2. Update Inquiry Status back to 'open' / 'in_review' if it was awaiting_reply or action_required
    await adminClient
      .from("partner_inquiries")
      .update({
        status: "in_review",
        is_action_required: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inquiry.id);

    // 3. Notify Admin Staff
    const { data: staffMembers } = await adminClient
      .from("staff_members")
      .select("id")
      .eq("status", "active");

    for (const staff of staffMembers ?? []) {
      await createNotification(
        staff.id,
        session.userId,
        `[Retailer Reply] ${inquiry.case_number || "Case"}`,
        `Retailer customer replied on case "${inquiry.title}"`,
        "/admin/partner-inquiries"
      );
    }

    revalidatePath("/retailer/support");
    revalidatePath("/support");
    revalidatePath("/admin/partner-inquiries");

    return { success: true };
  } catch (err: any) {
    console.error("addRetailerInquiryReplyAction error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
