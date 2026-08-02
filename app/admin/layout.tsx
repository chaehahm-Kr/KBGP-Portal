import React from "react";
import AdminLayout from "@/components/admin/layout";

export const dynamic = "force-dynamic";

export default function AdminPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
