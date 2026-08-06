import { getAllAttributesWithDetails } from "@/lib/product/attribute-actions";
import { ExcelImporter } from "@/components/admin/settings/excel-importer";
import { AttributeList } from "@/components/admin/settings/attribute-list";

export const metadata = {
  title: "Attributes & Options - K-Select Admin",
  description: "Manage dynamic properties, choices, types, units, and validation rules.",
};

export default async function AttributesSettingsPage() {
  const attributes = await getAllAttributesWithDetails();

  return (
    <div className="w-full text-zinc-900 dark:text-zinc-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-zinc-900 dark:text-zinc-100">
          ⚙️ 속성 및 옵션 마스터 관리
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          모든 제품에 적용되는 공통 속성 및 카테고리별 프로필 속성 목록을 확인하고, 입력타입 및 허용값 규칙을 검토합니다.
        </p>
      </div>

      {/* 엑셀 일괄 동기화 컴포넌트 */}
      <ExcelImporter />

      {/* 속성 데이터 목록 테이블 (Client Component) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          🛠️ 속성 명세 상세 조회 (총 {attributes.length}개 정의됨)
        </h2>

        {attributes.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">
            등록된 속성 데이터가 없습니다. 상단의 동기화 기능을 통해 엑셀 데이터를 업로드해주세요.
          </div>
        ) : (
          <AttributeList initialAttributes={attributes} />
        )}
      </div>
    </div>
  );
}
