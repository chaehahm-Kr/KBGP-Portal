import { getAttributeProfilesWithSummary } from "@/lib/product/attribute-actions";
import { ExcelImporter } from "@/components/admin/settings/excel-importer";
import { ProfileList } from "@/components/admin/settings/profile-list";

export const metadata = {
  title: "Attribute Profiles Management - K-Select Admin",
  description: "Manage dynamic product group attribute profiles and relationships.",
};

export default async function AttributeProfilesSettingsPage() {
  const profiles = await getAttributeProfilesWithSummary();

  return (
    <div className="w-full text-zinc-900 dark:text-zinc-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-zinc-900 dark:text-zinc-100">
          🏷️ 제품군 속성 프로필 관리
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          최종 카테고리별로 자동 적용되는 dynamic 제품군 속성 프로필의 명세를 확인하고 활성 여부를 조절합니다.
        </p>
      </div>

      {/* 엑셀 일괄 동기화 컴포넌트 */}
      <ExcelImporter />

      {/* 프로필 목록 (Client Component) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          📋 제품군 프로필 리스트 (총 {profiles.length}개 정의됨)
        </h2>

        {profiles.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
            등록된 프로필 데이터가 없습니다. 상단의 동기화 기능을 통해 엑셀 데이터를 업로드해주세요.
          </div>
        ) : (
          <ProfileList initialProfiles={profiles} />
        )}
      </div>
    </div>
  );
}
