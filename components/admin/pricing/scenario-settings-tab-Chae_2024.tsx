"use client";

import { useState, useEffect } from "react";
import { 
  updatePresetScenarioValue, 
  addScenarioGroup, 
  addScenarioItem, 
  archiveScenarioItem, 
  getScenarioSettings,
  createCustomPreset,
  duplicatePreset,
  deleteCustomPreset,
  renamePreset,
  ScenarioGroupStructure 
} from "@/lib/pricing/actions";

interface Props {
  presets: any[];
  scenarios: any[];
  initialSettings: ScenarioGroupStructure[];
  onSettingsUpdate: (updated: ScenarioGroupStructure[]) => void;
  onPresetsUpdate: () => void;
}

export function ScenarioSettingsTab({ 
  presets, 
  scenarios, 
  initialSettings, 
  onSettingsUpdate,
  onPresetsUpdate 
}: Props) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id || "legacy");
  const [settings, setSettings] = useState<ScenarioGroupStructure[]>(initialSettings);
  const [activeScenarioTab, setActiveScenarioTab] = useState<string>("expected"); // default: expected

  const [editingItem, setEditingItem] = useState<{ itemId: string; scenarioCode: string; value: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 모달 팝업 상태들
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPresetCreateModal, setShowPresetCreateModal] = useState(false);
  const [showPresetRenameModal, setShowPresetRenameModal] = useState(false);

  // 프리셋 생성/수정 폼 필드
  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  const [presetUseCase, setPresetUseCase] = useState("");
  const [presetChannel, setPresetChannel] = useState<"b2b" | "amazon" | "both">("both");

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

  // 프리셋 변경 시 설정값 비동기 fetch
  useEffect(() => {
    async function loadPresetSettings() {
      setLoading(true);
      try {
        const data = await getScenarioSettings(selectedPresetId);
        setSettings(data);
        onSettingsUpdate(data);
      } catch (err) {
        console.error("Failed to load preset settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPresetSettings();
  }, [selectedPresetId]);

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  // 값 즉석 변경 핸들러
  const handleValueChange = async (itemId: string, scenarioId: string, scenarioCode: string, rawVal: string) => {
    const numericVal = parseFloat(rawVal);
    if (isNaN(numericVal)) return;

    // UI상 우선 상태값 즉시 반영 (Optimistic UI)
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

    // DB 업데이트 (preset_id 추가 반영)
    await updatePresetScenarioValue(selectedPresetId, scenarioId, itemId, numericVal);
  };

  // 프리셋 신설
  const handleCreatePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName) return;
    setLoading(true);
    const res = await createCustomPreset(presetName, presetDesc, presetUseCase, presetChannel);
    setLoading(false);
    if (res && "success" in res) {
      setMessage({ type: "success", text: res.success });
      setShowPresetCreateModal(false);
      setPresetName("");
      setPresetDesc("");
      setPresetUseCase("");
      onPresetsUpdate();
      setSelectedPresetId(res.presetId);
    } else if (res && "error" in res) {
      setMessage({ type: "error", text: res.error });
    }
  };

  // 프리셋 복제
  const handleDuplicatePreset = async () => {
    if (!selectedPreset) return;
    const targetName = prompt("복제할 프리셋 이름을 입력해 주세요:", `${selectedPreset.name} (복사본)`);
    if (!targetName) return;

    setLoading(true);
    const res = await duplicatePreset(selectedPreset.id, targetName);
    setLoading(false);
    if (res && "success" in res) {
      alert(res.success);
      onPresetsUpdate();
      setSelectedPresetId(res.presetId);
    } else if (res && "error" in res) {
      alert(res.error);
    }
  };

  // 프리셋 삭제
  const handleDeletePreset = async () => {
    if (!selectedPreset) return;
    if (selectedPreset.is_system) {
      alert("시스템 기본 프리셋은 삭제할 수 없습니다.");
      return;
    }
    if (!confirm(`정말 프리셋 [${selectedPreset.name}]을 삭제하시겠습니까? 관련 요율 데이터가 모두 파괴됩니다.`)) return;

    setLoading(true);
    const res = await deleteCustomPreset(selectedPreset.id);
    setLoading(false);
    if (res && "success" in res) {
      alert(res.success);
      onPresetsUpdate();
      setSelectedPresetId(presets[0]?.id || "legacy");
    } else if (res && "error" in res) {
      alert(res.error);
    }
  };

  // 프리셋 이름 수정
  const handleRenamePresetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName || !selectedPreset) return;
    setLoading(true);
    const res = await renamePreset(selectedPreset.id, presetName, presetDesc);
    setLoading(false);
    if (res && "success" in res) {
      setMessage({ type: "success", text: res.success });
      setShowPresetRenameModal(false);
      onPresetsUpdate();
    } else if (res && "error" in res) {
      setMessage({ type: "error", text: res.error });
    }
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
      window.location.reload();
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
    setLoading(true);
    if (res && "success" in res) {
      setMessage({ type: "success", text: res.success });
      setShowItemModal(false);
      setItemName("");
      setItemCode("");
      setItemDesc("");
      window.location.reload();
    } else if (res && "error" in res) {
      setMessage({ type: "error", text: res.error });
    }
  };

  // 항목 보관
  const handleArchiveItem = async (itemId: string) => {
    if (!confirm("정말 이 설정 항목을 보관함으로 보내시겠습니까? 기존 계산 이력에는 유지되나 신규 계산에는 숨겨집니다.")) return;
    const res = await archiveScenarioItem(itemId);
    if (res && "success" in res) {
      const updated = settings.map((g) => ({
        ...g,
        items: g.items.filter((i) => i.id !== itemId),
      }));
      setSettings(updated);
      onSettingsUpdate(updated);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* 1. 좌측 프리셋 셀렉터 사이드바 */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Business Presets</h3>
            <button
              onClick={() => setShowPresetCreateModal(true)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition"
            >
              + 추가
            </button>
          </div>
          
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {/* System Presets */}
            <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">시스템 기본</div>
            {presets.filter(p => p.is_system).map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPresetId(p.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPresetId === p.id 
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs" 
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
              >
                {p.name}
              </button>
            ))}

            {/* Custom Presets */}
            <div className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mt-4 mb-1">커스텀 프리셋</div>
            {presets.filter(p => !p.is_system).length === 0 ? (
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 italic px-3 py-2">등록된 커스텀 프리셋이 없습니다.</div>
            ) : (
              presets.filter(p => !p.is_system).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPresetId(p.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    selectedPresetId === p.id 
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs" 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  }`}
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* 프리셋 제어 도구 */}
        {selectedPreset && (
          <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
            <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">프리셋 조작 도구</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDuplicatePreset}
                className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-xs text-center"
              >
                프리셋 복제
              </button>
              {!selectedPreset.is_system && (
                <button
                  onClick={() => {
                    setPresetName(selectedPreset.name);
                    setPresetDesc(selectedPreset.description || "");
                    setShowPresetRenameModal(true);
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-xs text-center"
                >
                  이름 수정
                </button>
              )}
              {!selectedPreset.is_system && (
                <button
                  onClick={handleDeletePreset}
                  className="col-span-2 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded text-[11px] font-medium hover:bg-red-500/20 transition text-center"
                >
                  프리셋 삭제
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. 우측 시나리오 탭 + 테이블 */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* 상단 프리셋 간략 정보 */}
        {selectedPreset && (
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 mb-1">
                  {selectedPreset.is_system ? "System Preset" : "Custom Preset"}
                </span>
                <h2 className="text-lg font-bold text-zinc-950 dark:text-white">{selectedPreset.name}</h2>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition"
                >
                  + 설정 그룹 추가
                </button>
                <button
                  onClick={() => {
                    setSelectedGroupId(settings[0]?.id || "");
                    setShowItemModal(true);
                  }}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-lg text-xs font-semibold transition shadow-xs"
                >
                  + 설정 항목 추가
                </button>
              </div>
            </div>
            {selectedPreset.description && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{selectedPreset.description}</p>
            )}
            {selectedPreset.recommended_use_case && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">권장 용도: {selectedPreset.recommended_use_case}</p>
            )}
          </div>
        )}

        {/* 3대 시나리오 탭 바 */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
            {scenarios.map((scen) => {
              const isActive = activeScenarioTab === scen.code;
              return (
                <button
                  key={scen.id}
                  onClick={() => setActiveScenarioTab(scen.code)}
                  className={`flex-1 py-3 text-xs font-semibold transition-all border-b-2 text-center ${
                    isActive 
                      ? "border-zinc-900 text-zinc-900 bg-white dark:border-white dark:text-white dark:bg-zinc-900" 
                      : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {scen.name} Scenario
                </button>
              );
            })}
          </div>

          {/* 설정 항목 리스트 테이블 */}
          <div className="p-4 space-y-8 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-10 text-xs text-zinc-400 dark:text-zinc-500 font-medium">데이터 로딩 중...</div>
            ) : settings.length === 0 ? (
              <div className="text-center py-10 text-xs text-zinc-400 dark:text-zinc-500 italic">설정 항목이 존재하지 않습니다.</div>
            ) : (
              settings.map((group) => (
                <div key={group.id} className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-wider flex items-center">
                      <span className="w-1.5 h-3 bg-indigo-500 rounded-full mr-2"></span>
                      {group.name}
                    </h4>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{group.code}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                      <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-950/50">
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[25%]">항목명</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[10%]">채널</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[15%]">구분 / 단위</th>
                          <th className="px-3 py-2 text-left text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[35%]">항목 설명</th>
                          <th className="px-3 py-2 text-right text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[15%]">기본값</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {group.items.map((item) => {
                          const val = item.values[activeScenarioTab] ?? 0;
                          const isEditing = editingItem?.itemId === item.id && editingItem?.scenarioCode === activeScenarioTab;
                          const scenarioObj = scenarios.find((s) => s.code === activeScenarioTab);

                          return (
                            <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition">
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">{item.code}</div>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                                {item.applicable_channel === "both" ? "공통 (B2B/Amazon)" : item.applicable_channel.toUpperCase()}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-[10px] text-zinc-500 dark:text-zinc-400">
                                <div className="font-medium text-zinc-800 dark:text-zinc-200">{item.value_type === "percentage" ? "비율 (%)" : "단가 ($)"}</div>
                                <div className="text-[9px] text-zinc-400 dark:text-zinc-500 italic">{item.profit_stage}</div>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate" title={item.description || ""}>
                                {item.description || "-"}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingItem.value}
                                    onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                                    onBlur={() => {
                                      if (scenarioObj) {
                                        handleValueChange(item.id, scenarioObj.id, activeScenarioTab, editingItem.value);
                                      }
                                      setEditingItem(null);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && scenarioObj) {
                                        handleValueChange(item.id, scenarioObj.id, activeScenarioTab, editingItem.value);
                                        setEditingItem(null);
                                      }
                                    }}
                                    autoFocus
                                    className="w-20 px-2 py-1 text-xs border border-indigo-500 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                ) : (
                                  <div
                                    onClick={() => setEditingItem({ itemId: item.id, scenarioCode: activeScenarioTab, value: String(val) })}
                                    className="text-xs font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2 py-1 rounded transition border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 inline-block min-w-[60px]"
                                  >
                                    {item.value_type === "percentage" ? `${val.toFixed(2)}%` : `$${val.toFixed(2)}`}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. 모달 레이어 정의 */}
      {/* ===================================================================== */}

      {/* 프리셋 생성 모달 */}
      {showPresetCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">새로운 커스텀 프리셋 생성</h3>
            <form onSubmit={handleCreatePreset} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">프리셋 이름 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: Brand-Funded Launch"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">설명</label>
                <textarea
                  placeholder="프리셋의 목적이나 세부 비용 가정에 대해 적어주세요."
                  value={presetDesc}
                  onChange={(e) => setPresetDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 h-20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">권장 유즈케이스</label>
                <input
                  type="text"
                  placeholder="예: 온라인 위주 마케팅 집중 브랜드 런칭 시"
                  value={presetUseCase}
                  onChange={(e) => setPresetUseCase(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">적용 유통 채널</label>
                <select
                  value={presetChannel}
                  onChange={(e) => setPresetChannel(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                >
                  <option value="both">B2B + Amazon 양쪽 공통</option>
                  <option value="b2b">B2B 전용</option>
                  <option value="amazon">Amazon 전용</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPresetCreateModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition"
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 프리셋 이름 수정 모달 */}
      {showPresetRenameModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">프리셋 정보 수정</h3>
            <form onSubmit={handleRenamePresetSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">프리셋 이름 *</label>
                <input
                  type="text"
                  required
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">설명</label>
                <textarea
                  value={presetDesc}
                  onChange={(e) => setPresetDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 h-20"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPresetRenameModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 설정 그룹 모달 */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">설정 그룹 추가</h3>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">그룹 이름 (UI 노출용)</label>
                <input
                  type="text"
                  required
                  placeholder="예: Fulfillment & Storage"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">그룹 코드 (영문 소문자/언더바)</label>
                <input
                  type="text"
                  required
                  placeholder="예: fulfillment_storage"
                  value={groupCode}
                  onChange={(e) => setGroupCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">출력 순서</label>
                <input
                  type="number"
                  value={groupOrder}
                  onChange={(e) => setGroupOrder(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 설정 항목 모달 */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">설정 항목 추가</h3>
            <form onSubmit={handleCreateItem} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">설정 그룹 선택</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                >
                  {settings.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">항목 이름</label>
                <input
                  type="text"
                  required
                  placeholder="예: Amazon Referral Fee Rate"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">항목 코드 (영문 소문자/언더바)</label>
                <input
                  type="text"
                  required
                  placeholder="예: amazon_referral_fee_rate"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">적용 판매 채널</label>
                  <select
                    value={itemChannel}
                    onChange={(e) => setItemChannel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  >
                    <option value="both">B2B + Amazon</option>
                    <option value="b2b">B2B 전용</option>
                    <option value="amazon">Amazon 전용</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">수치 유형</label>
                  <select
                    value={itemValueType}
                    onChange={(e) => setItemValueType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  >
                    <option value="percentage">비율 (%)</option>
                    <option value="dollar_per_unit">개당 달러단가 ($)</option>
                    <option value="fixed_total">고정 총비용</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">연산 기준 (Cost Basis)</label>
                  <select
                    value={itemCostBasis}
                    onChange={(e) => setItemCostBasis(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  >
                    <option value="">(해당 없음)</option>
                    <option value="supplier_cost">수급가(달러환산)</option>
                    <option value="gross_sales">Gross Sales (매출액)</option>
                    <option value="net_sales">Net Sales (순매출액)</option>
                    <option value="landed_cost">Landed Cost (물류도착원가)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">마진 차감 단계 (Stage)</label>
                  <select
                    value={itemStage}
                    onChange={(e) => setItemStage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  >
                    <option value="revenue_reduction">매출 차감 (Revenue Reduction)</option>
                    <option value="product_landed_cost">Landed Cost 가산</option>
                    <option value="contribution_cost">공헌이익 차감 (Contribution Cost)</option>
                    <option value="operating_expense">영업이익 차감 (Overhead / Labor)</option>
                    <option value="financing_risk">기타 금융 및 위험 비용</option>
                  </select>
                </div>
              </div>
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                시나리오별 기본값 정의 (Global)
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Conservative</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valConservative}
                    onChange={(e) => setValConservative(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Expected</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valExpected}
                    onChange={(e) => setValExpected(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Optimistic</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valOptimistic}
                    onChange={(e) => setValOptimistic(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-lg text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg text-xs hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 transition"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

