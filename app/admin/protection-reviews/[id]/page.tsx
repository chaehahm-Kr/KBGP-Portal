import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminProtectionReviewDetail } from "@/lib/protection/admin-actions";
import { AdminProtectionReviewDetail } from "@/components/admin/protection-review-detail";

interface AdminProtectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Protection Review Detail | K SELECT NETWORK Admin",
};

export default async function AdminProtectionDetailPage({
  params,
}: AdminProtectionDetailPageProps) {
  await verifyAdminSession();
  const { id } = await params;

  const review = await getAdminProtectionReviewDetail(id);

  if (!review) {
    notFound();
  }

  return <AdminProtectionReviewDetail review={review} />;
}
