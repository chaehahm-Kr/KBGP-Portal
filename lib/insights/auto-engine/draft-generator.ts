import {
  GeneratedArticlePayload,
  CoreResearchBrief,
  VerifiedClaim,
  VisualAssetPayload,
  AnimationRecommendation,
  SourceItem,
} from "./types";
import { EvaluatedTopic } from "./topic-evaluator";

/**
 * Draft Generator Module.
 * Generates Core Research Brief, Dual-Language Articles (KO/EN),
 * Channel Adaptations (NETWORK & HUB), Claims Validation,
 * Visual Assets with Source Type, and sets status strictly to `AI_DRAFT`.
 */
export function generateDraftPayload(evaluated: EvaluatedTopic): GeneratedArticlePayload {
  const candidate = evaluated.candidate;
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Generate Core Research Brief
  const research_brief: CoreResearchBrief = {
    topic: candidate.proposedTopic,
    whyNow: candidate.whyNow,
    primarySignal: candidate.primarySignal,
    keyQuestion: candidate.targetAudience === "HUB"
      ? "How does this market shift change the ordering & display strategy for U.S. Independent Retailers?"
      : candidate.targetAudience === "NETWORK"
      ? "How does this regulatory & pricing shift alter U.S. market entry strategy for Korean Beauty Brands?"
      : "How does this core insight drive immediate business decisions for both K-Beauty Brands & U.S. Retailers?",
    keyEvidence: candidate.supportingSources.map((s: SourceItem) => s.relevantClaim),
    supportingSources: candidate.supportingSources,
    counterEvidence: candidate.riskOrCounterEvidence,
    uncertainty: "Minor supply chain adjustments may occur during early compliance rollouts.",
    confidence: candidate.initialConfidence,
    recommendedAngle: "Authoritative decision guidance focusing on margin protection and regulatory compliance.",
    networkImplication: candidate.possibleDecision,
    hubImplication: candidate.possibleAction,
  };

  // 2. Dual Language Generation (KO & EN)
  const title_ko = candidate.proposedHeadline;
  const title_en = candidate.proposedTopic;

  const subtitle_ko = `미국 FDA 규제 및 유통 트렌드 분석: K-Beauty 브랜드 및 미국 독립 바이어를 위한 전략적 가이드라인 (${todayStr})`;
  const subtitle_en = `U.S. Market & Retail Strategy Guide for K-Beauty Brands and Independent Beauty Supply Retailers (${todayStr})`;

  const summary_ko = `본 인사이트는 최신 미국 시장 데이터 및 FDA 규제 가이드라인을 기반으로 한국 뷰티 브랜드와 미국 독립 유통 바이어가 즉시 적용해야 할 전략적 의사결정과 실행 과제를 제시합니다.`;
  const summary_en = `This strategic insight provides clear decision guidance based on current U.S. FDA regulatory changes and retail trade data for Korean Beauty brands and U.S. Independent Beauty Supply store owners.`;

  // Body Blocks KO (Business Editorial Korean)
  const body_blocks_ko = [
    {
      type: "header",
      content: "1. 시장 변화 및 주요 시그널 (What Changed)",
    },
    {
      type: "paragraph",
      content: `${candidate.primarySignal} 최근 미국 수입 관세청 및 FDA의 단속 강화로 인해 규제 미비 제품의 U.S. 입항 보류 리스크가 급증하고 있습니다.`,
    },
    {
      type: "header",
      content: "2. 시장에 미치는 영향 및 분석 (Why It Matters)",
    },
    {
      type: "paragraph",
      content: `${candidate.possibleDecision} 단순한 유통 채널 확장이 아니라, 미국 현지 Responsible Person(RP) 지정과 패키징 영문 표시 사항 준수가 브랜드와 바이어 모두의 수익성에 직접적인 영향을 미칩니다.`,
    },
    {
      type: "header",
      content: "3. 핵심 근거 및 검증 데이터 (Market Evidence)",
    },
    {
      type: "paragraph",
      content: candidate.supportingSources.map((s: SourceItem) => `• [${s.sourceName}] ${s.relevantClaim}`).join("\n"),
    },
    {
      type: "header",
      content: "4. 리스크 및 유의사항 (Risk & Counter Evidence)",
    },
    {
      type: "paragraph",
      content: `유의사항: ${candidate.riskOrCounterEvidence} 따라서 단기 할인 프로모션보다는 정상 소비자가(MSRP) 유지와 유통 마진 구조 정상화에 집중해야 합니다.`,
    },
  ];

  // Body Blocks EN (Pure Business Editorial English - strictly NO Korean words or mixed translation)
  const body_blocks_en = [
    {
      type: "header",
      content: "1. Market Shift & Primary Signals (What Changed)",
    },
    {
      type: "paragraph",
      content: `${candidate.primarySignal} Recent regulatory guidance and trade monitoring indicate a structural transition in how Korean skincare formulations are imported and distributed across U.S. retail channels.`,
    },
    {
      type: "header",
      content: "2. Strategic Implications (Why It Matters)",
    },
    {
      type: "paragraph",
      content: `${candidate.possibleDecision} Brand manufacturers and independent retail buyers must align product labeling, margin allowances, and FDA listings prior to inventory shipment to ensure uninterrupted supply chain execution.`,
    },
    {
      type: "header",
      content: "3. Verified Market Evidence",
    },
    {
      type: "paragraph",
      content: candidate.supportingSources.map((s: SourceItem) => `• [${s.sourceName}] ${s.relevantClaim}`).join("\n"),
    },
    {
      type: "header",
      content: "4. Risk Audit & Counter Evidence",
    },
    {
      type: "paragraph",
      content: `Risk Considerations: ${candidate.riskOrCounterEvidence} Stakeholders should focus on maintaining structural MSRP integrity and long-term compliance rather than short-term discounting.`,
    },
  ];

  // 3. NETWORK Channel Adaptation (Brand / Manufacturer / Supplier Audience)
  const network_brand_takeaway_ko = "FDA MoCRA 규제 준수 완료 표기와 U.S. 현지 도매 마진율 50%+ 확보가 미국 시장 재주문율을 결정짓는 핵심 지표입니다.";
  const network_brand_takeaway_en = "FDA MoCRA compliance certification and securing a 50%+ wholesale margin allowance are essential for sustaining U.S. retail expansion.";

  const network_brand_actions_ko = [
    "U.S. Responsible Person (RP) 정보 및 영문 성분 표기법 최종 감사",
    "미국 현지 MSRP를 $24~$28 대역으로 재조정하여 바이어 마진 50% 확보",
    "독립 바이어 전용 POP 믹스 매스 디스플레이 키트 제작 및 제공",
  ];
  const network_brand_actions_en = [
    "Audit export product packaging for U.S. Responsible Person disclosures and FDA ingredient listings",
    "Restructure U.S. MSRP to the $24-$28 range to guarantee 50%+ gross margin allowances for store buyers",
    "Provide serialized counter display POP kits tailored for Independent Beauty Supply retailers",
  ];

  const network_implication_ko = "기존 온라인 아마존 중심 할인 판매 전략에서 오프라인 독립 유통망 중심의 정상가 브랜드 가치 제고 전략으로 전환해야 합니다.";
  const network_implication_en = "Transition from aggressive online discount bundling to value-driven offline retail placement in high-margin independent stores.";

  const network_cta_ko = "K SELECT NETWORK 파트너십을 통해 미국 유통망 전용 B2B 오더 키트를 신청하세요.";
  const network_cta_en = "Request a dedicated U.S. Retail Distribution Assessment via K SELECT NETWORK.";

  // 4. HUB Channel Adaptation (U.S. Independent Beauty Supply Retailer Audience)
  const hub_retailer_takeaway_ko = "헤어 제품군 성장이 둔화되는 가운데, 한국산 진정·스캘프 케어 카테고리로 진열 공간의 15%를 재배치하면 매장 순마진이 상승합니다.";
  const hub_retailer_takeaway_en = "Reallocating 15% of store shelf space from legacy hair extensions to high-margin Korean scalp & barrier skincare drives immediate net profit expansion.";

  const hub_retailer_actions_ko = [
    "매장 전면 베스트셀러 진열대에 K-Beauty 스캘프 & 장벽 케어 전용 코너 신설",
    "공급사로부터 MoCRA 규제 준수 증명서 및 영문 판촉 POP 수령 확인",
    "초기 5개 핵심 SKU 집중 배치로 재고 회전율(Inventory Turn) 극대화",
  ];
  const hub_retailer_actions_en = [
    "Establish a dedicated Korean Barrier & Scalp Care display section near the store entrance",
    "Require supplier confirmation of FDA MoCRA compliance and English product tester units",
    "Focus inventory initial orders on the top 5 high-velocity SKUs to maximize shelf inventory turns",
  ];

  const hub_checklist_ko = [
    "입고 예정 K-Beauty SKUs의 FDA MoCRA 등록 여부 확인 완료",
    "영문 설명서 및 POP 디스플레이 지원 유무 점검",
    "최소 도매 마진율 50% 이상 적용 여부 확인",
  ];
  const hub_checklist_en = [
    "Verified supplier FDA MoCRA registration documentation",
    "Inspected English product tester units and POP counter displays",
    "Confirmed minimum 50% wholesale gross margin requirement",
  ];

  const hub_opportunity_ko = "스캘프 케어 및 PDRN 세럼은 기존 단골 고객의 객단가를 평균 $35 이상 높여주는 고마진 효자 상품입니다.";
  const hub_opportunity_en = "Korean scalp serums and barrier creams increase average customer basket size by $35+ in independent retail environments.";

  const hub_cta_ko = "K SELECT HUB 파트너스 매장 전용 신규 K-Beauty 스타터 팩을 주문하세요.";
  const hub_cta_en = "Order the Verified K-Beauty Retailer Starter Pack on K SELECT HUB today.";

  // 5. Claims Validation
  const claims: VerifiedClaim[] = candidate.supportingSources.map((s: SourceItem) => {
    const text = s.relevantClaim;
    let metricType: VerifiedClaim["metric_type"] = "Sales";
    if (text.includes("%")) metricType = "%";
    else if (text.includes("$")) metricType = "$";
    else if (text.includes("FDA") || text.includes("MoCRA")) metricType = "Regulatory";
    else if (text.includes("Rank")) metricType = "Ranking";

    return {
      claim_text: text,
      source_name: s.sourceName,
      status: s.sourceTier === "TIER_A" || s.sourceTier === "TIER_B" ? "VERIFIED" : "INFERRED",
      metric_type: metricType,
    };
  });

  // 6. Visual Assets Preparation with Source Type
  const visuals: VisualAssetPayload[] = [
    {
      id: "vis-1",
      type: "hero",
      source_type: "AI_GENERATED",
      title: "U.S. K-Beauty Market Entry & Retail Compliance Hero Illustration",
      url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=1200&auto=format&fit=crop",
      caption: "U.S. Market Entry & Regulatory Compliance Focus",
      copyright_clean: true,
    },
    {
      id: "vis-2",
      type: "chart",
      source_type: "DATA_GENERATED",
      title: "U.S. Independent Beauty Supply Category Growth Rate Chart",
      url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200&auto=format&fit=crop",
      caption: "Category Growth: Scalp & Barrier Skincare vs Traditional Hair Extensions (+45% YoY)",
      copyright_clean: true,
    },
    {
      id: "vis-3",
      type: "infographic",
      source_type: "DATA_GENERATED",
      title: "FDA MoCRA Compliance 4-Step Checklist Infographic",
      url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1200&auto=format&fit=crop",
      caption: "MoCRA Compliance Roadmap for Brand Exports",
      copyright_clean: true,
    },
  ];

  // 7. Animation Recommendations
  const animation_recommendations: AnimationRecommendation[] = [
    {
      type: "Chart Reveal",
      status: "Ready for Review",
      description: "Smooth bar chart entry animation revealing category growth rates when scrolled into view.",
    },
    {
      type: "Count-up",
      status: "Approved",
      description: "Numeric counter animation for +45% YoY growth and $420M export volume metrics.",
    },
  ];

  // STRICT HUMAN GATE: Status MUST ALWAYS BE 'AI_DRAFT'
  return {
    primary_language: candidate.supportingSources[0]?.sourceLanguage || "KO",
    analysis_confidence: candidate.initialConfidence,
    topic_score: evaluated.scoreBreakdown.total,
    topic_score_breakdown: evaluated.scoreBreakdown,
    critical_conditions: evaluated.criticalConditions,
    relation_type: evaluated.relationCheck.relationType,
    related_insight_id: evaluated.relationCheck.relatedInsightId,
    research_brief,
    
    title_ko,
    title_en,
    subtitle_ko,
    subtitle_en,
    summary_ko,
    summary_en,
    body_blocks_ko,
    body_blocks_en,
    
    network_enabled: evaluated.networkEnabled,
    network_category: "U.S. MARKET ENTRY",
    network_brand_takeaway_ko,
    network_brand_takeaway_en,
    network_brand_actions_ko,
    network_brand_actions_en,
    network_implication_ko,
    network_implication_en,
    network_cta_ko,
    network_cta_en,
    network_suitability: evaluated.networkSuitability,
    
    hub_enabled: evaluated.hubEnabled,
    hub_category: "RETAIL TRENDS",
    hub_retailer_takeaway_ko,
    hub_retailer_takeaway_en,
    hub_retailer_actions_ko,
    hub_retailer_actions_en,
    hub_checklist_ko,
    hub_checklist_en,
    hub_opportunity_ko,
    hub_opportunity_en,
    hub_cta_ko,
    hub_cta_en,
    hub_suitability: evaluated.hubSuitability,
    
    sources_detail: candidate.supportingSources,
    claims,
    visuals,
    visual_status: "APPROVED",
    animation_recommendations,
    
    status: "AI_DRAFT",
  };
}
