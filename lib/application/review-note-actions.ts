"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReviewNoteFormState = { error: string } | undefined;

/**
 * 08_주요화면과AC.md 화면 11(내부 메모). 작성은 내부 직원 누구나 가능하다.
 * 작성자·작성 시각은 자동 기록되고 수정 기능은 없다 — "신뢰성 있는 이력을 위해
 * 수정이 아닌 추가만 가능, 오류 정정 시 새 메모로 정정 사실을 남긴다"는 AC를
 * 그대로 따른다(그래서 updateReviewNote 같은 함수는 의도적으로 만들지 않았다).
 *
 * review_notes 테이블은 admin만 select 가능하므로(0007 마이그레이션), 회사 측 화면·
 * API 어디에도 이 데이터를 노출할 경로가 없다.
 */
export async function addReviewNote(
  applicationId: string,
  _prevState: ReviewNoteFormState,
  formData: FormData
): Promise<ReviewNoteFormState> {
  const session = await verifyAdminSession();

  const content = String(formData.get("content") ?? "").trim();
  const applicationProductId = String(formData.get("applicationProductId") ?? "");

  if (!content) {
    return { error: "메모 내용을 입력해주세요." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("review_notes").insert({
    application_id: applicationId,
    application_product_id: applicationProductId || null,
    author_id: session.userId,
    content,
  });

  if (error) {
    return { error: "메모를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath(`/admin/applications/${applicationId}`);
}

/**
 * "삭제는 작성자 본인 또는 Super Admin만(다른 사람 메모를 함부로 지울 수 없게)".
 */
export async function deleteReviewNote(noteId: string, applicationId: string) {
  const session = await verifyAdminSession();
  const admin = createAdminClient();

  const { data: note } = await admin
    .from("review_notes")
    .select("author_id")
    .eq("id", noteId)
    .single();

  if (!note) return;

  if (note.author_id !== session.userId) {
    const { data: roles } = await admin
      .from("staff_roles")
      .select("role")
      .eq("staff_id", session.userId);
    const isSuperAdmin = (roles ?? []).some((r) => r.role === "super_admin");

    if (!isSuperAdmin) {
      throw new Error("본인이 작성한 메모이거나 Super Admin만 삭제할 수 있습니다.");
    }
  }

  await admin.from("review_notes").delete().eq("id", noteId);
  revalidatePath(`/admin/applications/${applicationId}`);
}
