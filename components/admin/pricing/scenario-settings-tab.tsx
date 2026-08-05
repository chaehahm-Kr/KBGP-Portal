"use client";

import { useState } from "react";
import { updateScenarioValue, addScenarioGroup, addScenarioItem, archiveScenarioItem, deactivateScenarioItem, ScenarioGroupStructure } from "@/lib/pricing/actions";

interface Props {
  scenarios: any[];
  initialSettings: ScenarioGroupStructure[];
  onSettingsUpdate: (updated: ScenarioGroupStructure[]) => void;
}

export function ScenarioSettingsTab({ scenarios, initialSettings, onSettingsUpdate }: Props) {
  const [settings, setSettings] = useState<ScenarioGroupStructure[]>(initialSettings);
  const [editingItem, setEditingItem] = useState<{ itemId: string; scenarioCode: string; value: string } | null>(null);
  
  // 모달 팝업 상태들
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 그룹 폼 필드
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupOrder, setGroupOrder] = useState(0);

  // 항목 폼 필드
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemChannel, setItemChannel] = useState("both");
  const [itemValueType, setItemValueType] = useState("percentage");
  const [itemCostBasis, setItemCostBasis] = useState("");
  const [itemStage, setItemStage] = useState("contribution_cost");
  const [itemOrder, setItemOrder] = useState(0);
  const [itemTooltip, setItemTooltip] = useState("");
  const [valConservative, setValConservative] = useState(0);
  const [valExpected, setValExpected] = useState(0);
  const [valOptimistic, setValOptimistic] = useState(0);

  // 값 즉석 변경 핸들러
  const handleValueChange = async (itemId: string, scenarioId: string, scenarioCode: string, rawVal: string) => {
    const numericVal = parseFloat(rawVal);
    if (isNaN(numericVal)) return;

    // UI상 우선 상태값 즉시 동적 반영 (Optimistic UI)
    const updated = settings.map((g) => {
      const items = g.items.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            values: { ...i.values, [scenarioCode]: numericVal },
          };
        }
        return i;
      });
      return { ...g, items };
    });
    setSettings(updated);
    onSettingsUpdate(updated);

    // DB 업데이트
    await updateScenarioValue(scenarioId, itemId, numericVal);
  };

  // 그룹 생성
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !groupCode) return;
    setLoading(true);
    const res = await addScenarioGroup(groupName, groupCode, groupOrder);
    setLoading(false);
    if (res && "success" in res) {
      setMessage({ type: "success", text: res.success });
      setShowGroupModal(false);
      setGroupName("");
      setGroupCode("");
      window.location.reload(); // 데이터 전역 동기화
    } else if (res && "error" in res) {
      setMessage({ type: "error", text: res.error });
    }
  };

  // 항목 생성
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemCode || !selectedGroupId) return;
    setLoading(true);
    const res = await addScenarioItem({
      groupId: selectedGroupId,
      name: itemName,
      code: itemCode,
      description: itemDesc,
      applicableChannel: itemChannel,
      valueType: itemValueType,
      costBasis: itemCostBasis || undefined,
      profitStage: itemStage,
      displayOrder: itemOrder,
      tooltip: itemTooltip,
      defaultValueConservative: valConservative,
      defaultValueExpected: valExpected,
      defaultValueOptimistic: valOptimistic,
    });
    setLoading(false);
    if (res && "success" in res) {
      setMessage({ type: "success", text: res.success });
      setShowItemModal(false);
      // 폼 클리어
      setItemName("");
      setItemCode("");
      setItemDesc("");
      setValConservative(0);
      setValExpected(0);
      setValOptimistic(0);
      window.location.reload();
    } else if (res && "error" in res) {
      setMessage({ type: "error", text: res.error });
    }
  };

  // 항목 보관(삭제)
  const handleArchiveItem = async (itemId: string) => {
    if (!confirm("정말 이 설정 항목을 보관함으로 보내시겠습니까? 기존 계산 이력에는 유지되나 신규 계산에는 숨겨집니다.")) return;
    const res = await archiveScenarioItem(itemId);
    if (res && "success" in res) {
      // 리스트 필터링
      const updated = settings.map((g) => ({
        ...g,
        items: g.items.filter((i) => i.id !== itemId),
      }));
      setSettings(updated);
      onSettingsUpdate(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200">
        <div className="text-sm text-slate-500">
          관리자 권한 전용: 시나리오별 기본 요율을 동적으로 관리하고 새로운 비용 구조를 확장합니다.
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowGroupModal(true)}
            className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded-md text-sm font-medium hover:bg-slate-50 transition"
          >
            + 설정 그룹 추가
          </button>
          <button
            onClick={() => {
              if (settings.length > 0) setSelectedGroupId(settings[0].id);
              setShowItemModal(true);
            }}
            className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition"
          >
            + 세부 항목 추가
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm ${
            message.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main Grid View */}
      <div className="space-y-8">
        {settings.map((group) => (
          <div key={group.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Group Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900 text-base">{group.name}</h3>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-2.5 py-1 rounded">
                CODE: {group.code}
              </span>
            </div>

            {/* Group Items Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/3">
                      설정 항목 (Item)
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/12 text-center">
                      타입
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-red-700 uppercase tracking-wider w-1/6">
                      Conservative
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-800 uppercase tracking-wider w-1/6">
                      Expected (기본)
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-emerald-700 uppercase tracking-wider w-1/6">
                      Optimistic
                    </th>
                    <th scope="col" className="relative px-6 py-3 w-1/12">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {group.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-400">
                        이 그룹에 활성화된 세부 설정 항목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    group.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900 flex items-center space-x-1">
                            <span>{item.name}</span>
                            {item.tooltip && (
                              <span className="group relative cursor-help text-xs text-slate-400 hover:text-slate-600">
                                ⓘ
                                <span className="absolute hidden group-hover:block bg-slate-800 text-white text-[11px] p-2 rounded shadow-lg -top-8 left-4 w-48 z-10 whitespace-normal leading-normal font-normal">
                                  {item.tooltip}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">{item.code}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-medium text-slate-500">
                          {item.value_type === "percentage" ? "%" : item.value_type === "dollar_per_unit" ? "$" : "고정"}
                        </td>
                        {/* Conservative Value */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <input
                            type="number"
                            step="any"
                            value={item.values.conservative ?? 0}
                            onChange={(e) =>
                              handleValueChange(
                                item.id,
                                "a82d77d7-fca8-47fb-ba0d-7b242b36a100",
                                "conservative",
                                e.target.value
                              )
                            }
                            className="w-24 text-right px-2 py-1 text-sm border border-slate-200 rounded focus:border-red-500 focus:outline-none bg-red-50/20 text-red-800 font-medium"
                          />
                        </td>
                        {/* Expected Value */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <input
                            type="number"
                            step="any"
                            value={item.values.expected ?? 0}
                            onChange={(e) =>
                              handleValueChange(
                                item.id,
                                "a82d77d7-fca8-47fb-ba0d-7b242b36a101",
                                "expected",
                                e.target.value
                              )
                            }
                            className="w-24 text-right px-2 py-1 text-sm border border-slate-200 rounded focus:border-slate-500 focus:outline-none bg-slate-50 text-slate-800 font-medium"
                          />
                        </td>
                        {/* Optimistic Value */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <input
                            type="number"
                            step="any"
                            value={item.values.optimistic ?? 0}
                            onChange={(e) =>
                              handleValueChange(
                                item.id,
                                "a82d77d7-fca8-47fb-ba0d-7b242b36a102",
                                "optimistic",
                                e.target.value
                              )
                            }
                            className="w-24 text-right px-2 py-1 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:outline-none bg-emerald-50/20 text-emerald-800 font-medium"
                          />
                        </td>
                        {/* Delete/Archive button */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleArchiveItem(item.id)}
                            className="text-slate-400 hover:text-red-600 transition"
                            title="보관 처리 (Deactivate)"
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
        ))}
      </div>

      {/* 1. Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">새 설정 그룹 추가</h3>
              <button onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">그룹 이름</label>
                <input
                  type="text"
                  required
                  placeholder="예: Shipping Costs"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">그룹 고유 코드</label>
                <input
                  type="text"
                  required
                  placeholder="예: shipping_costs"
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">출력 정렬 순서</label>
                <input
                  type="number"
                  value={groupOrder}
                  onChange={(e) => setGroupOrder(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded text-sm hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 text-white rounded text-sm hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {loading ? "생성 중..." : "그룹 생성"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-slate-900">새 설정 항목 추가</h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <form onSubmit={handleCreateItem} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">연결할 그룹</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm bg-white"
                  >
                    {settings.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">항목 이름</label>
                  <input
                    type="text"
                    required
                    placeholder="예: Duty Rate"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">고유 코드</label>
                  <input
                    type="text"
                    required
                    placeholder="예: duty_rate"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">적용 채널</label>
                  <select
                    value={itemChannel}
                    onChange={(e) => setItemChannel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm bg-white"
                  >
                    <option value="both">Both (공통 B2B/Amazon)</option>
                    <option value="b2b">Offline B2B 전용</option>
                    <option value="amazon">Amazon B2C 전용</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">값 타입 (Value Type)</label>
                  <select
                    value={itemValueType}
                    onChange={(e) => setItemValueType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="dollar_per_unit">Dollar per Unit ($)</option>
                    <option value="fixed_total">Fixed Total ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">차감 이익 단계 (Profit Stage)</label>
                  <select
                    value={itemStage}
                    onChange={(e) => setItemStage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm bg-white"
                  >
                    <option value="revenue_reduction">Revenue Reduction (매출 차감)</option>
                    <option value="product_landed_cost">Product Landed Cost (수입/원가)</option>
                    <option value="contribution_cost">Contribution Cost (변동 공헌비)</option>
                    <option value="operating_expense">Operating Expense (영업 관리비)</option>
                    <option value="financing_risk">Financing & Risk (금융 위험)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">비용 환산 기준 (Cost Basis)</label>
                <select
                  value={itemCostBasis}
                  onChange={(e) => setItemCostBasis(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm bg-white"
                >
                  <option value="">(해당 없음 - 달러 고정 단가 등)</option>
                  <option value="supplier_cost_usd">Supplier Cost in USD</option>
                  <option value="gross_sales">Gross Sales (표시판매가)</option>
                  <option value="net_sales">Net Sales (순매출)</option>
                  <option value="landed_cost">Landed Cost (수입입고가)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 bg-slate-50 p-3 rounded-lg">
                <div>
                  <label className="block text-[10px] font-semibold text-red-700 uppercase mb-1">Conservative 기본값</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={valConservative}
                    onChange={(e) => setValConservative(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 uppercase mb-1">Expected 기본값</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={valExpected}
                    onChange={(e) => setValExpected(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none text-right"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-emerald-700 uppercase mb-1">Optimistic 기본값</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={valOptimistic}
                    onChange={(e) => setValOptimistic(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">간단 설명 (Description)</label>
                <input
                  type="text"
                  placeholder="항목에 대한 간략한 용도를 설명해 주세요."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={itemOrder}
                    onChange={(e) => setItemOrder(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">툴팁 안내 문구</label>
                  <input
                    type="text"
                    placeholder="마우스 오버 시 출력할 설명입니다."
                    value={itemTooltip}
                    onChange={(e) => setItemTooltip(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:border-slate-900 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 bg-white rounded text-sm hover:bg-slate-50 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 text-white rounded text-sm hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {loading ? "생성 중..." : "항목 및 기본값 생성"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
