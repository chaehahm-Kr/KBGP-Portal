"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  getCategoriesTree, 
  getCategoryAttributes, 
  getProductAttributeValues, 
  saveProductAttributeValues,
  type CategoryNode,
  type AttributeMasterItem
} from "@/lib/product/attribute-actions";

interface FlatCategoryPath {
  code: string;
  pathName: string;
}

// 카테고리 코드별 유사어/연관 키워드 사전 정의
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  // 선케어 / 자외선 차단
  "SK_SUNSCREEN": ["선크림", "썬크림", "자외선차단제", "선블록", "선케어", "비비", "비비크림", "bbcream", "sunscreen", "suncream"],
  "SK_SUN_STICK": ["선스틱", "썬스틱", "선케어", "썬케어", "sunstick"],
  "SK_SUN_CUSHION": ["선쿠션", "썬쿠션", "선케어", "suncushion"],
  "SK_AFTER_SUN": ["수딩젤", "알로에", "알로에수딩젤", "알로에젤", "진정젤", "애프터선", "애프터썬", "수딩겔", "썬번", "탄피부", "진정", "진정크림"],
  
  // 메이크업 베이스
  "MU_BB_CC": ["비비", "비비크림", "씨씨크림", "cc크림", "bb크림", "bbcream", "cccream", "메이크업베이스", "베이스", "톤업", "톤업크림"],
  "MU_FOUNDATION": ["파운데이션", "파데", "리퀴드파데", "쿠션팩트", "foundation"],
  "MU_CUSHION": ["쿠션", "쿠션팩트", "팩트", "쿠션파데", "cushion"],
  "MU_CONCEALER": ["컨실러", "커버", "잡티커버", "concealer"],
  
  // 클렌징 / 세안
  "SK_CLEANSING_FOAM": ["폼클렌징", "클렌징폼", "세안제", "클렌저", "폼클렌저", "젤클렌저", "세수", "cleansingfoam", "cleanser"],
  "SK_CLEANSING_OIL": ["클렌징오일", "오일클렌저", "화장지우는오일", "cleansingoil"],
  "SK_CLEANSING_BALM": ["클렌징밤", "밤클렌저", "샤베트클렌저", "cleansingbalm"],
  "SK_CLEANSING_WATER": ["클렌징워터", "립앤아이리무버", "cleansingwater"],
  "SK_CLEANSING_WIPES": ["클렌징티슈", "클렌징패드", "리무버패드", "wipes", "티슈"],
  
  // 기초 케어
  "SK_TONER": ["스킨", "토너", "닦토", "콧물스킨", "toner", "스킨케어"],
  "SK_ESSENCE_TONER": ["에센스토너", "스킨에센스", "essencetoner"],
  "SK_TONER_PAD": ["토너패드", "필링패드", "스킨패드", "tonerpad", "패드"],
  "SK_ESSENCE": ["에센스", "수분에센스", "essence"],
  "SK_SERUM": ["세럼", "serum"],
  "SK_AMPOULE": ["앰플", "ampoule"],
  "SK_FACE_CREAM": ["크림", "수분크림", "영양크림", "보습크림", "cream"],
  "SK_BARRIER_CREAM": ["장벽크림", "재생크림", "시카크림", "barriercream", "시카", "cica"],
  "SK_GEL_CREAM": ["젤크림", "수딩크림", "젤타입크림", "gelcream", "수딩젤", "수딩겔", "알로에젤"],
  "SK_FACE_OIL": ["페이스오일", "오일", "faceoil"],
  
  // 아이 / 립 케어
  "SK_LIP_BALM": ["립밤", "입술보호제", "립케어", "립글로스", "lipbalm", "립에센스"],
  "SK_LIP_MASK": ["립마스크", "입술팩", "lipmask"],
  "SK_EYE_CREAM": ["아이크림", "눈가주름", "eyecream"],
  
  // 헤어 케어
  "HC_SHAMPOO": ["샴푸", "shampoo", "머리감기", "세정제"],
  "HC_SCALP_SHAMPOO": ["두피샴푸", "탈모샴푸", "비듬샴푸", "scalpshampoo"],
  "HC_RINSE": ["린스", "rinse"],
  "HC_TREATMENT": ["트리트먼트", "헤어팩", "treatment", "모발케어"],
  "HC_HAIR_ESSENCE": ["헤어에센스", "머리에센스", "hairessence"],
  "HC_HAIR_OIL": ["헤어오일", "헤어세럼", "hairoil"],
  
  // 바디 케어
  "BC_BODY_WASH": ["바디워시", "바디소프", "샤워젤", "bodywash"],
  "BC_BODY_LOTION": ["바디로션", "바디보습", "bodylotion"],
  "BC_BODY_CREAM": ["바디크림", "bodycream"],
  "BC_BODY_SCRUB": ["바디스크럽", "살구씨스크럽", "bodyscrub"],
  "BC_HAND_CREAM": ["핸드크림", "손크림", "handcream"],
};

