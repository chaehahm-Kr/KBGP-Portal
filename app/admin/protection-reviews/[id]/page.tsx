import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminProtectionReviewDetail } from "@/lib/protection/admin-actions";
import { AdminProtectionReviewDetail } from "@/components/admin/protection-review-detail";

interface AdminProtectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Initial Trial Review Detail | K SELECT NETWORK Admin",
};

export default async function AdminProtectionDetailPage({
  params,
}: AdminProtectionDetailPageProps) {
  await verifyAdminSession();
  const { id } = await params;

  const { review, error } = await getAdminProtectionReviewDetail(id);

  if (error) {
    return (
      <div className="w-full py-12 px-4">
        <div className="rounded-3xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/50 text-red-600 flex items-center justify-center text-xl mx-auto">
            ⚠️
          </div>
          <h2 className="text-base font-bold text-red-900 dark:text-red-200">
            Failed to Load Initial Trial Review
          </h2>
          <p className="text-xs text-red-700 dark:text-red-300 max-w-md mx-auto">
            {error}
          </p>
          <div className="pt-2">
            <Link
              href="/admin/protection-reviews"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
            >
              ← Back to Initial Trial Reviews
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!review) {
    notFound();
  }

  return <AdminProtectionReviewDetail review={review} />;
}
