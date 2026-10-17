import { redirect } from "next/navigation";

export default function SkuRedirectPage() {
  redirect("/admin/sales?tab=sku");
}
