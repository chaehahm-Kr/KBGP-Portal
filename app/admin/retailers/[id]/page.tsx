import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminRetailerDetail } from "@/lib/retailer/admin-retailer-actions";
import { RetailerDetailView } from "@/components/admin/retailer-detail-view";

export const dynamic = "force-dynamic";

interface AdminRetailerDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AdminRetailerDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getAdminRetailerDetail(id);
  return {
    title: `${data?.company.name || "Retailer Details"} | K SELECT NETWORK Admin`,
  };
}

export default async function AdminRetailerDetailPage({ params }: AdminRetailerDetailPageProps) {
  await verifyAdminSession();
  const { id } = await params;
  const data = await getAdminRetailerDetail(id);

  if (!data) {
    notFound();
  }

  return <RetailerDetailView data={data} />;
}
