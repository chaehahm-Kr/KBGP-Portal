import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminProtectionReviews } from "@/lib/protection/admin-actions";
import { AdminProtectionReviewsList } from "@/components/admin/protection-reviews-list";

export const metadata: Metadata = {
  title: "Initial Trial Reviews | K SELECT NETWORK Admin",
};

export default async function AdminProtectionReviewsPage() {
  await verifyAdminSession();

  const { reviews, counts, error } = await getAdminProtectionReviews();

  return (
    <div className="space-y-6">
      <AdminProtectionReviewsList
        initialReviews={reviews}
        initialCounts={counts}
        queryError={error}
      />
    </div>
  );
}
