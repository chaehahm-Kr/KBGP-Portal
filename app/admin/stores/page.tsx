import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function AdminStoresLegacyPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await verifyAdminSession();
  const resolvedParams = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      query.set(key, value[0]);
    }
  }
  const queryString = query.toString();
  redirect(queryString ? `/admin/store-operations?${queryString}` : "/admin/store-operations");
}
