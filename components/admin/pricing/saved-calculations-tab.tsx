"use client";

import { useState } from "react";
import { duplicateCalculation, archiveCalculation, getSavedCalculations, getSavedCalculationDetail } from "@/lib/pricing/actions";

interface Props {
  savedCalculations: any[];
  onUpdateList: (newList: any[]) => void;
  onSelectCalculator: () => void;
}

export function SavedCalculationsTab({ savedCalculations, onUpdateList, onSelectCalculator }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  // 이력 상세 로드
  const handleViewDetail = async (id: string) => {
    setLoadingId(id);
    const detail = await getSavedCalculationDetail(id);
    setLoadingId(null);
    if (detail) {
      setDetailItem(detail);
    } else {
      alert("상세 데이터를 불러오는 데 실패했습니다.");
    }
  };

  // 계산 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 계산 기록을 삭제하시겠습니까?")) return;
    const res = await archiveCalculation(id);
    if (res && "success" in res) {
      const fresh = await getSavedCalculations();
      onUpdateList(fresh);
      if (detailItem?.id === id) setDetailItem(null);
    } else if (res && "error" in res) {
      alert(res.error);
    }
  };

  // 계산 복제
  const handleDuplicate = async (id: string) => {
    const res = await duplicateCalculation(id);
    if (res && "success" in res) {
      const fresh = await getSavedCalculations();
      onUpdateList(fresh);
    } else if (res && "error" in res) {
      alert(res.error);
    }
  };

  // 체크박스 선택 토글
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Action */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-500">
          이전에 시뮬레이션하고 저장한 계산 내역 스냅샷을 조회, 비교 및 관리합니다.
        </div>
        <div className="flex space-x-3">
          {selectedIds.length >= 2 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-semibold hover:bg-slate-800 transition"
            >
              {compareMode ? "목록으로 돌아가기" : `선택한 ${selectedIds.length}개 항목 비교하기`}
            </button>
          )}
          <button
            onClick={onSelectCalculator}
            className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-md text-sm font-medium hover:bg-slate-50 transition"
          >
            새 계산기 열기
          </button>
        </div>
      </div>

      {compareMode ? (
        /* 시나리오 비교 테이블 뷰 */
        <CompareView ids={selectedIds} items={savedCalculations} onClose={() => setCompareMode(false)} />
      ) : (
        /* 기본 리스트 및 디테일 분할 레이아웃 */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className={`${detailItem ? "lg:col-span-7" : "lg:col-span-12"} space-y-4`}>
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      계산 이름 / 연결 제품
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      채널
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                      공급가 ($)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                      상태
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      저장일
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {savedCalculations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                        저장된 시뮬레이션 계산 이력이 없습니다. 계산기에서 결과를 저장해 주세요.
                      </td>
                    </tr>
                  ) : (
                    savedCalculations.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/50 transition cursor-pointer ${
                          detailItem?.id === item.id ? "bg-slate-50 font-medium" : ""
                        }`}
                        onClick={() => handleViewDetail(item.id)}
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => handleToggleSelect(item.id)}
                            className="h-4 w-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {item.products?.name ? `연결: ${item.products.name}` : "임시 시뮬레이션 제품"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-semibold uppercase text-slate-600">
                          {item.channel}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-800">
                          ${Number(item.supplier_unit_price).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {item.status === "approved" ? (
                            <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">Approved</span>
                          ) : item.status === "conditional" ? (
                            <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-100">Conditional</span>
                          ) : (
                            <span className="bg-red-50 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded border border-red-100">Not Viable</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                          {new Date(item.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDuplicate(item.id)}
                            className="text-slate-400 hover:text-slate-700 transition"
                            title="복제"
                          >
                            ❐
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-slate-400 hover:text-red-600 transition"
                            title="삭제"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Detail Panel */}
          {detailItem && (
            <div className="lg:col-span-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-semibold text-slate-900 text-sm">Calculation Details Snapshot</h4>
                <button onClick={() => setDetailItem(null)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400 block uppercase font-semibold tracking-wider text-[10px]">계산 스냅샷 명칭</span>
                  <strong className="text-slate-800 text-sm">{detailItem.name}</strong>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-400 block">설정 모드</span>
                    <span className="text-slate-800 font-semibold">{detailItem.mode === "analyze_profitability" ? "수익성 분석" : "목표가 역산"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">적용 채널</span>
                    <span className="text-slate-800 font-semibold uppercase">{detailItem.channel}</span>
                  </div>
                </div>

                {detailItem.notes && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <span className="text-slate-400 block mb-1">작성자 메모</span>
                    <p className="text-slate-700 leading-relaxed font-sans">{detailItem.notes}</p>
                  </div>
                )}

                {/* Waterfall 수치 상세 리스트 */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <span className="text-slate-400 block font-semibold">저장 시점 연산 결과 요약</span>
                  {detailItem.calculated_results?.b2b && (
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-100 space-y-1">
                      <span className="font-bold text-slate-800 block text-[11px]">B2B Channel Results</span>
                      <div className="flex justify-between"><span>도매가:</span><strong>${detailItem.wholesale_price}</strong></div>
                      <div className="flex justify-between"><span>Landed Cost:</span><strong>${Number(detailItem.calculated_results.b2b.landedCost).toFixed(2)}</strong></div>
                      <div className="flex justify-between"><span>Net Margin:</span><strong className="text-emerald-700">{Number(detailItem.calculated_results.b2b.netMargin).toFixed(1)}%</strong></div>
                    </div>
                  )}
                  {detailItem.calculated_results?.amazon && (
                    <div className="bg-slate-50/50 p-3 rounded border border-slate-100 space-y-1 mt-2">
                      <span className="font-bold text-slate-800 block text-[11px]">Amazon Channel Results</span>
                      <div className="flex justify-between"><span>아마존 판매가:</span><strong>${detailItem.amazon_list_price}</strong></div>
                      <div className="flex justify-between"><span>Landed Cost:</span><strong>${Number(detailItem.calculated_results.amazon.landedCost).toFixed(2)}</strong></div>
                      <div className="flex justify-between"><span>Net Margin:</span><strong className="text-emerald-700">{Number(detailItem.calculated_results.amazon.netMargin).toFixed(1)}%</strong></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 2개 이상의 스냅샷을 1대1로 비교하는 뷰 */
function CompareView({ ids, items, onClose }: { ids: string[]; items: any[]; onClose: () => void }) {
  const compareItems = items.filter((item) => ids.includes(item.id));

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-semibold text-slate-900 text-sm">시뮬레이션 스냅샷 데이터 1대1 비교</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">닫기</button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">
                이익 항목 지표 비교
              </th>
              {compareItems.map((item) => (
                <th key={item.id} scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  {item.name}
                  <span className="block text-[10px] text-slate-400 normal-case mt-0.5">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            <tr>
              <td className="px-6 py-4 font-semibold text-slate-900">판매 채널</td>
              {compareItems.map((item) => (
                <td key={item.id} className="px-6 py-4 text-right font-medium uppercase text-slate-600">
                  {item.channel}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-4 font-semibold text-slate-900">원화 공급가</td>
              {compareItems.map((item) => (
                <td key={item.id} className="px-6 py-4 text-right text-slate-800">
                  ${Number(item.supplier_unit_price).toFixed(2)}
                </td>
              ))}
            </tr>
            {/* B2B 지표들 */}
            <tr>
              <td className="px-6 py-4 font-semibold text-slate-900 bg-slate-50/50">B2B Net Margin (%)</td>
              {compareItems.map((item) => {
                const margin = item.calculated_results?.b2b?.netMargin;
                return (
                  <td key={item.id} className="px-6 py-4 text-right bg-slate-50/50 text-slate-700">
                    {margin !== undefined ? `${margin.toFixed(1)}%` : "-"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-6 py-4 font-semibold text-slate-900">B2B Net Profit per Unit</td>
              {compareItems.map((item) => {
                const profit = item.calculated_results?.b2b?.netProfit;
                return (
                  <td key={item.id} className="px-6 py-4 text-right text-slate-700">
                    {profit !== undefined ? `$${profit.toFixed(2)}` : "-"}
                  </td>
                );
              })}
            </tr>
            {/* Amazon 지표들 */}
            <tr>
              <td className="px-6 py-4 font-semibold text-slate-900 bg-slate-50/50">Amazon Net Margin (%)</td>
              {compareItems.map((item) => {
                const margin = item.calculated_results?.amazon?.netMargin;
                return (
                  <td key={item.id} className="px-6 py-4 text-right bg-slate-50/50 text-slate-700">
                    {margin !== undefined ? `${margin.toFixed(1)}%` : "-"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-6 py-4 font-semibold text-slate-900">Amazon Net Profit per Unit</td>
              {compareItems.map((item) => {
                const profit = item.calculated_results?.amazon?.netProfit;
                return (
                  <td key={item.id} className="px-6 py-4 text-right text-slate-700">
                    {profit !== undefined ? `$${profit.toFixed(2)}` : "-"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-6 py-4 font-semibold text-slate-900">상태 진단</td>
              {compareItems.map((item) => (
                <td key={item.id} className="px-6 py-4 text-right font-bold text-slate-700">
                  {item.status === "approved" ? "Approved" : item.status === "conditional" ? "Conditional" : "Not Viable"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
