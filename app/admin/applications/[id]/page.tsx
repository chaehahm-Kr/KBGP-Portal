import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { reviewApplicationProduct } from "@/lib/application/review-actions";
import { createInfoRequest } from "@/lib/application/info-request-actions";
import { assignApplication } from "@/lib/application/assignment-actions";
import { canReviewApplication } from "@/lib/application/assignment-dal";
import {
  addReviewNote,
  deleteReviewNote,
} from "@/lib/application/review-note-actions";
import { getSignedFileUrl } from "@/lib/files/storage";
import { deleteApplicationAction } from "@/lib/application/actions";
import {
  approveAndInviteApplication,
  rejectApplication,
  resendApplicationInvitation,
  revokeApplicationInvitation,
  resendApplicationRejectionEmail,
} from "@/lib/application/invitation-actions";
import ApplicationWorkspace from "@/components/application/application-workspace";

export const metadata: Metadata = {
  title: "신청서 상세 | K SELECT NETWORK 어드민",
};

export default async function AdminApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifyAdminSession();
  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select(
      "id, application_number, partner_type, entry_mode, status, company_id, onboarded_company_id, invitation_id, applicant_company_name, applicant_contact_name, applicant_contact_email, applicant_contact_phone, applicant_address, review_notes, motivation_note, self_check_answers, eligibility_responses, submitted_at, created_at"
    )
    .eq("id", id)
    .single();

  if (!application || application.status === "draft" || application.status === "deleted") {
    notFound();
  }

  let company: any = null;
  if (application.company_id) {
    const { data: cData } = await supabase
      .from("companies")
      .select("id, name, business_registration_number, country, intro, contact_name, contact_phone")
      .eq("id", application.company_id)
      .maybeSingle();
    company = cData;
  }

  let inquiry: any = null;
  if (application.application_number) {
    const { data: inqData } = await supabase
      .from("inquiries")
      .select("id, application_number, brand_name, homepage, company_address, contact_title, products, raw_payload")
      .eq("application_number", application.application_number)
      .maybeSingle();
    inquiry = inqData;
  }

  let brands: any[] = [];
  if (application.company_id) {
    const { data: bData } = await supabase
      .from("brands")
      .select("id, name, website, description, logo_url")
      .eq("company_id", application.company_id);
    brands = bData ?? [];
  }

  let companyUsers: any[] = [];
  if (application.company_id) {
    const { data: cuData } = await supabase
      .from("company_users")
      .select("id, name, email, status, company_role, title, position, phone, is_primary, permissions, invited_at")
      .eq("company_id", application.company_id)
      .order("created_at", { ascending: true });
    companyUsers = cuData ?? [];
  }

  const { data: links } = await supabase
    .from("application_products")
    .select("id, product_id, review_status, review_reason")
    .eq("application_id", id);

  const linkRows = links ?? [];
  const productIds = linkRows.map((l) => l.product_id);

  const { data: productRows } = productIds.length
    ? await supabase
        .from("products")
        .select(
          "id, brand_id, company_id, name, category, volume, estimated_retail_price, ingredients_text, status, package_width, package_depth, package_height, package_weight, lead_time, created_at"
        )
        .in("id", productIds)
    : { data: [] };
  const productNameById = new Map((productRows ?? []).map((p) => [p.id, p.name]));

  const { data: productImages } = productIds.length
    ? await supabase
        .from("product_images")
        .select("id, product_id, file_path, file_name, file_size, sort_order")
        .in("product_id", productIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const productImagesWithSignedUrls = await Promise.all(
    (productImages ?? []).map(async (img) => {
      let signedUrl = null;
      if (img.file_path) {
        signedUrl = await getSignedFileUrl(img.file_path, 7200, "company-uploads", {
          download: img.file_name || true,
        });
      }
      return {
        ...img,
        signedUrl,
      };
    })
  );

  const inquiryProducts = Array.isArray(inquiry?.products) ? inquiry.products : [];

  const submittedProducts = (productRows ?? []).map((p, idx) => {
    const link = linkRows.find((l) => l.product_id === p.id);
    const inqP = inquiryProducts[idx] || inquiryProducts.find((ip: any) => ip.name === p.name) || null;
    const images = productImagesWithSignedUrls.filter((img) => img.product_id === p.id);

    return {
      id: p.id,
      linkId: link?.id || null,
      reviewStatus: link?.review_status || "pending",
      reviewReason: link?.review_reason || null,
      name: p.name,
      category: p.category || inqP?.category || "",
      volume: p.volume || inqP?.volume || null,
      retailPriceKrw:
        p.estimated_retail_price ??
        (inqP?.priceKrw ? Number(String(inqP.priceKrw).replace(/[^0-9]/g, "")) : null),
      targetSupplyPriceUsd:
        inqP?.targetSupplyPriceUsd ?? inqP?.supplyPriceUsd ?? inqP?.supply_price ?? null,
      packageWidth: p.package_width ?? inqP?.packageWidth ?? null,
      packageDepth: p.package_depth ?? inqP?.packageDepth ?? null,
      packageHeight: p.package_height ?? inqP?.packageHeight ?? null,
      dimensionUnit: inqP?.dimensionUnit || "cm",
      packageWeight: p.package_weight ?? inqP?.packageWeight ?? null,
      weightUnit: inqP?.weightUnit || "g",
      monthlyCapacity: inqP?.monthlyCapacity ?? inqP?.monthly_capacity ?? null,
      leadTime: p.lead_time || inqP?.leadTime || inqP?.lead_time || null,
      description: p.ingredients_text || inqP?.note || inqP?.description || null,
      images: images.map((img) => ({
        id: img.id,
        fileName: img.file_name || "첨부파일",
        fileSize: img.file_size || null,
        url: img.signedUrl,
      })),
    };
  });

  if (submittedProducts.length === 0 && inquiryProducts.length > 0) {
    inquiryProducts.forEach((inqP: any, idx: number) => {
      submittedProducts.push({
        id: `inq-${idx}`,
        linkId: null,
        reviewStatus: "pending",
        reviewReason: null,
        name: inqP.name,
        category: inqP.category || "",
        volume: inqP.volume || null,
        retailPriceKrw: inqP.priceKrw ? Number(String(inqP.priceKrw).replace(/[^0-9]/g, "")) : null,
        targetSupplyPriceUsd:
          inqP.targetSupplyPriceUsd ?? inqP.supplyPriceUsd ?? inqP.supply_price ?? null,
        packageWidth: inqP.packageWidth ?? null,
        packageDepth: inqP.packageDepth ?? null,
        packageHeight: inqP.packageHeight ?? null,
        dimensionUnit: inqP.dimensionUnit || "cm",
        packageWeight: inqP.packageWeight ?? null,
        weightUnit: inqP.weightUnit || "g",
        monthlyCapacity: inqP.monthlyCapacity ?? inqP.monthly_capacity ?? null,
        leadTime: inqP.leadTime || inqP.lead_time || null,
        description: inqP.note || inqP.description || null,
        images: [],
      });
    });
  }

  const { data: infoRequests } = await supabase
    .from("additional_info_requests")
    .select(
      "id, product_id, request_content, requested_at, reply_content, reply_attachment_path, status, replied_at, reply_due_at"
    )
    .eq("application_id", id)
    .order("requested_at", { ascending: false });

  const infoRequestRows = infoRequests ?? [];
  const infoRequestAttachmentUrls = await Promise.all(
    infoRequestRows.map((r) =>
      r.reply_attachment_path ? getSignedFileUrl(r.reply_attachment_path) : Promise.resolve(null)
    )
  );

  const { data: staffMembers } = await supabase
    .from("staff_members")
    .select("id, name, email")
    .eq("status", "active");

  const { data: currentAssignment } = await supabase
    .from("assignments")
    .select("staff_id")
    .eq("application_id", id)
    .eq("is_current", true)
    .maybeSingle();

  const staffNameById = new Map(
    (staffMembers ?? []).map((s) => [s.id, s.name || s.email])
  );

  const { data: reviewNotes } = await supabase
    .from("review_notes")
    .select("id, application_product_id, author_id, content, created_at")
    .eq("application_id", id)
    .order("created_at", { ascending: false });

  const reviewNoteRows = reviewNotes ?? [];
  const canReview = await canReviewApplication(id, session.userId);

  const { data: staff } = await supabase
    .from("staff_members")
    .select("base_role")
    .eq("id", session.userId)
    .maybeSingle();
  const baseRole = staff?.base_role || "reviewer";
  const isSuperAdmin = baseRole === "super_admin";
  const canDelete = baseRole === "super_admin" || baseRole === "admin";

  const activityEntityIds = [id, ...linkRows.map((l) => l.id)];
  const { data: activityLogs } = await supabase
    .from("activity_logs")
    .select("id, entity_id, entity_type, before_state, after_state, changed_by, reason, created_at")
    .in("entity_id", activityEntityIds)
    .order("created_at", { ascending: false });

  const activityLogRows = activityLogs ?? [];

  return (
    <ApplicationWorkspace
      application={application}
      company={company}
      companyUsers={companyUsers}
      brands={brands}
      inquiry={inquiry}
      submittedProducts={submittedProducts}
      linkRows={linkRows}
      productNameById={productNameById}
      infoRequestRows={infoRequestRows}
      infoRequestAttachmentUrls={infoRequestAttachmentUrls}
      staffMembers={(staffMembers ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
      }))}
      currentAssignment={currentAssignment}
      staffNameById={staffNameById}
      reviewNoteRows={reviewNoteRows}
      activityLogRows={activityLogRows}
      canReview={canReview}
      isSuperAdmin={isSuperAdmin}
      canDelete={canDelete}
      userId={session.userId}
      reviewAction={reviewApplicationProduct}
      assignAction={assignApplication.bind(null, id)}
      noteAddAction={addReviewNote.bind(null, id)}
      noteDeleteAction={deleteReviewNote}
      infoRequestAction={createInfoRequest.bind(null, id)}
      deleteAction={deleteApplicationAction}
      approveAndInviteAction={approveAndInviteApplication.bind(null, id)}
      rejectAppAction={rejectApplication.bind(null, id)}
      resendInviteAction={resendApplicationInvitation.bind(null, id)}
      revokeInviteAction={revokeApplicationInvitation.bind(null, id)}
      resendRejectionAction={resendApplicationRejectionEmail.bind(null, id)}
    />
  );
}
