import { createAdminClient } from "@/lib/supabase/admin";
import { SimulationResult } from "./types";

// AP Code와 매칭 키워드 간의 고정 매핑 정의 (0039 Seed 및 AC 준수)
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

export async function simulateGrowth(answers: Record<string, any>): Promise<SimulationResult> {
  const supabase = createAdminClient();
  
  // 1. 시뮬레이션 고유 번호 생성
  const simId = "SIM-" + Math.floor(10000 + Math.random() * 90000);

  // 2. Display Program 판단 (Q2: 공간, Q22: 예산)
  let program: "START" | "GROW" | "EXPAND" = "GROW";
  let programCode: "START_4FT" | "GROW_8FT" | "EXPAND_12FT" = "GROW_8FT";
  
  const spacePref = answers["Q2"] || "";
  const budgetPref = answers["Q22"] || "";

  if (spacePref.includes("4FT") || budgetPref.includes("$2,000") || budgetPref.includes("$4,000")) {
    program = "START";
    programCode = "START_4FT";
  } else if (spacePref.includes("12FT") || budgetPref.includes("$10,000")) {
    program = "EXPAND";
    programCode = "EXPAND_12FT";
  }

  // 규격에 따른 스펙 설정
  let width_ft = 8;
  let sku_count = 48;
  let initial_units = 560;
  let investment = 6800;

  if (program === "START") {
    width_ft = 4;
    sku_count = 24;
    initial_units = 300;
    investment = 3500;
  } else if (program === "EXPAND") {
    width_ft = 12;
    sku_count = 72;
    initial_units = 840;
    investment = 10500;
  }

  // 3. 진열 사유(Reasons) 설정
  const reasons: string[] = [];
  if (answers["Q1"] && !answers["Q1"].includes("잘 모르겠습니다")) {
    reasons.push(`귀하가 입력하신 매장 크기(${answers["Q1"]})에 안정적으로 안착될 수 있는 최적의 모듈형 규격입니다.`);
  } else {
    reasons.push("매장 내 동선 효율과 동종 유통점 평균 스페이스 대비 마진 수율이 가장 우수한 모듈 크기입니다.");
  }
  if (answers["Q10"] && (answers["Q10"].includes("자주") || answers["Q10"].includes("가끔"))) {
    reasons.push("매장 방문 고객들의 K-Beauty 브랜드 문의 빈도가 감지되어, 적극적인 시각 노출이 가능한 볼륨을 채택했습니다.");
  }
  if (answers["Q23"]) {
    reasons.push(`초기 상품 구성 및 성장 목표로 선택하신 '${answers["Q23"]}' 방향성과 높은 시너지 배치가 가능합니다.`);
  }

  // 4. Primary / Secondary AP 선정
  let primaryKey: keyof typeof AP_CODE_MAP = "BALANCE";
  let secondaryKey: keyof typeof AP_CODE_MAP = "ESSENTIAL";

  const topCats = answers["Q5"] || [];
  const soughtCats = answers["Q9"] || [];
  const importantValue = answers["Q12"] || [];
  const sensitivity = answers["Q13"] || "";

  if (topCats.includes("스킨케어") || soughtCats.includes("스킨케어")) {
    primaryKey = "SKIN";
  } else if (topCats.includes("헤어 케미컬 / 헤어케어") || soughtCats.includes("헤어케어")) {
    primaryKey = "HAIR";
  } else if (importantValue.includes("가격 / 가성비") || sensitivity.includes("가격이 매우 중요")) {
    primaryKey = "ESSENTIAL";
  }

  if (importantValue.includes("트렌드 / 소셜미디어") || answers["Q14"]?.includes("매우 적극적")) {
    secondaryKey = "TREND";
  } else if (importantValue.includes("프리미엄 품질") || sensitivity.includes("프리미엄 가격")) {
    secondaryKey = "PREMIUM";
  } else {
    secondaryKey = primaryKey === "SKIN" ? "TREND" : "BALANCE";
  }

  if (primaryKey === secondaryKey) {
    secondaryKey = "ESSENTIAL";
  }

  // 5. DB를 통해 선정된 Primary AP 의 실제 레코드 조회
  const primaryApCode = AP_CODE_MAP[primaryKey];
  const { data: apProfile } = await supabase
    .from("assortment_profiles")
    .select("id, name, target_sku")
    .eq("display_program", programCode)
    .eq("code", primaryApCode)
    .single();

  // 6. Curation Matrix 에서 해당 AP 소속의 추천 상품 동적 로드 (Join)
  let recommended_products: any[] = [];
  if (apProfile) {
    const { data: matrixItems } = await supabase
      .from("product_curation_matrix")
      .select(`
        priority_role,
        product:product_id (
          id,
          name,
          estimated_retail_price,
          sales_status,
          category_code,
          brand:brand_id (
            name
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
      .limit(10); // 최대 10개 상품 추천 바인딩

    if (matrixItems) {
      recommended_products = matrixItems
        .filter((item: any) => item.product !== null)
        .map((item: any) => {
          const prod = item.product;
          // 첫 번째 이미지 추출
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
            priority_role: item.priority_role
          };
        });
    }
  }

  // 7. 카테고리 믹스 가중치 매핑
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
  }

  // 8. 재무 공식 연산 모델 (Margin 50% 고정)
  let baseTurnover = 5.5;
  const velocity = answers["Q35"] || "";
  if (velocity.includes("1–3 개")) baseTurnover = 2.8;
  else if (velocity.includes("4–6 개")) baseTurnover = 4.2;
  else if (velocity.includes("7–12 개")) baseTurnover = 6.0;
  else if (velocity.includes("13–18 개")) baseTurnover = 7.4;
  else if (velocity.includes("19–24 개")) baseTurnover = 8.5;
  else if (velocity.includes("25 개 이상")) baseTurnover = 9.8;

  if (answers["Q10"]?.includes("자주")) baseTurnover += 0.8;
  if (answers["Q28"]?.includes("큰 K-Beauty Selection")) baseTurnover -= 0.5;

  const turnover = parseFloat(baseTurnover.toFixed(1));
  const gross_margin = 0.50; 
  const cogs = investment * turnover;
  const annual_sales = Math.round(cogs / (1 - gross_margin));
  const gross_profit = annual_sales - cogs;
  const payback_months = Math.ceil((investment / (gross_profit / 12)) || 3);

  // 9. 신뢰도 평가
  const precisionIds = ["Q6", "Q22", "Q30", "Q31", "Q32", "Q33"];
  let answeredPrecisionCount = 0;
  precisionIds.forEach(pid => {
    if (answers[pid] && !answers[pid].includes("잘 모르겠") && !answers[pid].includes("답변하지 않")) {
      answeredPrecisionCount++;
    }
  });

  let level: "BASIC" | "GOOD" | "HIGH" = "BASIC";
  let accuracy_percentage = 65;
  if (answeredPrecisionCount >= 4) {
    level = "HIGH";
    accuracy_percentage = 95 - Math.floor(Math.random() * 5);
  } else if (answeredPrecisionCount >= 2) {
    level = "GOOD";
    accuracy_percentage = 80 - Math.floor(Math.random() * 6);
  } else {
    accuracy_percentage = 65 - Math.floor(Math.random() * 8);
  }

  return {
    simulation_id: simId,
    display: {
      program,
      width_ft,
      sku_count,
      initial_units,
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
    financial: {
      turnover,
      annual_sales,
      gross_margin,
      gross_profit,
      initial_product_investment: investment,
      payback_months
    },
    confidence: {
      level,
      accuracy_percentage
    }
  };
}
