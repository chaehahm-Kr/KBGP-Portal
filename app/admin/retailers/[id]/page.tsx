import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";
import { getAdminRetailer360Data } from "@/lib/retailer/admin-retailer-360";
import { Retailer360View } from "@/components/admin/retailer-360-view";

export const dynamic = "force-dynamic";

interface AdminRetailerDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AdminRetailerDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getAdminRetailer360Data(id);
  return {
    title: `${data?.company.name || "Retailer 360° Operations"} | K SELECT NETWORK Admin`,
  };
}

export default async function AdminRetailerDetailPage({ params }: AdminRetailerDetailPageProps) {
  await verifyAdminSession();
  const { id } = await params;
  const data = await getAdminRetailer360Data(id);

  if (!data) {
    notFound();
  }

  return <Retailer360View data={data} />;
}
