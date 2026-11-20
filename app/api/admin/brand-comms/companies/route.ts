import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { extractPdfAttachment } from "@/lib/insights/pdf-attachments";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const adminDb = createAdminClient();

  const [companiesRes, insightsRes, resourcesRes] = await Promise.all([
    adminDb
      .from("companies")
      .select("id, name, status, country")
      .order("name", { ascending: true }),
    adminDb
      .from("insights_articles")
      .select("id, slug, title_ko, title_en, status, visuals, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    adminDb
      .from("brand_resources")
      .select("id, title_ko, title_en, category, file_type, version, status, audience_mode")
      .order("updated_at", { ascending: false }),
  ]);

  if (companiesRes.error) {
    return NextResponse.json({ error: companiesRes.error.message }, { status: 500 });
  }

  const insights = (insightsRes.data || []).map((art: any) => {
    const pdf = extractPdfAttachment(art.visuals);
    return {
      id: art.id,
      slug: art.slug,
      title_ko: art.title_ko,
      title_en: art.title_en,
      status: art.status,
      has_pdf: Boolean(pdf),
      pdf: pdf
        ? {
            file_name: pdf.file_name,
            file_size: pdf.file_size,
            page_count: pdf.page_count,
            sha256: pdf.sha256,
          }
        : null,
    };
  });

  return NextResponse.json({
    companies: companiesRes.data || [],
    insights,
    resources: resourcesRes.data || [],
  });
}
