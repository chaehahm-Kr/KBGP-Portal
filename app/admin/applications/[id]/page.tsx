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
      "id, application_number, status, company_id, motivation_note, self_check_answers, submitted_at"
    )
    .eq("id", id)
    .single();

  if (!application || application.status === "draft") {
    notFound();
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, business_registration_number, country")
    .eq("id", application.company_id)
    .single();

  const { data: links } = await supabase
    .from("application_products")
    .select("id, product_id, review_status, review_reason")
    .eq("application_id", id);

  const linkRows = links ?? [];
  const productIds = linkRows.map((l) => l.product_id);

  const { data: productRows } = productIds.length
    ? await supabase.from("products").select("id, name").in("id", productIds)
    : { data: [] };
  const productNameById = new Map((productRows ?? []).map((p) => [p.id, p.name]));

  const { data: infoRequests } = await supabase
    .from("additional_info_requests")
    .select(
      "id, product_id, request_content, requested_at, reply_content, reply_attachment_path, status, replied_at"
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

  const { data: callerRoles } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("staff_id", session.userId);
  const isSuperAdmin = (callerRoles ?? []).some((r) => r.role === "super_admin");

  const activityEntityIds = [id, ...linkRows.map((l) => l.id)];
  const { data: activityLogs } = await supabase
    .from("activity_logs")
    .select("id, entity_type, before_state, after_state, changed_by, reason, created_at")
    .in("entity_id", activityEntityIds)
    .order("created_at", { ascending: false });

  const activityLogRows = activityLogs ?? [];

  return (
    <ApplicationWorkspace
      application={application}
      company={company}
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
      userId={session.userId}
      reviewAction={reviewApplicationProduct}
      assignAction={assignApplication.bind(null, id)}
      noteAddAction={addReviewNote.bind(null, id)}
      noteDeleteAction={deleteReviewNote}
      infoRequestAction={createInfoRequest.bind(null, id)}
    />
  );
}
