import React from "react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function WeeklyCheckHistoryPage() {
  redirect("/check");
}
