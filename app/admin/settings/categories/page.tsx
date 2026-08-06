import { getCategoriesTree } from "@/lib/product/attribute-actions";
import { ExcelImporter } from "@/components/admin/settings/excel-importer";
import { CategoryTreeList } from "@/components/admin/settings/category-tree-list";

export const metadata = {
  title: "Categories Management - K-Select Admin",
  description: "Manage 3-Depth dynamic category master data and mapping structures.",
};

export default async function CategoriesSettingsPage() {
  const tree = await getCategoriesTree();

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen text-slate-100">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          📁 카테고리 마스터 관리
        </h1>
        <p className="text-sm text-slate-400">
          최대 3Depth로 구성된 제품 카테고리 체계를 관리합니다. 최종 카테고리는 제품군 속성 프로필과 자동으로 맵핑됩니다.
        </p>
      </div>

      {/* 엑셀 일괄 동기화 컴포넌트 */}
      <ExcelImporter />

      {/* 카테고리 트리 리스트 렌더러 (Client Component) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
          🌳 계층 구조 카테고리 트리 (총 {countNodes(tree)}개 분류 활성화)
        </h2>

        {tree.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            등록된 카테고리 데이터가 없습니다. 상단의 동기화 기능을 통해 엑셀 데이터를 업로드해주세요.
          </div>
        ) : (
          <CategoryTreeList initialTree={tree} />
        )}
      </div>
    </div>
  );
}

function countNodes(nodes: any[]): number {
  let count = nodes.length;
  nodes.forEach(n => {
    if (n.children && n.children.length > 0) {
      count += countNodes(n.children);
    }
  });
  return count;
}
