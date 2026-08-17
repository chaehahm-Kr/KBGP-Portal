import React from "react";
import type { Metadata } from "next";
import AdminLayout from "@/components/admin/layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "K Select Network 어드민",
  description: "K Select Network 운영 관리 시스템",
  icons: {
    icon: [
      { url: "/symbol-Hotpink-Cyan.png?v=admin_v1", type: "image/png" },
      { url: "/admin-favicon-32x32.png?v=admin_v1", sizes: "32x32", type: "image/png" },
      { url: "/admin-favicon-16x16.png?v=admin_v1", sizes: "16x16", type: "image/png" },
      { url: "/admin-favicon.ico?v=admin_v1", sizes: "any" },
    ],
    shortcut: ["/symbol-Hotpink-Cyan.png?v=admin_v1"],
    apple: [
      { url: "/admin-apple-touch-icon.png?v=admin_v1", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function AdminPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
