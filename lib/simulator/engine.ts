import { createAdminClient } from "@/lib/supabase/admin";
import { SimulationResult } from "./types";

// AP Code and naming mapping definition
const AP_CODE_MAP = {
  BALANCE: "AP-01",
  SKIN: "AP-02",
  HAIR: "AP-03",
  ESSENTIAL: "AP-04",
  TREND: "AP-05",
  PREMIUM: "AP-06"
} as const;

const AP_DESCRIPTIONS = {
  BALANCE: "균형 잡힌 스탠다드 믹스",
  SKIN: "스킨케어 집중 솔루션 구성",
  HAIR: "헤어케어 전문 특화 구성",
  ESSENTIAL: "데일리 필수 상품 및 가성비 보강",
  TREND: "트렌디 소셜 히트 아이템 매칭",
  PREMIUM: "고기능성 프리미엄 솔루션 구성"
} as const;

// In-memory configuration cache
let cachedConfig: {
  questionnaireId: string;
  version: number;
  questions: any[];
  answers: any[];
  mappings: any[];
  parameters: Record<string, any>;
  apMatchingTags: any[];
  matchingTags: any[];
  labelToAnswerIdMap: Record<string, string>;
  answerIdToMappingMap: Record<string, any>;
  assortmentProfiles: any[];
  conditionalRules: any[];
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache TTL

async function getPublishedConfig(supabase: any) {
  const now = Date.now();
  if (cachedConfig && (now - cachedConfig.timestamp < CACHE_TTL_MS)) {
    return cachedConfig;
  }

  // 1. Fetch active questionnaire
  const { data: questionnaire, error: qnErr } = await supabase
    .from('simulator_questionnaires')
    .select('id, version')
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (qnErr || !questionnaire) {
    throw new Error(`Failed to load active questionnaire configuration: ${qnErr?.message || "Not found"}`);
  }

  const qnId = questionnaire.id;

  // 2. Fetch questions, answers, mappings, rules, and parameters in parallel
  const [
    { data: questions },
    { data: answers },
    { data: mappings },
    { data: parameters },
    { data: apMatchingTags },
    { data: matchingTags },
    { data: assortmentProfiles },
    { data: conditionalRules }
  ] = await Promise.all([
    supabase.from('simulator_questions').select('*').eq('questionnaire_id', qnId),
    supabase.from('simulator_answers').select('*'), // will map locally via questions
    supabase.from('simulator_answer_mappings').select('*'),
    supabase.from('simulator_parameters').select('*').eq('questionnaire_id', qnId),
    supabase.from('ap_matching_tags').select('*'),
    supabase.from('matching_tags').select('*').eq('is_active', true),
    supabase.from('assortment_profiles').select('*'),
    supabase.from('simulator_conditional_rules').select('*').eq('questionnaire_id', qnId)
  ]);

  // Build lookup maps
  const questionsUuidToIdMap: Record<string, string> = {};
  questions?.forEach((q: any) => {
    questionsUuidToIdMap[q.id] = q.question_id;
  });

  const labelToAnswerIdMap: Record<string, string> = {};
  answers?.forEach((ans: any) => {
    const qId = questionsUuidToIdMap[ans.question_id];
    if (qId) {
      labelToAnswerIdMap[`${qId}:${ans.label_ko.trim()}`] = ans.answer_id;
      labelToAnswerIdMap[`${qId}:${ans.label_en.trim()}`] = ans.answer_id;
    }
  });

  const answerIdToMappingMap: Record<string, any> = {};
  const answerUuidToIdMap: Record<string, string> = {};
  answers?.forEach((ans: any) => {
    answerUuidToIdMap[ans.id] = ans.answer_id;
  });

  mappings?.forEach((m: any) => {
    const ansId = answerUuidToIdMap[m.answer_id];
    if (ansId) {
      answerIdToMappingMap[ansId] = m;
    }
  });

  const parametersMap: Record<string, any> = {};
  parameters?.forEach((p: any) => {
    parametersMap[p.parameter_key] = p.parameter_value;
  });

  cachedConfig = {
    questionnaireId: qnId,
    version: questionnaire.version,
    questions: questions || [],
    answers: answers || [],
    mappings: mappings || [],
    parameters: parametersMap,
    apMatchingTags: apMatchingTags || [],
    matchingTags: matchingTags || [],
    assortmentProfiles: assortmentProfiles || [],
    conditionalRules: conditionalRules || [],
    labelToAnswerIdMap,
    answerIdToMappingMap,
    timestamp: now
  };

  return cachedConfig;
}

export async function simulateGrowth(answers: Record<string, any>): Promise<SimulationResult & { trace?: any; versions?: any }> {
  const supabase = createAdminClient();
  const config = await getPublishedConfig(supabase);

  // 1. Resolve option IDs safely from both ID-format and Label-format inputs
  const resolvedAnswers: Record<string, string[]> = {};
  config.questions.forEach(q => {
    const qId = q.question_id;
    const rawVal = answers[qId];
    if (rawVal === undefined || rawVal === null) return;

    const values = Array.isArray(rawVal) ? rawVal : [rawVal];
    const resolved: string[] = [];

    values.forEach(v => {
      let valStr = '';
      if (typeof v === 'string') {
        valStr = v;
      } else if (v && typeof v === 'object') {
        if (typeof (v as any).option_id === 'string') {
          valStr = (v as any).option_id;
        } else if (typeof (v as any).answer_id === 'string') {
          valStr = (v as any).answer_id;
        } else if (typeof (v as any).id === 'string') {
          valStr = (v as any).id;
        }
      }

      if (valStr) {
        const trimmed = valStr.trim();
        if (/^Q\d+_A\d+$/.test(trimmed)) {
          resolved.push(trimmed);
        } else {
          const key = `${qId}:${trimmed}`;
          if (config.labelToAnswerIdMap[key]) {
            resolved.push(config.labelToAnswerIdMap[key]);
          }
        }
      }
    });

    resolvedAnswers[qId] = resolved;
  });

  // 1.5. Prune conditional questions if their trigger conditions are not met
  const conditionalRules = config.conditionalRules || [];
  conditionalRules.forEach((rule: any) => {
    const target = rule.target_question_id;
    const trigger = rule.trigger_question_id;
    const triggerValues = rule.trigger_values || [];

    const parentAns = resolvedAnswers[trigger] || [];
    const isTriggered = parentAns.some(val => triggerValues.includes(val));
    if (!isTriggered) {
      // Discard target question answers since condition is not met
      delete resolvedAnswers[target];
    }
  });

  // 2. Display Program Hard Constraints
  const validPrograms = new Set<string>(["START", "GROW", "EXPAND"]);
  
  // Space constraint checks (Q2) - ONLY Q2 can hard-exclude programs
  const q2_ans = resolvedAnswers["Q2"]?.[0];
  if (q2_ans === "Q2_A1") {
    validPrograms.delete("GROW");
    validPrograms.delete("EXPAND");
  } else if (q2_ans === "Q2_A2") {
    validPrograms.delete("EXPAND");
  }

  // 3. Display Program Scoring
  const programScores = { START: 0, GROW: 0, EXPAND: 0 };
  const display_weights = config.parameters.display_weights || { WEAK: 1.00, MEDIUM: 2.00, STRONG: 3.00 };

  Object.entries(resolvedAnswers).forEach(([qId, ansIds]) => {
    ansIds.forEach(ansId => {
      const mapping = config.answerIdToMappingMap[ansId];
      if (mapping && mapping.display_signal) {
        let weight = 0.0;
        if (mapping.display_strength === "WEAK_EVIDENCE") weight = display_weights.WEAK;
        else if (mapping.display_strength === "MEDIUM_EVIDENCE") weight = display_weights.MEDIUM;
        else if (mapping.display_strength === "STRONG_EVIDENCE") weight = display_weights.STRONG;

        const signals = mapping.display_signal.split('/');
        signals.forEach((sig: string) => {
          const cleanSig = sig.trim().toUpperCase();
          if (cleanSig.includes("START")) programScores.START += weight;
          if (cleanSig.includes("GROW")) programScores.GROW += weight;
          if (cleanSig.includes("EXPAND")) programScores.EXPAND += weight;
        });
      }
    });
  });

  // Resolve recommended program with tie-breakers
  const candidates = Array.from(validPrograms);
  if (candidates.length === 0) {
    candidates.push("GROW"); // Fallback
  }
  
  candidates.sort((a, b) => {
    const diff = programScores[b as keyof typeof programScores] - programScores[a as keyof typeof programScores];
    if (diff !== 0) return diff;

    // Tie-break 1: Physical Space (Q2)
    if (q2_ans) {
      if (q2_ans === "Q2_A1") {
        if (a === "START") return -1;
        if (b === "START") return 1;
      } else if (q2_ans === "Q2_A2") {
        if (a === "GROW") return -1;
        if (b === "GROW") return 1;
      } else if (q2_ans === "Q2_A3" || q2_ans === "Q2_A4") {
        if (a === "EXPAND") return -1;
        if (b === "EXPAND") return 1;
        if (a === "GROW") return -1;
        if (b === "GROW") return 1;
      }
    }

    // Tie-break 2: Current Operating Scale (Q4)
    const q4_ans = resolvedAnswers["Q4"]?.[0];
    if (q4_ans) {
      if (q4_ans === "Q4_A3") { // 4FT
        if (a === "GROW") return -1;
        if (b === "GROW") return 1;
      } else if (q4_ans === "Q4_A4") { // 8FT
        if (a === "EXPAND") return -1;
        if (b === "EXPAND") return 1;
      } else if (q4_ans === "Q4_A5") { // 12FT+
        if (a === "EXPAND") return -1;
        if (b === "EXPAND") return 1;
      }
    }

    // Tie-break 3: Conservative min-risk preference (START > GROW > EXPAND)
    const order = { START: 1, GROW: 2, EXPAND: 3 };
    return order[a as keyof typeof order] - order[b as keyof typeof order];
  });

  const program = candidates[0] as "START" | "GROW" | "EXPAND";
  const programCode = program === "START" ? "START_4FT" : program === "GROW" ? "GROW_8FT" : "EXPAND_12FT";

  // Specs and costs mapping
  const programDefaults = config.parameters.program_defaults || {
    START: { cost: 3500 },
    GROW: { cost: 6800 },
    EXPAND: { cost: 10500 }
  };
  const defaultInvestment = programDefaults[program]?.cost || (program === "START" ? 3500 : program === "GROW" ? 6800 : 10500);

  const width_ft = program === "START" ? 4 : program === "GROW" ? 8 : 12;
  const sku_count = program === "START" ? 24 : program === "GROW" ? 48 : 72;
  const initial_units = program === "START" ? 300 : program === "GROW" ? 560 : 840;

  // 진열 사유(Reasons) 설정
  const reasons: string[] = [];
  const q1_ans = resolvedAnswers["Q1"]?.[0];
  if (q1_ans && q1_ans !== "Q1_A6") {
    const q1Label = config.answers.find(a => a.answer_id === q1_ans)?.label_ko || "";
    reasons.push(`귀하가 입력하신 매장 크기(${q1Label})에 안정적으로 안착될 수 있는 최적의 모듈형 규격입니다.`);
  } else {
    reasons.push("매장 내 동선 효율과 동종 유통점 평균 스페이스 대비 마진 수율이 가장 우수한 모듈 크기입니다.");
  }
  if (resolvedAnswers["Q10"]?.includes("Q10_A1") || resolvedAnswers["Q10"]?.includes("Q10_A2")) {
    reasons.push("매장 방문 고객들의 K-Beauty 브랜드 문의 빈도가 감지되어, 적극적인 시각 노출이 가능한 볼륨을 채택했습니다.");
  }
  if (resolvedAnswers["Q23"]?.[0]) {
    const q23Label = config.answers.find(a => a.answer_id === resolvedAnswers["Q23"][0])?.label_ko || "";
    reasons.push(`초기 상품 구성 및 성장 목표로 선택하신 '${q23Label}' 방향성과 높은 시너지 배치가 가능합니다.`);
  }

  // 4. Assortment Profile (AP) Scoring
  const apScores = { BALANCE: 0, SKIN: 0, HAIR: 0, ESSENTIAL: 0, TREND: 0, PREMIUM: 0 };
  const tag_weights = config.parameters.tag_weights || { WEAK: 1.00, MEDIUM: 2.00, STRONG: 3.00 };
  const q5_rank_weights = config.parameters.q5_rank_weights || [1.00, 0.70, 0.40];
  const max_question_contribution = config.parameters.multiselect?.max_question_contribution || 3.00;

  const tagIdToApIdsMap: Record<number, number[]> = {};
  config.apMatchingTags.forEach((relation: any) => {
    if (!tagIdToApIdsMap[relation.tag_id]) {
      tagIdToApIdsMap[relation.tag_id] = [];
    }
    tagIdToApIdsMap[relation.tag_id].push(relation.ap_id);
  });

  const tagCodeToIdMap: Record<string, number> = {};
  config.matchingTags.forEach((tag: any) => {
    tagCodeToIdMap[tag.tag_code] = tag.id;
  });

  config.questions.forEach(q => {
    const qId = q.question_id;
    const ansIds = resolvedAnswers[qId] || [];
    if (ansIds.length === 0) return;

    const apContributions: Record<string, number[]> = {
      BALANCE: [], SKIN: [], HAIR: [], ESSENTIAL: [], TREND: [], PREMIUM: []
    };

    const isQ5 = qId === "Q5";

    ansIds.forEach((ansId, idx) => {
      const mapping = config.answerIdToMappingMap[ansId];
      if (!mapping) return;

      const multiplier = isQ5 ? (q5_rank_weights[idx] || 0) : 1.00;

      // Tag-based contributions
      if (mapping.tag_code) {
        const tagId = tagCodeToIdMap[mapping.tag_code];
        let strengthVal = 0;
        if (mapping.tag_strength === "WEAK") strengthVal = tag_weights.WEAK;
        else if (mapping.tag_strength === "MEDIUM") strengthVal = tag_weights.MEDIUM;
        else if (mapping.tag_strength === "STRONG") strengthVal = tag_weights.STRONG;

        const contribution = strengthVal * multiplier;
        if (tagId && tagIdToApIdsMap[tagId]) {
          const linkedApIds = tagIdToApIdsMap[tagId];
          linkedApIds.forEach(apId => {
            const apRow = config.assortmentProfiles.find((ap: any) => ap.id === apId);
            if (apRow) {
              const apCode = Object.keys(AP_CODE_MAP).find(k => AP_CODE_MAP[k as keyof typeof AP_CODE_MAP] === apRow.code);
              if (apCode) {
                apContributions[apCode].push(contribution);
              }
            }
          });
        }
      }

      // Direct AP contributions
      if (mapping.direct_ap && mapping.direct_ap !== "NEUTRAL") {
        const directApCode = mapping.direct_ap;
        let strengthVal = tag_weights.STRONG;
        if (mapping.tag_strength === "WEAK") strengthVal = tag_weights.WEAK;
        else if (mapping.tag_strength === "MEDIUM") strengthVal = tag_weights.MEDIUM;

        const contribution = strengthVal * multiplier;
        if (apContributions[directApCode]) {
          apContributions[directApCode].push(contribution);
        }
      }
    });

    // Deduplication & Cap per AP per question
    Object.keys(AP_CODE_MAP).forEach(apKey => {
      const contributions = apContributions[apKey];
      if (contributions.length > 0) {
        const maxContribution = Math.max(...contributions);
        const cappedContribution = Math.min(maxContribution, max_question_contribution);
        apScores[apKey as keyof typeof apScores] += cappedContribution;
      }
    });
  });

  // Resolve Primary and Secondary APs with tie-breaker
  const apKeysSorted = (Object.keys(AP_CODE_MAP) as Array<keyof typeof AP_CODE_MAP>).slice();
  apKeysSorted.sort((a, b) => {
    const diff = apScores[b] - apScores[a];
    if (diff !== 0) return diff;

    // Tie-break: Behavioral Evidence Count (Q5 & Q9 score contribution)
    const getBehavioralScore = (ap: keyof typeof apScores) => {
      let bScore = 0;
      ["Q5", "Q9"].forEach(qId => {
        const ansIds = resolvedAnswers[qId] || [];
        ansIds.forEach(ansId => {
          const mapping = config.answerIdToMappingMap[ansId];
          if (!mapping) return;
          if (mapping.direct_ap === ap) bScore += tag_weights.STRONG;
          if (mapping.tag_code) {
            const tagId = tagCodeToIdMap[mapping.tag_code];
            if (tagId && tagIdToApIdsMap[tagId]) {
              const linkedApIds = tagIdToApIdsMap[tagId];
              linkedApIds.forEach(apId => {
                const apRow = config.assortmentProfiles.find((ap: any) => ap.id === apId);
                if (apRow && apRow.code === AP_CODE_MAP[ap]) {
                  bScore += (mapping.tag_strength === "STRONG" ? tag_weights.STRONG : mapping.tag_strength === "MEDIUM" ? tag_weights.MEDIUM : tag_weights.WEAK);
                }
              });
            }
          }
        });
      });
      return bScore;
    };

    const bDiff = getBehavioralScore(b) - getBehavioralScore(a);
    if (bDiff !== 0) return bDiff;

    // Deterministic order
    const defaultOrder = { BALANCE: 1, SKIN: 2, HAIR: 3, ESSENTIAL: 4, TREND: 5, PREMIUM: 6 };
    return defaultOrder[a] - defaultOrder[b];
  });

  const primaryKey = apKeysSorted[0];
  let secondaryKey = apKeysSorted[1];
  if (primaryKey === secondaryKey) {
    secondaryKey = "ESSENTIAL";
  }

  // Fetch Recommended Products for Primary AP
  const primaryApCode = AP_CODE_MAP[primaryKey];
  const { data: apProfile } = await supabase
    .from("assortment_profiles")
    .select("id, name, target_sku")
    .eq("display_program", programCode)
    .eq("code", primaryApCode)
    .single();

  // Strict Allowlist Product Eligibility Filter Helper (Fail-Closed)
  function isEligibleProduct(prod: any): { eligible: boolean; reason?: string } {
    if (!prod) return { eligible: false, reason: "Product is null" };

    // 1. 브랜드 활성화 상태 체크 (명시적 true 요구 - Fail Closed)
    if (!prod.brand || prod.brand.is_active !== true) {
      return { eligible: false, reason: "Brand is not active (is_active !== true)" };
    }

    // 2. Product Master 상태값 Strict Allowlist 체크
    if (prod.status !== "selling") {
      return { eligible: false, reason: `Status '${prod.status}' is not 'selling'` };
    }

    if (prod.sales_status !== "ON_SALE") {
      return { eligible: false, reason: `Sales status '${prod.sales_status}' is not 'ON_SALE'` };
    }

    if (prod.selection_status !== "SELECTED") {
      return { eligible: false, reason: `Selection status '${prod.selection_status}' is not 'SELECTED'` };
    }

    // 3. 보조 안전장치: 더미/테스트 상품 브랜드 및 상품명 패턴 제외
    const brandName = (prod.brand?.name || "").trim().toLowerCase();
    const prodName = (prod.name || "").trim().toLowerCase();

    if (
      brandName === "test" ||
      brandName === "테스트 브랜드" ||
      brandName.startsWith("test-") ||
      brandName.startsWith("test ")
    ) {
      return { eligible: false, reason: `Dummy brand '${prod.brand?.name}'` };
    }

    if (
      prodName === "test" ||
      prodName.startsWith("test") ||
      prodName.includes("스크립트검증") ||
      prodName.includes("테스트")
    ) {
      return { eligible: false, reason: `Dummy product '${prod.name}'` };
    }

    return { eligible: true };
  }

  let recommended_products: any[] = [];
  let candidateDiagnosis: string | null = null;

  if (apProfile) {
    const { data: matrixItems } = await supabase
      .from("product_curation_matrix")
      .select(`
        priority_role,
        product:product_id (
          id,
          name,
          status,
          sales_status,
          selection_status,
          estimated_retail_price,
          category_code,
          brand:brand_id (
            id,
            name,
            is_active
          ),
          product_images (
            storage_path,
            position
          )
        )
      `)
      .eq("ap_id", apProfile.id)
      .in("priority_role", ["REQUIRED", "CORE", "OPTIONAL"])
      .order("priority_role", { ascending: true })
      .limit(20);

    if (matrixItems) {
      const eligibleItems = matrixItems.filter((item: any) => {
        const prod = item.product;
        const check = isEligibleProduct(prod);
        return check.eligible;
      });

      if (eligibleItems.length > 0) {
        recommended_products = eligibleItems.map((item: any) => {
          const prod = item.product;
          const images = prod.product_images || [];
          const mainImg = images.find((i: any) => i.position === 0) || images[0];
          const imgUrl = mainImg 
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co"}/storage/v1/object/public/company-uploads/${mainImg.storage_path}`
            : null;

          return {
            id: prod.id,
            name: prod.name,
            brand_name: prod.brand?.name || "(미확인 브랜드)",
            estimated_retail_price: parseFloat(prod.estimated_retail_price) || 0,
            sales_status: prod.sales_status,
            category_code: prod.category_code,
            image_url: imgUrl,
            priority_role: item.priority_role,
            is_synthetic: false
          };
        });
      } else {
        candidateDiagnosis = "eligible product candidate insufficient";
      }
    } else {
      candidateDiagnosis = "eligible product candidate insufficient";
    }

    // Calibration Mode / Sandbox Fallback: Load Synthetic Catalog if live eligible products are 0
    if (recommended_products.length === 0) {
      const { getSyntheticProductsForAp } = require("./synthetic-catalog");
      const synthList = getSyntheticProductsForAp(primaryApCode);
      if (synthList && synthList.length > 0) {
        recommended_products = synthList.map((p: any) => ({
          id: p.id,
          name: p.name,
          brand_name: p.brand_name,
          estimated_retail_price: p.estimated_retail_price,
          wholesale_price: p.wholesale_price,
          sales_status: p.sales_status,
          category_code: p.category_code,
          image_url: p.image_url,
          priority_role: p.curation_role,
          is_synthetic: true
        }));
      }
    }
  }

  // Category Mix Resolution
  let category_mix = [
    { category: "스킨케어 (Skincare)", percentage: 40, color: "#ff2b75" },
    { category: "헤어 케어 (Hair Care)", percentage: 20, color: "#4f46e5" },
    { category: "메이크업 (Makeup)", percentage: 20, color: "#10b981" },
    { category: "바디 케어 (Body Care)", percentage: 10, color: "#f59e0b" },
    { category: "뷰티 툴 (Beauty Tools)", percentage: 10, color: "#8b5cf6" }
  ];

  if (primaryKey === "SKIN") {
    category_mix = [
      { category: "스킨케어 (Skincare)", percentage: 65, color: "#ff2b75" },
      { category: "헤어 케어 (Hair Care)", percentage: 10, color: "#4f46e5" },
      { category: "메이크업 (Makeup)", percentage: 10, color: "#10b981" },
      { category: "바디 케어 (Body Care)", percentage: 10, color: "#f59e0b" },
      { category: "뷰티 툴 (Beauty Tools)", percentage: 5, color: "#8b5cf6" }
    ];
  } else if (primaryKey === "HAIR") {
    category_mix = [
      { category: "스킨케어 (Skincare)", percentage: 20, color: "#ff2b75" },
      { category: "헤어 케어 (Hair Care)", percentage: 60, color: "#4f46e5" },
      { category: "메이크업 (Makeup)", percentage: 10, color: "#10b981" },
      { category: "바디 케어 (Body Care)", percentage: 5, color: "#f59e0b" },
      { category: "뷰티 툴 (Beauty Tools)", percentage: 5, color: "#8b5cf6" }
    ];
  } else if (primaryKey === "ESSENTIAL") {
    category_mix = [
      { category: "스킨케어 (Skincare)", percentage: 40, color: "#ff2b75" },
      { category: "헤어 케어 (Hair Care)", percentage: 15, color: "#4f46e5" },
      { category: "메이크업 (Makeup)", percentage: 15, color: "#10b981" },
      { category: "바디 케어 (Body Care)", percentage: 20, color: "#f59e0b" },
      { category: "뷰티 툴 (Beauty Tools)", percentage: 10, color: "#8b5cf6" }
    ];
  } else if (primaryKey === "TREND") {
    category_mix = [
      { category: "스킨케어 (Skincare)", percentage: 30, color: "#ff2b75" },
      { category: "헤어 케어 (Hair Care)", percentage: 10, color: "#4f46e5" },
      { category: "메이크업 (Makeup)", percentage: 40, color: "#10b981" },
      { category: "바디 케어 (Body Care)", percentage: 10, color: "#f59e0b" },
      { category: "뷰티 툴 (Beauty Tools)", percentage: 10, color: "#8b5cf6" }
    ];
  } else if (primaryKey === "PREMIUM") {
    category_mix = [
      { category: "스킨케어 (Skincare)", percentage: 60, color: "#ff2b75" },
      { category: "헤어 케어 (Hair Care)", percentage: 20, color: "#4f46e5" },
      { category: "메이크업 (Makeup)", percentage: 10, color: "#10b981" },
      { category: "바디 케어 (Body Care)", percentage: 5, color: "#f59e0b" },
      { category: "뷰티 툴 (Beauty Tools)", percentage: 5, color: "#8b5cf6" }
    ];
  }

  // 5. Turnover & Financial Calculation V1.1 Calibration
  // A. Dynamic Initial Investment Calculation (SKU Count * 12 units * Wholesale Cost)
  const initialQtyPerSku = 12; // V1.1 SoT: 12 units / SKU
  const totalInitialUnits = sku_count * initialQtyPerSku;
  
  let dynamicInvestment = 0;
  if (recommended_products && recommended_products.length > 0) {
    dynamicInvestment = recommended_products.reduce((sum: number, p: any) => {
      const wholesale = p.wholesale_price || (p.estimated_retail_price * 0.50);
      return sum + (wholesale * initialQtyPerSku);
    }, 0);
    dynamicInvestment = Math.round(dynamicInvestment);
  }

  // Fallback to estimated average if recommended_products is 0 or unassigned
  const investment = dynamicInvestment > 0 ? dynamicInvestment : Math.round(sku_count * initialQtyPerSku * 12.00);

  // Target Budget Range Warning Check
  let investmentTargetWarning: string | null = null;
  if (program === "START" && (investment < 2500 || investment > 4500)) {
    investmentTargetWarning = `Calculated initial investment ($${investment}) is outside target START budget range ($2,500–$4,500)`;
  } else if (program === "GROW" && (investment < 5000 || investment > 8500)) {
    investmentTargetWarning = `Calculated initial investment ($${investment}) is outside target GROW budget range ($5,000–$8,500)`;
  } else if (program === "EXPAND" && (investment < 8000 || investment > 13000)) {
    investmentTargetWarning = `Calculated initial investment ($${investment}) is outside target EXPAND budget range ($8,000–$13,000)`;
  }

  // B. Multi-Signal Turnover V1.1 (Q35 Base + Q36 + Q37 + Support Signals)
  const turnover_params = config.parameters.turnover || {
    q35_base_turns: [1.8, 2.4, 3.0, 3.6, 4.2], // Calibrated Q35 base range to prevent single-question dominance
    q36_multipliers: [1.00, 1.04, 1.08, 1.04, 0.98], // Q36 integration (Half=1.00, 4-6=1.04, 2-3=1.08, 1=1.04, Sellout=0.98)
    q37_multipliers: [1.15, 1.08, 1.00, 0.92, 0.85],
    inquiry_adjustments: 1.05,
    traffic_adjustments: 1.05,
    replenishment_penalty_stockout: 0.85,
    replenishment_penalty_discipline: 0.90,
    scenario_multipliers: { conservative: 0.85, expected: 1.00, growth: 1.15 }
  };

  // Signal 1: Q35 Base Turnover (Primary Range)
  let baseTurnover = 3.0;
  const q35_ans = resolvedAnswers["Q35"]?.[0];
  if (q35_ans) {
    const idx = parseInt(q35_ans.split('_A')[1]) - 1;
    if (idx >= 0 && idx < turnover_params.q35_base_turns.length) {
      baseTurnover = turnover_params.q35_base_turns[idx];
    }
  }

  let turnover = baseTurnover;

  // Signal 2: Q36 Reorder Inventory Level Multiplier (V1.1 Integrated)
  let q36_mult = 1.00;
  const q36_ans = resolvedAnswers["Q36"]?.[0];
  if (q36_ans) {
    const idx = parseInt(q36_ans.split('_A')[1]) - 1;
    if (idx >= 0 && idx < (turnover_params.q36_multipliers || [1.00, 1.04, 1.08, 1.04, 0.98]).length) {
      q36_mult = (turnover_params.q36_multipliers || [1.00, 1.04, 1.08, 1.04, 0.98])[idx];
    }
  }
  turnover *= q36_mult;

  // Signal 3: Q37 60-Day Reorder Rate Multiplier
  let q37_mult = 1.00;
  const q37_ans = resolvedAnswers["Q37"]?.[0];
  if (q37_ans) {
    const idx = parseInt(q37_ans.split('_A')[1]) - 1;
    if (idx >= 0 && idx < turnover_params.q37_multipliers.length) {
      q37_mult = turnover_params.q37_multipliers[idx];
    }
  }
  turnover *= q37_mult;

  // Support Signals: Q10, Q32, Q21, Q18
  let q10_mult = 1.00;
  if (resolvedAnswers["Q10"]?.includes("Q10_A1") || resolvedAnswers["Q10"]?.includes("Q10_A2")) {
    q10_mult = turnover_params.inquiry_adjustments || 1.05;
  } else if (resolvedAnswers["Q10"]?.includes("Q10_A4") || resolvedAnswers["Q10"]?.includes("Q10_A5")) {
    q10_mult = 0.90;
  }
  turnover *= q10_mult;

  let q32_mult = 1.00;
  if (resolvedAnswers["Q32"]?.includes("Q32_A5")) {
    q32_mult = turnover_params.traffic_adjustments || 1.05;
  } else if (resolvedAnswers["Q32"]?.includes("Q32_A1") || resolvedAnswers["Q32"]?.includes("Q32_A2")) {
    q32_mult = 0.90;
  }
  turnover *= q32_mult;

  let q21_mult = 1.00;
  if (resolvedAnswers["Q21"]?.includes("Q21_A1")) {
    q21_mult = turnover_params.replenishment_penalty_stockout || 0.85;
  }
  turnover *= q21_mult;

  let q18_mult = 1.00;
  if (resolvedAnswers["Q18"]?.includes("Q18_A5")) {
    q18_mult = turnover_params.replenishment_penalty_discipline || 0.90;
  }
  turnover *= q18_mult;

  const expectedTurnover = parseFloat(turnover.toFixed(2));
  
  // Scenarios Turnover
  const sc_params = turnover_params.scenario_multipliers || { conservative: 0.85, expected: 1.00, growth: 1.15 };
  const conservativeTurnover = parseFloat((expectedTurnover * sc_params.conservative).toFixed(2));
  const growthTurnover = parseFloat((expectedTurnover * sc_params.growth).toFixed(2));

  // C. Year-1 Ramp-Up & Monthly Cumulative Payback Calculation
  const gross_margin = config.parameters.financial?.global_gross_margin || 0.50;
  const steadyStateAnnualCogs = investment * expectedTurnover;
  const steadyStateMonthlyCogs = steadyStateAnnualCogs / 12;

  // Monthly Ramp-Up Factors: M1-3 = 70%, M4-6 = 90%, M7-12 = 100%
  const rampUpFactors = [0.70, 0.70, 0.70, 0.90, 0.90, 0.90, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00];
  
  let year1AnnualCogs = 0;
  let year1AnnualSales = 0;
  let year1GrossProfit = 0;
  let cumulativeGrossProfit = 0;
  let paybackMonths = 13; // 13 indicates 12+ months

  for (let m = 1; m <= 12; m++) {
    const factor = rampUpFactors[m - 1];
    const mCogs = steadyStateMonthlyCogs * factor;
    const mSales = mCogs / (1 - gross_margin);
    const mGrossProfit = mSales - mCogs;

    year1AnnualCogs += mCogs;
    year1AnnualSales += mSales;
    year1GrossProfit += mGrossProfit;

    cumulativeGrossProfit += mGrossProfit;
    if (paybackMonths === 13 && cumulativeGrossProfit >= investment) {
      paybackMonths = m;
    }
  }

  const annual_sales = Math.round(year1AnnualSales);
  const gross_profit = Math.round(year1GrossProfit);

  // Budget Fit (Range-aware calculation)
  let budget_fit: "HIGH" | "MEDIUM" | "LOW" | "VERY LOW" = "HIGH";
  let minBudget = 0;
  let maxBudget = Infinity;

  const q22_ans_fb = resolvedAnswers["Q22"]?.[0];
  if (q22_ans_fb === "Q22_A1") { // Under $2,000
    minBudget = 0; maxBudget = 2000;
  } else if (q22_ans_fb === "Q22_A2") { // $2,000–$4,000
    minBudget = 2000; maxBudget = 4000;
  } else if (q22_ans_fb === "Q22_A3") { // $4,000–$6,000
    minBudget = 4000; maxBudget = 6000;
  } else if (q22_ans_fb === "Q22_A4") { // $6,000–$10,000
    minBudget = 6000; maxBudget = 10000;
  } else if (q22_ans_fb === "Q22_A5") { // $10,000+
    minBudget = 10000; maxBudget = Infinity;
  }

  if (investment <= maxBudget) {
    budget_fit = "HIGH";
  } else {
    const ratio = maxBudget / investment;
    if (ratio >= 0.8) {
      budget_fit = "MEDIUM";
    } else if (ratio >= 0.5) {
      budget_fit = "LOW";
    } else {
      budget_fit = "VERY LOW";
    }
  }

  // 6. Confidence Level & Accuracy Calibration
  let confScore = 100;
  const contradictions: string[] = [];

  let missingInfoPenalty = 0;

  config.questions.forEach(q => {
    const qId = q.question_id;
    const ansIds = resolvedAnswers[qId] || [];

    if (ansIds.length === 0) {
      // Question is missing/unanswered
      if (qId === "Q35") {
        confScore -= 30; // CRITICAL_BEHAVIORAL_MISSING (Exempt from general missing info cap)
      } else if (q.importance === "A") {
        missingInfoPenalty += 15; // IMPORTANT_INFO_MISSING
      } else if (q.importance === "B") {
        missingInfoPenalty += 5;  // MINOR_INFO_MISSING
      } else {
        missingInfoPenalty += 2;  // OPTIONAL_INFO_MISSING
      }
    } else {
      // Question is answered
      const ansId = ansIds[0];
      const mapping = config.answerIdToMappingMap[ansId];
      if (mapping) {
        if (mapping.confidence_signal === "PENALTY") {
          missingInfoPenalty += 15; // IMPORTANT_INFO_MISSING (for "I do not know" answers)
        } else if (mapping.confidence_signal === "LOWER_INFORMATION_QUALITY") {
          missingInfoPenalty += 10; // DO_NOT_TRACK (for "Do not track" answers)
        }
      }
    }
  });

  // Apply global missing-information cap of 45 points (excluding Q35)
  const cappedMissingPenalty = Math.min(45, missingInfoPenalty);
  confScore -= cappedMissingPenalty;

  // Contradiction checks
  if (resolvedAnswers["Q3"]?.includes("Q3_A1") && resolvedAnswers["Q30"]?.includes("Q30_A5")) {
    confScore -= 40;
    contradictions.push("Experience contradiction: Almost no sales but 월매출 $20k+");
  }
  if (resolvedAnswers["Q2"]?.includes("Q2_A1") && resolvedAnswers["Q4"]?.includes("Q4_A5")) {
    confScore -= 40;
    contradictions.push("Space contradiction: 4FT space but operating 12FT+ scale");
  }

  // Bonus for high quality inputs
  if (resolvedAnswers["Q35"]?.[0] && resolvedAnswers["Q37"]?.[0] && 
      !resolvedAnswers["Q35"]?.[0].includes("Q35_A6") && // wait, check if answered (Q35_A1 to Q35_A6)
      !resolvedAnswers["Q37"]?.[0].includes("unknown")) {
    // Only apply bonus if there's no major ambiguity in the survey
    const hasManyUnknowns = Object.values(resolvedAnswers).some(arr => 
      arr.some(id => id.includes("_A6") || id.includes("_A5") && (id.startsWith("Q2") || id.startsWith("Q6")))
    );
    if (!hasManyUnknowns) {
      confScore += 10;
    }
  }

  confScore = Math.max(0, Math.min(100, confScore));

  let level: "BASIC" | "GOOD" | "HIGH" = "BASIC";
  let accuracy_percentage = 65;
  if (confScore >= 85) {
    level = "HIGH";
    accuracy_percentage = Math.round(85 + (confScore - 85) * 0.6);
  } else if (confScore >= 60) {
    level = "GOOD";
    accuracy_percentage = Math.round(60 + (confScore - 60) * 0.8);
  } else {
    level = "BASIC";
    accuracy_percentage = Math.round(40 + confScore * 0.3);
  }

  // 7. Version Bundle
  const versions = {
    questionnaire_id: config.questionnaireId,
    questionnaire_version: config.version,
    mapping_version: config.version,
    calibration_version: config.version,
    engine_version: 1,       // Fixed engine core code version v1
    financial_assumption_version: config.version
  };

  // 8. Calculation Trace Snapshot
  const trace = {
    resolved_answers: resolvedAnswers,
    valid_programs: Array.from(validPrograms),
    program_scores: programScores,
    ap_scores: apScores,
    turnover_details: {
      base_turnover: baseTurnover,
      q36_multiplier: q36_mult,
      q37_multiplier: q37_mult,
      q10_multiplier: q10_mult,
      q32_multiplier: q32_mult,
      q21_multiplier: q21_mult,
      q18_multiplier: q18_mult,
      expected_turnover: expectedTurnover,
      conservative_turnover: conservativeTurnover,
      growth_turnover: growthTurnover,
      investment_target_warning: investmentTargetWarning
    },
    confidence_details: {
      score: confScore,
      contradictions
    }
  };

  const simId = "SIM-" + Math.floor(10000 + Math.random() * 90000);

  return {
    simulation_id: simId,
    display: {
      program,
      width_ft,
      sku_count,
      initial_units: totalInitialUnits,
      investment,
      reasons
    },
    assortment: {
      primary: primaryKey,
      secondary: secondaryKey,
      primary_description_ko: AP_DESCRIPTIONS[primaryKey],
      secondary_description_ko: AP_DESCRIPTIONS[secondaryKey],
      category_mix,
      recommended_products
    },
    internal_candidate_products: recommended_products,
    candidate_diagnosis: candidateDiagnosis,
    financial: {
      turnover: expectedTurnover,
      annual_sales,
      gross_margin,
      gross_profit,
      initial_product_investment: investment,
      payback_months: paybackMonths,
      budget_fit
    },
    confidence: {
      level,
      accuracy_percentage
    },
    versions,
    trace
  };
}
