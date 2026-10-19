import { redirect } from "next/navigation";

export default async function CategoriesAttributesAliasRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(resolved)) {
    if (typeof v === "string") {
      query.set(k, v);
    } else if (Array.isArray(v)) {
      v.forEach((val) => query.append(k, val));
    }
  }
  const qStr = query.toString();
  redirect(`/admin/settings/category-attribute${qStr ? `?${qStr}` : ""}`);
}
