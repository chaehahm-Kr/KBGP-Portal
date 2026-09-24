import React from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "K SELECT Retailer Portal",
  description: "Official B2B Retailer & Store Management Portal",
  icons: {
    icon: [
      { url: "/symbol-Cyan-Hotpink.png?v=hub_v1", type: "image/png" },
      { url: "/favicon.ico?v=hub_v1", sizes: "any" },
    ],
  },
};

export default async function RetailerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-zinc-800 selection:text-white">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {children}
    </div>
  );
}