// 카테고리 트리를 탐색하며 최종 카테고리(isFinal)에 해당하는 전체 경로 목록을 반환
function getFlatFinalCategories(nodes: CategoryNode[], currentPath: string[] = []): FlatCategoryPath[] {
  let results: FlatCategoryPath[] = [];
  nodes.forEach(node => {
    const newPath = [...currentPath, node.nameKo];
    if (node.isFinal || (!node.children || node.children.length === 0)) {
      results.push({
        code: node.code,
        pathName: newPath.join(" > ")
      });
    }
    if (node.children && node.children.length > 0) {
      results = results.concat(getFlatFinalCategories(node.children, newPath));
    }
  });
  return results;
}

interface CategoryAttributeFormProps {
  productId: string;
  initialCategoryCode: string | null;
  brandName: string;
  companyName?: string;
  productName: string;
  productNameEn: string | null;
  manufactureSku: string | null;
  letustoSku: string | null;
  origin: string | null;
  volume: string | null;
  colorMap?: string | null;
  isAdmin: boolean;
}

export function CategoryAttributeForm({
  productId,
  initialCategoryCode,
  brandName,
  companyName = "(미확인 제조사)",
  productName,
  productNameEn,
  manufactureSku,
  letustoSku,
  origin,
  volume,
  colorMap,
  isAdmin,
}: CategoryAttributeFormProps) {
  const router = useRouter();
  const [categoriesTree, setCategoriesTree] = useState<CategoryNode[]>([]);
  const [selectedCat1, setSelectedCat1] = useState<string>("");
  const [selectedCat2, setSelectedCat2] = useState<string>("");
  const [selectedCat3, setSelectedCat3] = useState<string>("");
  const [hasInitialized, setHasInitialized] = useState(false);
  const [catSearchQuery, setCatSearchQuery] = useState("");

  // 전체 리프 카테고리 경로 목록 계산
  const flatCategories = useMemo(() => {
    return getFlatFinalCategories(categoriesTree);
  }, [categoriesTree]);

  // 검색어에 매칭되는 목록 필터링 (동의어/유사어 사전 기반 연관 검색 고도화)
  const searchResults = useMemo(() => {
    if (!catSearchQuery.trim()) return [];
    
    // 검색어 정제 (공백 제거, 소문자화)
    const q = catSearchQuery.toLowerCase().replace(/\s+/g, "");
    
    return flatCategories.filter(item => {
      // 1) 전체 경로명 매칭
      const cleanPath = item.pathName.toLowerCase().replace(/\s+/g, "");
      if (cleanPath.includes(q)) return true;
      
      // 2) 카테고리 코드 매칭
      if (item.code.toLowerCase().includes(q)) return true;
      
      // 3) 유사어 사전 매칭
      const synonyms = CATEGORY_SYNONYMS[item.code];
      if (synonyms) {
        // 검색어가 유사어 리스트 중 하나를 포함하거나, 유사어 리스트가 검색어를 포함하는지 양방향 매치
        return synonyms.some(syn => {
          const cleanSyn = syn.toLowerCase().replace(/\s+/g, "");
          return cleanSyn.includes(q) || q.includes(cleanSyn);
        });
      }
      
      return false;
    });
  }, [catSearchQuery, flatCategories]);

  const [profileName, setProfileName] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<AttributeMasterItem[]>([]);
  const [storedValues, setStoredValues] = useState<Record<string, { value: any; text: string | null }>>({});

  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formTextValues, setFormTextValues] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. 카테고리 트리 및 기존 저장값 초기 로드
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const tree = await getCategoriesTree();
        setCategoriesTree(tree);

        const values = await getProductAttributeValues(productId);
        setStoredValues(values);

        // 기존 category_code 가 있으면 트리 경로를 역추적하여 콤보박스 세팅
        if (initialCategoryCode) {
          setupCategorySelectors(tree, initialCategoryCode);
          await loadAttributes(initialCategoryCode, values);
        } else {
          // 카테고리 미정 시 공통 속성만 로드
          await loadAttributes(null, values);
        }
        setHasInitialized(true);
      } catch (err) {
        console.error("데이터 로드 에러:", err);
      } finally {
        setLoading(false);
      }
    }
    
    if (!hasInitialized || productId) {
      init();
    }
  }, [productId]);

  // 카테고리 선택 값에 따라 콤보박스들 세팅
  const setupCategorySelectors = (tree: CategoryNode[], code: string) => {
    let cat1 = "";
    let cat2 = "";
    let cat3 = "";

    // 3Depth 전체 순회하며 부모 경로 찾기
    for (const c1 of tree) {
      if (c1.code === code) {
        cat1 = c1.code;
        break;
      }
      for (const c2 of c1.children) {
        if (c2.code === code) {
          cat1 = c1.code;
          cat2 = c2.code;
          break;
        }
        for (const c3 of c2.children) {
          if (c3.code === code) {
            cat1 = c1.code;
            cat2 = c2.code;
            cat3 = c3.code;
            break;
          }
        }
      }
    }

    setSelectedCat1(cat1);
    setSelectedCat2(cat2);
    setSelectedCat3(cat3);
  };

  // 속성 양식 로드 및 폼 상태 바인딩
  const loadAttributes = async (
    categoryCode: string | null,
    valMap: Record<string, { value: any; text: string | null }>
  ) => {
    const res = await getCategoryAttributes(categoryCode);
    setProfileName(res.profileName);
    setAttributes(res.attributes);

    const initialVals: Record<string, any> = {};
    const initialTexts: Record<string, string> = {};

    res.attributes.forEach((attr) => {
      // 1) 기존 color_map 연동 처리 (COLOR_FAMILY 속성의 경우)
      if (attr.code === "COLOR_FAMILY" && colorMap) {
        initialVals[attr.code] = colorMap;
        initialTexts[attr.code] = "";
        return;
      }

      const stored = valMap[attr.code];
      if (stored) {
        initialVals[attr.code] = stored.value;
        initialTexts[attr.code] = stored.text || "";
      } else {
        // Fallback defaults
        if (attr.inputType === "MULTI_SELECT") {
          initialVals[attr.code] = [];
        } else if (attr.inputType === "YES_NO_NA") {
          initialVals[attr.code] = "NA";
        } else {
          initialVals[attr.code] = "";
        }
        initialTexts[attr.code] = "";
      }
    });

    setFormValues(initialVals);
    setFormTextValues(initialTexts);
  };

  // 1Depth 변경
  const handleCat1Change = async (val: string) => {
    setSelectedCat1(val);
    setSelectedCat2("");
    setSelectedCat3("");
    
    // 부모 카테고리 코드 기준으로 임시 로드
    await loadAttributes(val || null, storedValues);
  };

  // 2Depth 변경
  const handleCat2Change = async (val: string) => {
    setSelectedCat2(val);
    setSelectedCat3("");
    await loadAttributes(val || selectedCat1 || null, storedValues);
  };

  // 3Depth 변경
  const handleCat3Change = async (val: string) => {
    setSelectedCat3(val);
    await loadAttributes(val || selectedCat2 || selectedCat1 || null, storedValues);
  };

  const getActiveCat2Options = () => {
    const parent = categoriesTree.find(c => c.code === selectedCat1);
    return parent?.children || [];
  };

  const getActiveCat3Options = () => {
    const cat2s = getActiveCat2Options();
    const parent = cat2s.find(c => c.code === selectedCat2);
    return parent?.children || [];
  };

  const getSelectedFinalCategory = (): CategoryNode | null => {
    if (selectedCat3) {
      const c3s = getActiveCat3Options();
      return c3s.find(c => c.code === selectedCat3) || null;
    }
    if (selectedCat2) {
      const c2s = getActiveCat2Options();
      return c2s.find(c => c.code === selectedCat2) || null;
    }
    if (selectedCat1) {
      return categoriesTree.find(c => c.code === selectedCat1) || null;
    }
    return null;
  };

  const formatUnit = (unit: string | null) => {
    if (!unit) return "";
    const u = unit.toUpperCase();
    if (u === "CELSIUS") return "℃";
    if (u === "MONTH") return "개월";
    if (u === "PERCENT") return "%";
    return unit;
  };

  const finalCat = getSelectedFinalCategory();
  const isFinalCategorySelected = finalCat ? finalCat.isFinal : false;

  // 폼 입력값 수정
  const updateValue = (code: string, value: any) => {
    setFormValues(prev => ({ ...prev, [code]: value }));
  };

  const updateTextValue = (code: string, text: string) => {
    setFormTextValues(prev => ({ ...prev, [code]: text }));
  };

  // 저장 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const categoryCode = finalCat ? finalCat.code : null;

    // 최종 카테고리가 필수는 아니나, 지정된 경우 필수 속성들의 유효성 검사 수행
    const missingRequired: string[] = [];
    attributes.forEach((attr) => {
      const val = formValues[attr.code];
      const isAttrRequired = attr.isRequired;

      // 수정 불가능한 필드는 검증에서 예외 처리
      const isEditable = isAdmin ? true : (attr.brandEditable && !attr.adminOnly);
      if (!isEditable) return;

      if (isAttrRequired) {
        if (attr.inputType === "MULTI_SELECT") {
          if (!val || val.length === 0) missingRequired.push(attr.nameKo);
        } else {
          if (val === null || val === undefined || String(val).trim() === "") {
            missingRequired.push(attr.nameKo);
          }
        }
      }
    });

    if (missingRequired.length > 0) {
      setFeedback({
        type: "error",
        text: `필수 입력 속성이 누락되었습니다: ${missingRequired.join(", ")}`,
      });
      return;
    }

    setSaving(true);
    startTransition(async () => {
      try {
        await saveProductAttributeValues(productId, categoryCode, formValues, formTextValues);
        router.refresh();
        setFeedback({
          type: "success",
          text: "카테고리 및 동적 속성 정보가 데이터베이스에 안전하게 저장되었습니다.",
        });
      } catch (err: any) {
        setFeedback({
          type: "error",
          text: err.message || "속성값 저장 중 오류가 발생했습니다.",
        });
      } finally {
        setSaving(false);
      }
    });
  };

  // 완성도 계산 (지정된 속성 중 값이 채워진 비율)
  const calculateCompleteness = () => {
    if (attributes.length === 0) return 100;
    let filled = 0;
    attributes.forEach((attr) => {
      const val = formValues[attr.code];
      if (attr.inputType === "MULTI_SELECT") {
        if (val && val.length > 0) filled++;
      } else {
        if (val !== null && val !== undefined && String(val).trim() !== "") filled++;
      }
    });
    return Math.round((filled / attributes.length) * 100);
  };

  // 미진행 속성 목록 반환 (실무자가 어떤 항목이 누락되었는지 인지하도록 지원)
  const getUnfilledAttributes = () => {
    const unfilled: string[] = [];
    attributes.forEach((attr) => {
      const val = formValues[attr.code];
      let isFilled = false;
      if (attr.inputType === "MULTI_SELECT") {
        if (val && val.length > 0) isFilled = true;
      } else {
        if (val !== null && val !== undefined && String(val).trim() !== "") isFilled = true;
      }
      if (!isFilled) {
        unfilled.push(attr.nameKo);
      }
    });
    return unfilled;
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <svg className="animate-spin h-8 w-8 text-violet-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-slate-400 text-sm">카테고리 체계 및 속성 양식 로드 중...</span>
      </div>
    );
  }

  const completeness = calculateCompleteness();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 text-zinc-800 dark:text-zinc-200">
      
      {/* 1. 3Depth 카테고리 지정 카드 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-6">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            📂 제품 카테고리 지정
          </h3>
          {completeness > 0 && (
            <div className="flex flex-col items-end gap-1">
              <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                속성 완성도 <strong className="text-zinc-900 dark:text-white font-extrabold">{completeness}%</strong>
              </span>
            </div>
          )}
        </div>

        {/* 1.1 카테고리 검색 & 추천 입력 상자 */}
        <div className="mb-6 p-4 bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl relative">
          <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 block mb-2">
            🔍 카테고리 간편 검색 및 추천 (예: 비비크림, 샴푸, 립밤 등 키워드 입력)
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="카테고리명 또는 키워드를 입력해 보세요..."
              value={catSearchQuery}
              onChange={(e) => setCatSearchQuery(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            {catSearchQuery && (
              <button
                type="button"
                onClick={() => setCatSearchQuery("")}
                className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold"
              >
                지우기
              </button>
            )}
          </div>

          {/* 검색 추천 결과 목록 */}
          {searchResults.length > 0 && (
            <div className="mt-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900 shadow-2xl z-30 relative">
              {searchResults.map((result) => (
                <div key={result.code} className="p-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">{result.pathName}</span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">{result.code}</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setupCategorySelectors(categoriesTree, result.code);
                      await loadAttributes(result.code, storedValues);
                      setCatSearchQuery(""); // 검색창 리셋
                    }}
                    className="bg-indigo-650 hover:bg-indigo-750 active:scale-95 transition-all text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow cursor-pointer"
                  >
                    선택 적용
                  </button>
                </div>
              ))}
            </div>
          )}

          {catSearchQuery.trim() !== "" && searchResults.length === 0 && (
            <div className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 italic p-1">
              일치하는 카테고리 추천 정보가 없습니다. 다른 단어로 검색해 보세요.
            </div>
          )}
        </div>

        {/* 대/중/소 콤보박스 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          {/* 1Depth */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">1Depth 대분류</label>
            <select
              id="category-depth-1"
              value={selectedCat1}
              onChange={(e) => handleCat1Change(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-1"
            >
              <option value="">대분류 선택</option>
              {categoriesTree.map(c => (
                <option key={c.code} value={c.code}>{c.nameKo} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* 2Depth */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">2Depth 중분류</label>
            <select
              id="category-depth-2"
              value={selectedCat2}
              onChange={(e) => handleCat2Change(e.target.value)}
              disabled={!selectedCat1}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">중분류 선택</option>
              {getActiveCat2Options().map(c => (
                <option key={c.code} value={c.code}>{c.nameKo} ({c.code})</option>
              ))}
            </select>
          </div>

          {/* 3Depth */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">3Depth 소분류</label>
            <select
              id="category-depth-3"
              value={selectedCat3}
              onChange={(e) => handleCat3Change(e.target.value)}
              disabled={!selectedCat2}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 focus:ring-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">소분류 선택</option>
              {getActiveCat3Options().map(c => (
                <option key={c.code} value={c.code}>{c.nameKo} ({c.code})</option>
              ))}
            </select>
          </div>
        </div>

        {finalCat && !isFinalCategorySelected && (
          <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            주의: 선택된 분류는 최종 카테고리(Final Category)가 아닙니다. 최적의 제품군 프로필 매핑을 위해 하위 분류까지 정확하게 선택해주세요.
          </div>
        )}

        {/* 미완료(미입력) 속성 목록 표출 가이드 */}
        {attributes.length > 0 && completeness < 100 && (
          <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-800/80 rounded-xl text-xs space-y-2">
            <div className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>미입력 속성 항목 ({getUnfilledAttributes().length}개)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {getUnfilledAttributes().map((name, idx) => (
                <span key={idx} className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {attributes.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-zinc-400 dark:text-zinc-500 text-sm shadow-sm">
          카테고리를 지정하시면 작성 가능한 상세 속성 입력창이 여기에 생성됩니다.
        </div>
      ) : (
        <div className="space-y-8">
          {/* 2. 공통 속성 그룹 */}
          {attributes.filter(a => a.scope === "COMMON").length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-6 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                <span>공통 속성 입력 (모든 제품군 공통)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {attributes.filter(a => a.scope === "COMMON").map((attr) => renderField(attr))}
              </div>
            </div>
          )}

          {/* 3. 프로필 전용 속성 그룹 */}
          {attributes.filter(a => a.scope === "PROFILE").length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
              <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>제품군 프로필별 추가 속성 입력</span>
                </h3>
                {profileName && (
                  <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-full text-xs font-bold shadow-sm self-start sm:self-auto">
                    🧬 매핑 프로필: <strong className="text-indigo-850 dark:text-white font-extrabold">{profileName}</strong>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {attributes.filter(a => a.scope === "PROFILE").map((attr) => renderField(attr))}
              </div>
            </div>
          )}
        </div>
      )}

      {feedback && (
        <div className={`
          p-4 rounded-xl text-sm flex items-center gap-2 animate-fadeIn border
          ${feedback.type === "success" 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
          }
        `}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {feedback.text}
        </div>
      )}

      {/* 하단 저장 버튼 */}
      {attributes.length > 0 && (
        <div className="flex justify-end pt-4 border-t border-zinc-150 dark:border-zinc-800">
          <button
            id="save-attributes-btn"
            type="submit"
            disabled={saving || isPending}
            className={`
              flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm shadow-md transition-all duration-300 cursor-pointer
              ${saving || isPending
                ? 'bg-zinc-250 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-zinc-750'
                : 'bg-indigo-650 hover:bg-indigo-750 text-white hover:scale-[1.02] active:scale-[0.98]'
              }
            `}
          >
            {(saving || isPending) ? (
              <>
                <svg className="animate-spin h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                저장 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                카테고리 & 속성 정보 저장
              </>
            )}
          </button>
        </div>
      )}

    </form>
  );

  // 개별 필드 렌더러 함수
  function renderField(attr: AttributeMasterItem) {
    const isEditable = isAdmin ? true : (attr.brandEditable && !attr.adminOnly);
    const val = formValues[attr.code];
    const textVal = formTextValues[attr.code] || "";

    return (
      <div key={attr.code} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
            {attr.nameKo}
            {attr.isRequired && <span className="text-rose-500" title="필수">*</span>}
            {attr.nameEn && <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal">({attr.nameEn})</span>}
          </label>
        </div>

        {attr.helpText && (
          <span className="text-xs text-zinc-450 dark:text-zinc-500 leading-normal">{attr.helpText}</span>
        )}

        {/* 3.1 SINGLE_SELECT 드롭다운 */}
        {attr.inputType === "SINGLE_SELECT" && (
          <div className="flex flex-col gap-2">
            <select
              id={`attr-input-${attr.code}`}
              value={val || ""}
              disabled={!isEditable || saving}
              onChange={(e) => updateValue(attr.code, e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-60"
            >
              <option value="">선택 안함</option>
              {attr.options.map(o => (
                <option key={o.optionCode} value={o.optionCode}>{o.optionKo}</option>
              ))}
              {attr.allowOther && (
                <option value="OTHER">기타 (직접 입력)</option>
              )}
            </select>
            {attr.allowOther && val === "OTHER" && (
              <input
                id={`attr-text-input-${attr.code}`}
                type="text"
                placeholder="상세 내용을 직접 기재하세요..."
                value={textVal}
                disabled={!isEditable || saving}
                onChange={(e) => updateTextValue(attr.code, e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2 text-xs focus:outline-none"
              />
            )}
          </div>
        )}

        {/* 3.2 MULTI_SELECT 체크박스 그룹 */}
        {attr.inputType === "MULTI_SELECT" && (
          <div className="flex flex-col gap-2.5 bg-zinc-50/50 dark:bg-zinc-950/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
              {attr.options.map(o => {
                const list = Array.isArray(val) ? val : [];
                const checked = list.includes(o.optionCode);
                return (
                  <label 
                    key={o.optionCode} 
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors
                      ${checked 
                        ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-semibold border border-indigo-100 dark:border-indigo-900/30' 
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400 border border-transparent'}
                      ${!isEditable ? 'opacity-65 cursor-not-allowed' : ''}
                    `}
                  >
                    <input
                      id={`attr-checkbox-${attr.code}-${o.optionCode}`}
                      type="checkbox"
                      checked={checked}
                      disabled={!isEditable || saving}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateValue(attr.code, [...list, o.optionCode]);
                        } else {
                          updateValue(attr.code, list.filter(item => item !== o.optionCode));
                        }
                      }}
                      className="rounded text-indigo-650 focus:ring-indigo-500 bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-800"
                    />
                    {o.optionKo}
                  </label>
                );
              })}
            </div>
            {attr.allowOther && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <label className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">기타 직접입력:</label>
                <input
                  id={`attr-text-input-multi-${attr.code}`}
                  type="text"
                  placeholder="콤마(,) 등으로 구분하여 입력..."
                  value={textVal}
                  disabled={!isEditable || saving}
                  onChange={(e) => updateTextValue(attr.code, e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 w-full focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* 3.3 YES_NO_NA 토글 그룹 */}
        {attr.inputType === "YES_NO_NA" && (
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-950/50 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-fit">
            {[
              { key: "YES", label: "예" },
              { key: "NO", label: "아니오" },
              { key: "NA", label: "해당없음" }
            ].map((item) => (
              <button
                id={`attr-btn-${attr.code}-${item.key}`}
                key={item.key}
                type="button"
                disabled={!isEditable || saving}
                onClick={() => updateValue(attr.code, item.key)}
                className={`
                  px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer
                  ${val === item.key 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* 3.4 NUMBER_UNIT (숫자 + 단위) */}
        {attr.inputType === "NUMBER_UNIT" && (
          <div className="flex items-center gap-2">
            <input
              id={`attr-number-input-${attr.code}`}
              type="number"
              placeholder="숫자 입력"
              value={val || ""}
              disabled={!isEditable || saving}
              onChange={(e) => updateValue(attr.code, e.target.value === "" ? "" : Number(e.target.value))}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-60"
            />
            {attr.unitSet && (
              <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-500 dark:text-zinc-450 shrink-0">
                {formatUnit(attr.unitSet)}
              </span>
            )}
          </div>
        )}

        {/* 3.5 NUMBER_RANGE_UNIT (최소~최대 범위) */}
        {attr.inputType === "NUMBER_RANGE_UNIT" && (
          <div className="flex items-center gap-2">
            <input
              id={`attr-range-min-${attr.code}`}
              type="number"
              placeholder="최소"
              value={Array.isArray(val) ? val[0] || "" : ""}
              disabled={!isEditable || saving}
              onChange={(e) => {
                const max = Array.isArray(val) ? val[1] || "" : "";
                updateValue(attr.code, [e.target.value === "" ? "" : Number(e.target.value), max]);
              }}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-60"
            />
            <span className="text-zinc-400 dark:text-zinc-600 font-bold shrink-0">~</span>
            <input
              id={`attr-range-max-${attr.code}`}
              type="number"
              placeholder="최대"
              value={Array.isArray(val) ? val[1] || "" : ""}
              disabled={!isEditable || saving}
              onChange={(e) => {
                const min = Array.isArray(val) ? val[0] || "" : "";
                updateValue(attr.code, [min, e.target.value === "" ? "" : Number(e.target.value)]);
              }}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-60"
            />
            {attr.unitSet && (
              <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-500 dark:text-zinc-450 shrink-0">
                {formatUnit(attr.unitSet)}
              </span>
            )}
          </div>
        )}

        {/* 3.6 TEXT (단문 텍스트) */}
        {attr.inputType === "TEXT" && (
          <input
            id={`attr-text-field-${attr.code}`}
            type="text"
            placeholder="내용 입력"
            value={val || ""}
            disabled={!isEditable || saving}
            onChange={(e) => updateValue(attr.code, e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-60"
          />
        )}

        {/* 3.7 LONG_TEXT (장문 텍스트) */}
        {attr.inputType === "LONG_TEXT" && (
          <textarea
            id={`attr-textarea-field-${attr.code}`}
            placeholder="상세 내용 기재..."
            rows={3}
            value={val || ""}
            disabled={!isEditable || saving}
            onChange={(e) => updateValue(attr.code, e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-zinc-900 dark:focus:border-zinc-100 disabled:opacity-60 resize-y"
          />
        )}
      </div>
    );
  }
}
