import { 
  getCategoriesTree, 
  getAttributeProfilesWithSummary, 
  getAllAttributesWithDetails 
} from "@/lib/product/attribute-actions";
import { CategoryAttributeView } from "@/components/admin/settings/category-attribute-view";

export const metadata = {
  title: "Categories & Attribute - K-Select Admin",
  description: "Unified master management for categories, attribute profiles, and attributes/options.",
};

export default async function CategoryAttributePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const rawTab = typeof resolved.tab === "string" ? resolved.tab : undefined;

  const [tree, profiles, attributes] = await Promise.all([
    getCategoriesTree(),
    getAttributeProfilesWithSummary(),
    getAllAttributesWithDetails(),
  ]);

  return (
    <CategoryAttributeView
      initialTree={tree}
      initialProfiles={profiles}
      initialAttributes={attributes}
      initialTab={rawTab}
    />
  );
}
