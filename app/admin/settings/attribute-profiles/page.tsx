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
    <div className="p-8 max-w-7xl mx-auto min-h-screen text-slate-100">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          🏷️ 제품군 속성 프로필 관리
        </h1>
        <p className="text-sm text-slate-400">
          최종 카테고리별로 자동 적용되는 dynamic 제품군 속성 프로필의 명세를 확인하고 활성 여부를 조절합니다.
        </p>
      </div>

      {/* 엑셀 일괄 동기화 컴포넌트 */}
      <ExcelImporter />

      {/* 프로필 목록 (Client Component) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
          📋 제품군 프로필 리스트 (총 {profiles.length}개 정의됨)
        </h2>

        {profiles.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            등록된 프로필 데이터가 없습니다. 상단의 동기화 기능을 통해 엑셀 데이터를 업로드해주세요.
          </div>
        ) : (
          <ProfileList initialProfiles={profiles} />
        )}
      </div>
    </div>
  );
}
