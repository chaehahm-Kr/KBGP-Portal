import { redirect } from "next/navigation";

export default async function AdminCurationSettingsRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  query.set("tab", "settings");
  for (const [k, v] of Object.entries(resolved)) {
    if (k === "tab") continue;
    if (typeof v === "string") {
      query.set(k, v);
    } else if (Array.isArray(v)) {
      v.forEach((val) => query.append(k, val));
    }
  }
  redirect(`/admin/products/curation?${query.toString()}`);
}
