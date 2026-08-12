import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { CurationSettingsEditor } from "@/components/admin/curation-settings-editor";

export const metadata: Metadata = {
  title: "큐레이션 설정 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminCurationSettingsPage() {
  await verifyAdminSession();
  const supabase = createAdminClient();

  // 1. Fetch display programs
  const { data: displayPrograms } = await supabase
    .from("display_programs")
    .select("*")
    .order("code", { ascending: true });

  // 2. Fetch assortment profiles
  const { data: profiles } = await supabase
    .from("assortment_profiles")
    .select(`
      *,
      ap_matching_tags(
        display_order,
        matching_tags(
          id,
          tag_code,
          name_ko,
          name_en,
          is_active
        )
      )
    `)
    .order("display_program", { ascending: true })
    .order("code", { ascending: true });

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex flex-col gap-1 border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          큐레이션 설정 관리 (Curation Settings)
        </h1>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Display Program 및 Assortment Profile(AP) 명칭, 설명, 활성 상태를 통합 관리합니다.
        </p>
      </div>

      <CurationSettingsEditor
        initialPrograms={displayPrograms || []}
        initialProfiles={profiles || []}
      />
    </div>
  );
}
