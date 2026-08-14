import DetailView from "@/components/admin/knowledge/detail-view";

export const dynamic = "force-dynamic";

export default async function KnowledgeDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetailView id={id} />;
}
