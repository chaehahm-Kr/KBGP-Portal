"use client";

import { useState } from "react";
import { duplicateCalculation, archiveCalculation, getSavedCalculations, getSavedCalculationDetail } from "@/lib/pricing/actions";

interface Props {
  savedCalculations: any[];
  onUpdateList: (newList: any[]) => void;
  onSelectCalculator: () => void;
  onLoadToCalculator: (formData: any) => void;
}

export function SavedCalculationsTab({ 
  savedCalculations, 
  onUpdateList, 
  onSelectCalculator,
  onLoadToCalculator 
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<any | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [detailScenarioTab, setDetailScenarioTab] = useState<"conservative" | "expected" | "optimistic">("expected");

  // 이력 상세 로드
  const handleViewDetail = async (id: string) => {
    setLoadingId(id);
    const detail = await getSavedCalculationDetail(id);
    setLoadingId(null);
    if (detail) {
      setDetailItem(detail);
      setDetailScenarioTab("expected");
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

  // 레거시와 신규 3대 시나리오 결과 묶음의 필드를 동적 매핑해주는 핵심 호환성 헬퍼
  const getChannelResult = (item: any, scenario: "conservative" | "expected" | "optimistic", chan: "b2b" | "amazon"): any | undefined => {
    const res = item?.calculated_results;
    if (!res) return undefined;
    
    // 1. 신규 3대 시나리오 병렬 스냅샷 데이터 구조일 때
    if (res.expected || res.conservative || res.optimistic) {
      return res[scenario]?.[chan];
    }
    
    // 2. 레거시 단일 시나리오 스냅샷 데이터 구조일 때
    if (scenario === "expected") {
      return res[chan];
    }
    
    return undefined;
  };

  return (
    <div className="space-y-6">
      
      {/* 상단 액션 컨트롤 바 */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-xs text-slate-500">
          이전에 시뮬레이션하고 저장한 계산 내역 스냅샷을 조회, 비교 및 관리합니다. (레거시 계산 이력도 자동 하위 호환 매핑 지원)
        </div>
        <div className="flex space-x-3">
          {selectedIds.length >= 2 && (
            <button
              onClick={() => setCompareMode(!compareMode)}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
            >
              {compareMode ? "목록으로 돌아가기" : `선택한 ${selectedIds.length}개 항목 비교하기`}
            </button>
          )}
          <button
            onClick={onSelectCalculator}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 bg-white rounded-lg text-xs font-semibold transition"
          >
            새 계산기 열기
          </button>
        </div>
      </div>

      {compareMode ? (
        /* 1대1 비교 그리드 테이블 뷰 */
        <CompareView 
          ids={selectedIds} 
          items={savedCalculations} 
          onClose={() => setCompareMode(false)} 
          getChannelResult={getChannelResult}
        />
      ) : (
        /* 리스트 목록 및 상세 분할 레이아웃 */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`${detailItem ? "lg:col-span-7" : "lg:col-span-12"} space-y-4`}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/50 text-[10px] text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left font-bold">계산 이름 / 연결 제품</th>
                    <th scope="col" className="px-6 py-3 text-left font-bold text-center">채널</th>
                    <th scope="col" className="px-6 py-3 text-left font-bold text-right">공급가 원본</th>
                    <th scope="col" className="px-6 py-3 text-left font-bold text-center">상태 (Expected 기준)</th>
                    <th scope="col" className="px-6 py-3 text-left font-bold">저장일</th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 text-xs">
                  {savedCalculations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                        저장된 시뮬레이션 계산 이력이 없습니다. 계산기 탭에서 스냅샷을 저장해 주세요.
                      </td>
                    </tr>
                  ) : (
                    savedCalculations.map((item) => {
                      const expectedStatus = item.calculated_results?.expected?.status 
                        || item.calculated_results?.status 
                        || item.status;

                      // 원화 또는 달러 입력 기호 구분
                      const currencySymbol = item.original_currency === "KRW" ? "₩" : "$";
                      const originalPrice = item.original_supplier_price !== undefined && item.original_supplier_price !== null
                        ? Number(item.original_supplier_price)
                        : Number(item.supplier_unit_price);

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/30 transition cursor-pointer ${
                            detailItem?.id === item.id ? "bg-slate-50/80 font-medium" : ""
                          }`}
                          onClick={() => handleViewDetail(item.id)}
                        >
                          <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => handleToggleSelect(item.id)}
                              className="h-4 w-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{item.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {item.products?.name ? `연결: ${item.products.name}` : "직접 임시 시뮬레이션"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-[10px] font-bold uppercase text-slate-600">
                            {item.channel}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-slate-700">
                            {currencySymbol}{originalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {expectedStatus === "approved" ? (
                              <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">Approved</span>
                            ) : expectedStatus === "conditional" ? (
                              <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-100">Conditional</span>
                            ) : (
                              <span className="bg-red-50 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded border border-red-100">Not Viable</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[10px] text-slate-400 font-mono">
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 우측 계산 결과 스냅샷 상세 패널 */}
          {detailItem && (
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm">Calculation Details Snapshot</h4>
                  <button onClick={() => setDetailItem(null)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">스냅샷 식별 명칭</span>
                    <strong className="text-slate-800 text-sm">{detailItem.name}</strong>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-slate-400 block">설정 모드</span>
                      <span className="text-slate-800 font-semibold">{detailItem.mode === "analyze_profitability" ? "수익성 분석" : "목표가 역산"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">적용 프리셋</span>
                      <span className="text-slate-800 font-semibold">
                        {detailItem.preset_id ? "Business Preset" : "Legacy / Not Assigned"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-slate-400 block">공급 가격 원본</span>
                      <span className="text-slate-800 font-bold">
                        {detailItem.original_currency === "KRW" ? "₩" : "$"}
                        {(detailItem.original_supplier_price ?? detailItem.supplier_unit_price).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">계산 기준 환율</span>
                      <span className="text-slate-800 font-semibold">
                        ₩{detailItem.exchange_rate?.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {detailItem.notes && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block mb-1 text-[10px] font-bold">작성자 기록 메모</span>
                      <p className="text-slate-700 leading-relaxed font-sans">{detailItem.notes}</p>
                    </div>
                  )}

                  {/* 3대 시나리오 전환 탭 */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="flex border-b border-slate-100">
                      {(["conservative", "expected", "optimistic"] as const).map((scen) => (
                        <button
                          key={scen}
                          onClick={() => setDetailScenarioTab(scen)}
                          className={`flex-1 py-1.5 text-[10px] font-bold border-b-2 text-center transition-all ${
                            detailScenarioTab === scen 
                              ? "border-slate-800 text-slate-800 bg-slate-50" 
                              : "border-transparent text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          {scen.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    {/* 수치 요약 */}
                    {(() => {
                      const b2bRes = getChannelResult(detailItem, detailScenarioTab, "b2b");
                      const amzRes = getChannelResult(detailItem, detailScenarioTab, "amazon");

                      if (!b2bRes && !amzRes) {
                        return <div className="text-center text-slate-400 italic py-4">해당 시나리오의 결과 정보가 없습니다.</div>;
                      }

                      return (
                        <div className="space-y-3">
                          {b2bRes && (
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/80 space-y-1">
                              <span className="font-bold text-slate-800 block text-[10px] uppercase">Offline B2B 결과</span>
                              <div className="flex justify-between"><span>계산 도매가:</span><strong>${b2bRes.grossSales?.toFixed(2)}</strong></div>
                              <div className="flex justify-between"><span>도착 원가 (Landed):</span><strong>${b2bRes.landedCost?.toFixed(2)}</strong></div>
                              <div className="flex justify-between"><span>공헌이익률:</span><strong>{b2bRes.contributionMargin?.toFixed(1)}%</strong></div>
                              <div className="flex justify-between"><span>순이익률:</span><strong className="text-emerald-700">{b2bRes.netMargin?.toFixed(1)}%</strong></div>
                            </div>
                          )}
                          {amzRes && (
                            <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200/80 space-y-1">
                              <span className="font-bold text-slate-800 block text-[10px] uppercase">Amazon B2C 결과</span>
                              <div className="flex justify-between"><span>계산 MSRP:</span><strong>${amzRes.grossSales?.toFixed(2)}</strong></div>
                              <div className="flex justify-between"><span>도착 원가 (Landed):</span><strong>${amzRes.landedCost?.toFixed(2)}</strong></div>
                              <div className="flex justify-between"><span>공헌이익률:</span><strong>{amzRes.contributionMargin?.toFixed(1)}%</strong></div>
                              <div className="flex justify-between"><span>순이익률:</span><strong className="text-emerald-700">{amzRes.netMargin?.toFixed(1)}%</strong></div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 계산기 로드 버튼 배치 */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <button
                  onClick={() => onLoadToCalculator(detailItem)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition text-center"
                >
                  Recalculate with Business Preset (계산기로 불러와서 재연산)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 2개 이상의 스냅샷을 1대1로 비교하는 뷰 */
interface CompareProps {
  ids: string[];
  items: any[];
  onClose: () => void;
  getChannelResult: (item: any, scenario: "conservative" | "expected" | "optimistic", chan: "b2b" | "amazon") => any;
}

function CompareView({ ids, items, onClose, getChannelResult }: CompareProps) {
  const compareItems = items.filter((item) => ids.includes(item.id));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="font-bold text-slate-900 text-sm">시뮬레이션 스냅샷 데이터 1대1 비교 (Expected 기준)</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm">목록으로</button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left font-bold text-slate-500 uppercase tracking-wider w-1/4">
                이익 항목 지표 비교
              </th>
              {compareItems.map((item) => (
                <th key={item.id} scope="col" className="px-6 py-3 text-right font-bold text-slate-900">
                  {item.name}
                  <span className="block text-[9px] text-slate-400 font-mono font-normal mt-0.5">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100 font-medium">
            <tr>
              <td className="px-6 py-4 text-slate-500">판매 채널</td>
              {compareItems.map((item) => (
                <td key={item.id} className="px-6 py-4 text-right uppercase text-slate-600 font-bold">
                  {item.channel}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-6 py-4 text-slate-500">원 공급가격 및 통화</td>
              {compareItems.map((item) => {
                const sym = item.original_currency === "KRW" ? "₩" : "$";
                const val = item.original_supplier_price ?? item.supplier_unit_price;
                return (
                  <td key={item.id} className="px-6 py-4 text-right text-slate-800 font-bold">
                    {sym}{val?.toLocaleString()}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-6 py-4 text-slate-500">계산 기준 환율</td>
              {compareItems.map((item) => (
                <td key={item.id} className="px-6 py-4 text-right text-slate-800 font-mono">
                  ₩{Number(item.exchange_rate || 1350).toFixed(2)}
                </td>
              ))}
            </tr>

            {/* B2B 지표들 */}
            <tr>
              <td className="px-6 py-4 text-slate-500 bg-slate-50/50">B2B Net Margin (%)</td>
              {compareItems.map((item) => {
                const b2b = getChannelResult(item, "expected", "b2b");
                return (
                  <td key={item.id} className="px-6 py-4 text-right bg-slate-50/50 text-slate-700 font-mono">
                    {b2b?.netMargin !== undefined ? `${b2b.netMargin.toFixed(1)}%` : "-"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-6 py-4 text-slate-500">B2B Net Profit per Unit</td>
              {compareItems.map((item) => {
                const b2b = getChannelResult(item, "expected", "b2b");
                return (
                  <td key={item.id} className="px-6 py-4 text-right text-slate-700 font-mono">
                    {b2b?.netProfit !== undefined ? `$${b2b.netProfit.toFixed(2)}` : "-"}
                  </td>
                );
              })}
            </tr>

            {/* Amazon 지표들 */}
            <tr>
              <td className="px-6 py-4 text-slate-500 bg-slate-50/50">Amazon Net Margin (%)</td>
              {compareItems.map((item) => {
                const amz = getChannelResult(item, "expected", "amazon");
                return (
                  <td key={item.id} className="px-6 py-4 text-right bg-slate-50/50 text-slate-700 font-mono">
                    {amz?.netMargin !== undefined ? `${amz.netMargin.toFixed(1)}%` : "-"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-6 py-4 text-slate-500">Amazon Net Profit per Unit</td>
              {compareItems.map((item) => {
                const amz = getChannelResult(item, "expected", "amazon");
                return (
                  <td key={item.id} className="px-6 py-4 text-right text-slate-700 font-mono">
                    {amz?.netProfit !== undefined ? `$${amz.netProfit.toFixed(2)}` : "-"}
                  </td>
                );
              })}
            </tr>
            
            <tr>
              <td className="px-6 py-4 text-slate-500">상태 진단</td>
              {compareItems.map((item) => {
                const status = item.calculated_results?.expected?.status 
                  || item.calculated_results?.status 
                  || item.status;
                return (
                  <td key={item.id} className="px-6 py-4 text-right font-bold">
                    {status === "approved" ? (
                      <span className="text-emerald-600">Approved</span>
                    ) : status === "conditional" ? (
                      <span className="text-amber-600">Conditional</span>
                    ) : (
                      <span className="text-red-600">Not Viable</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
