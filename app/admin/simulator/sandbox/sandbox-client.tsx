"use client";

import React, { useState } from "react";

interface Answer {
  id: string;
  question_id: string;
  answer_id: string;
  label_ko: string;
  label_en: string;
}

interface Question {
  id: string;
  question_id: string;
  label_ko: string;
  label_en: string;
  type: string;
  section: string;
  answers: Answer[];
}

interface SandboxClientProps {
  questions: Question[];
  version: number;
}

const PRESETS: Record<string, { name: string; description: string; answers: Record<string, any> }> = {
  SCENARIO_A: {
    name: "Scenario A: Small / Beginner / Low Budget",
    description: "소형 매장, 예산 $1,500 미만, K-Beauty 취급 경험 없는 초심자 바이어",
    answers: {
      Q1: "Q1_A1", // Under 1,500 sq.ft.
      Q2: "Q2_A1", // Approx. 4FT (Hard Constraint: Excludes GROW & EXPAND)
      Q3: "Q3_A1", // Almost none / Do not sell
      Q4: "Q4_A1", // None
      Q5: ["Q5_A2"], // Wigs / Hair Extensions (BALANCE AP preference)
      Q6: "Q6_A1", // Under $30,000
      Q7: "Q7_A1", // Minor portion
      Q8: ["Q8_A7"], // Value Shoppers
      Q9: ["Q9_A11"], // No clear category
      Q10: "Q10_A4", // Almost never (Turnover negative penalty)
      Q11: "Q11_A3", // Staying similar
      Q12: ["Q12_A1"], // Price / Value
      Q13: "Q13_A1", // Very price sensitive
      Q14: "Q14_A3", // Prefer established brands
      Q15: ["Q15_A1"], // Restocking / Replenishment
      Q16: "Q16_A2", // $10–$15
      Q17: "Q17_A2", // $10–$15
      Q18: "Q18_A5", // Occasional / As needed
      Q19: "Q19_A1", // 1-3 units
      Q20: "Q20_A1", // 1-3 units
      Q21: "Q21_A2", // Sometimes
      Q22: "Q22_A1", // Under $2,000
      Q23: "Q23_A1", // Test with smaller scale
      Q24: "Q24_A4", // Maintain current scale
      Q26: "Q26_A1", // Minor supplement
      Q30: "Q30_A1", // Under $1,000
      Q31: "Q31_A1", // Under 10 SKUs
      Q32: "Q32_A1", // Low traffic
      Q33: "Q33_A1", // Under 10%
      Q34: ["Q34_A4"], // Initial purchase cost concerns
      Q35: "Q35_A1", // 1-3 units (Base turns = 2.4)
      Q37: "Q37_A5"  // Very few (Turns penalty = 0.80)
    }
  },
  SCENARIO_B: {
    name: "Scenario B: Typical Independent Beauty Supply",
    description: "중형 매장, 공간 8FT, 예산 $6,000, 뷰티 비중 50%, 기존 소형 매대 가동 중",
    answers: {
      Q1: "Q1_A3", // 3,000-5,000 sq.ft.
      Q2: "Q2_A2", // Approx. 8FT (Hard Constraint: Excludes EXPAND)
      Q3: "Q3_A3", // One shelf / small zone
      Q4: "Q4_A3", // Approx. 4FT
      Q5: ["Q5_A1", "Q5_A4"], // Hair Care, Skincare
      Q6: "Q6_A3", // $60,000–$100,000
      Q7: "Q7_A3", // Approx. half
      Q8: ["Q8_A3", "Q8_A7"], // Adults & Families, Value Shoppers
      Q9: ["Q9_A1", "Q9_A2"], // Skincare, Hair Care
      Q10: "Q10_A2", // Sometimes (Turnover positive bonus)
      Q11: "Q11_A2", // Slightly increasing
      Q12: ["Q12_A1", "Q12_A2"], // Price, Efficacy
      Q13: "Q13_A2", // Price & quality balanced
      Q14: "Q14_A2", // Moderately willing
      Q15: ["Q15_A1", "Q15_A2"], // Restocking, Solving specific problems
      Q16: "Q16_A3", // $15–$20
      Q17: "Q17_A3", // $15–$20
      Q18: "Q18_A3", // Monthly
      Q19: "Q19_A3", // 7-12 units
      Q20: "Q20_A3", // 7-12 units
      Q21: "Q21_A2", // Sometimes
      Q22: "Q22_A4", // $6,000–$10,000
      Q23: "Q23_A3", // Balanced layout
      Q24: "Q24_A1", // Active expansion
      Q26: "Q26_A3", // Steady growth
      Q30: "Q30_A3", // $5,000–$10,000
      Q31: "Q31_A3", // 20–40 SKUs
      Q32: "Q32_A3", // Moderate traffic
      Q33: "Q33_A3", // 10%–25%
      Q35: "Q35_A3", // 7–12 units (Base turns = 5.0)
      Q37: "Q37_A3"  // About half (Turns multiplier = 1.00)
    }
  },
  SCENARIO_C: {
    name: "Scenario C: Large / Strong Existing K-Beauty",
    description: "대형 매장, 공간 12FT 이상 확보, 예산 $12,000, 기존 8FT 가동 중, 월매출 $20k+ 우수 상권",
    answers: {
      Q1: "Q1_A5", // 8,000 sq.ft. or more
      Q2: "Q2_A4", // 12FT or more
      Q3: "Q3_A5", // Important core category
      Q4: "Q4_A4", // Approx. 8FT
      Q5: ["Q5_A4", "Q5_A3"], // Skincare, Cosmetics
      Q6: "Q6_A6", // Over $250,000
      Q7: "Q7_A4", // More than half
      Q8: ["Q8_A1", "Q8_A2", "Q8_A6"], // Teens, Young Adults, Beauty Enthusiasts
      Q9: ["Q9_A1", "Q9_A4", "Q9_A10"], // Skincare, Masks, New & Trending
      Q10: "Q10_A1", // Frequently (Turns positive multiplier)
      Q11: "Q11_A1", // Rapidly increasing (Turns positive multiplier)
      Q12: ["Q12_A5", "Q12_A7", "Q12_A3"], // Social Media, Premium Quality, Ingredients
      Q13: "Q13_A4", // Will accept premium price
      Q14: "Q14_A1", // Very active to try
      Q15: ["Q15_A4", "Q15_A2"], // Trends, Solving specific problems
      Q16: "Q16_A5", // $30–$45
      Q17: "Q17_A5", // $30–$45
      Q18: "Q18_A1", // Weekly
      Q19: "Q19_A4", // 13-24 units
      Q20: "Q20_A4", // 13-24 units
      Q21: "Q21_A3", // No stockouts
      Q22: "Q22_A5", // $10,000+
      Q23: "Q23_A5", // Dominant presence
      Q24: "Q24_A1", // Active expansion
      Q26: "Q26_A5", // Signature differentiator
      Q30: "Q30_A5", // Over $20,000
      Q31: "Q31_A5", // Over 60 SKUs
      Q32: "Q32_A5", // High traffic
      Q33: "Q33_A5", // Over 25%
      Q35: "Q35_A6", // 25+ units (Base turns = 10.0)
      Q37: "Q37_A1"  // Most (Turns multiplier = 1.15)
    }
  },
  SCENARIO_L: {
    name: "Scenario L: High Ambiguity (Many Unknowns)",
    description: "대다수 핵심 정보를 '잘 모르겠습니다'로 입력하여 신뢰 지수가 BASIC(감점 적용)으로 나오는 시나리오",
    answers: {
      Q1: "Q1_A6", // I do not know (Penalty: -5)
      Q2: "Q2_A5", // Space available, unsure of size (Penalty: -5)
      Q3: "Q3_A6", // I do not know (Penalty: -5)
      Q4: "Q4_A6", // I do not know (Penalty: -15)
      Q5: ["Q5_A12"], // I do not know
      Q6: "Q6_A7", // I do not know
      Q7: "Q7_A6", // I do not know
      Q8: ["Q8_A9"], // I do not know
      Q9: ["Q9_A12"], // I do not know
      Q10: "Q10_A6", // I do not know
      Q11: "Q11_A6", // I do not know
      Q12: ["Q12_A10"], // I do not know
      Q13: "Q13_A6", // I do not know
      Q14: "Q14_A6", // I do not know
      Q15: ["Q15_A9"], // I do not know
      Q16: "Q16_A8", // I do not know
      Q17: "Q17_A7", // I do not know
      Q18: "Q18_A7", // I do not know
      Q22: "Q22_A2", // $2,000-$4,000
      Q35: "Q35_A1", // 1-3 units
      Q37: "Q37_A5"  // Very few
    }
  }
};

export default function SimulatorSandboxClient({ questions, version }: SandboxClientProps) {
  const [selectedPreset, setSelectedPreset] = useState("");
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"presets" | "form" | "json" | "result">("presets");

  const handleApplyPreset = (key: string) => {
    setSelectedPreset(key);
    setAnswers(PRESETS[key].answers);
    setActiveTab("form");
  };

  const handleSingleSelectChange = (questionId: string, answerId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answerId
    }));
  };

  const handleMultiSelectChange = (questionId: string, answerId: string) => {
    setAnswers(prev => {
      const current = prev[questionId] || [];
      const updated = current.includes(answerId)
        ? current.filter((id: string) => id !== answerId)
        : [...current, answerId];
      return {
        ...prev,
        [questionId]: updated
      };
    });
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/simulator/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          answers,
          email: email || "sandbox-test@kselectnetwork.com"
        })
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setActiveTab("result");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "시뮬레이션 실행 중 알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800 gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
            Simulator Engine Sandbox
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded">
              Config Version {version}
            </span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1 dark:text-zinc-400">
            K SELECT Growth Simulator v1 로직 가중치 및 예측 공식을 테스트하고 검증하는 관리자 샌드박스입니다.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-400 font-mono mt-2 bg-zinc-50 dark:bg-zinc-900 p-2 rounded border border-zinc-150 dark:border-zinc-800">
            <span className="font-bold text-zinc-500">Active Published Versions:</span>
            <span>Questionnaire: v{version}</span>
            <span>Mapping: v{version}</span>
            <span>Calibration: v{version}</span>
            <span>Engine: v1</span>
            <span>Financial: v{version}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-center">
          <input
            type="email"
            placeholder="이력 적재용 테스트 이메일"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-950 shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <button
            onClick={handleRunSimulation}
            disabled={loading || Object.keys(answers).length === 0}
            className="rounded bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer"
          >
            {loading ? "연산 중..." : "시뮬레이션 실행"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400">
          오류: {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("presets")}
          className={`border-b-2 px-4 py-2 text-xs font-bold ${
            activeTab === "presets"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          }`}
        >
          시나리오 프리셋
        </button>
        <button
          onClick={() => setActiveTab("form")}
          className={`border-b-2 px-4 py-2 text-xs font-bold ${
            activeTab === "form"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          }`}
        >
          설문 답변 입력 ({Object.keys(answers).length}개 선택)
        </button>
        <button
          onClick={() => setActiveTab("json")}
          className={`border-b-2 px-4 py-2 text-xs font-bold ${
            activeTab === "json"
              ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
              : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          }`}
        >
          Raw JSON 에디터
        </button>
        {result && (
          <button
            onClick={() => setActiveTab("result")}
            className={`border-b-2 px-4 py-2 text-xs font-bold ${
              activeTab === "result"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            }`}
          >
            연산 결과 리포트 (수신 완료)
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "presets" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <div
                key={key}
                className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{preset.name}</h3>
                  <p className="text-xs text-zinc-500 mt-2 dark:text-zinc-400">{preset.description}</p>
                </div>
                <button
                  onClick={() => handleApplyPreset(key)}
                  className="mt-4 w-full rounded border border-zinc-300 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  이 시나리오 답변 적용하기
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "form" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
            {questions.map((q, idx) => {
              const isMulti = q.type === "multi-select" || q.question_id === "Q5" || q.question_id === "Q8" || q.question_id === "Q9" || q.question_id === "Q12" || q.question_id === "Q15";
              const selectedVals = answers[q.question_id] || (isMulti ? [] : "");

              return (
                <div key={q.id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0 dark:border-zinc-800">
                  <div className="flex items-start gap-2">
                    <span className="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                      {q.question_id}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{q.label_ko}</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{q.label_en}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {q.answers.map(ans => {
                      const isSelected = isMulti 
                        ? (selectedVals as string[]).includes(ans.answer_id)
                        : selectedVals === ans.answer_id;

                      return (
                        <button
                          key={ans.id}
                          onClick={() => {
                            if (isMulti) {
                              handleMultiSelectChange(q.question_id, ans.answer_id);
                            } else {
                              handleSingleSelectChange(q.question_id, ans.answer_id);
                            }
                          }}
                          className={`rounded border px-3 py-2 text-left text-xs transition-all ${
                            isSelected
                              ? "border-zinc-950 bg-zinc-950 text-white font-semibold dark:border-white dark:bg-white dark:text-zinc-950"
                              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <div>{ans.label_ko}</div>
                          <div className={`text-[9px] mt-0.5 ${isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400"}`}>
                            {ans.label_en}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "json" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-xs font-bold text-zinc-900 mb-2 dark:text-white">answers JSON 객체 편집</h3>
            <textarea
              value={JSON.stringify(answers, null, 2)}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  setAnswers(parsed);
                } catch(err) {}
              }}
              rows={25}
              className="w-full font-mono text-xs rounded border border-zinc-300 bg-zinc-50 p-4 text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        )}

        {activeTab === "result" && result && (
          <div className="space-y-6">
            {result.versions && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/50 font-mono text-zinc-500 flex flex-wrap gap-x-6 gap-y-1">
                <span className="font-bold text-zinc-700 dark:text-zinc-300">실행에 사용된 Version Bundle:</span>
                <span>Questionnaire: v{result.versions.questionnaire_version}</span>
                <span>Mapping: v{result.versions.mapping_version}</span>
                <span>Calibration: v{result.versions.calibration_version}</span>
                <span>Engine: v{result.versions.engine_version}</span>
                <span>Financial: v{result.versions.financial_assumption_version}</span>
              </div>
            )}

            {/* KPI Summary Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">추천 진열 매대</span>
                <div className="text-lg font-bold text-zinc-950 mt-2 dark:text-white">{result.display.program} ({result.display.width_ft}FT)</div>
                <div className="text-[10px] text-zinc-500 mt-1">투자 비용: ${result.display.investment.toLocaleString()} / SKU수: {result.display.sku_count}개</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">추천 Assortment Profile</span>
                <div className="text-lg font-bold text-zinc-950 mt-2 dark:text-white">Primary: {result.assortment.primary}</div>
                <div className="text-[10px] text-zinc-500 mt-1">Secondary: {result.assortment.secondary}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">예측 회전율 및 매출</span>
                <div className="text-lg font-bold text-zinc-950 mt-2 dark:text-white">연 {result.financial.turnover}회 회전</div>
                <div className="text-[10px] text-zinc-500 mt-1">연 예상 매출: ${result.financial.annual_sales.toLocaleString()}</div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">예측 투자 회수 및 신뢰 지수</span>
                <div className="text-lg font-bold text-zinc-950 mt-2 dark:text-white">{result.financial.payback_months}개월 회수</div>
                <div className="text-[10px] text-zinc-500 mt-1">신뢰 등급: {result.confidence.level} ({result.confidence.accuracy_percentage}%)</div>
              </div>
            </div>

            {/* Curation & Reasons */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">진열 배치 추천 사유</h3>
                <ul className="list-disc list-inside text-xs text-zinc-600 space-y-2 dark:text-zinc-400">
                  {result.display.reasons.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">카테고리 구성 비율 (Category Mix)</h3>
                <div className="space-y-2">
                  {result.assortment.category_mix.map((cat: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-zinc-800 dark:text-zinc-200">{cat.category}</span>
                      </div>
                      <span className="font-bold text-zinc-950 dark:text-white">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommended Products */}
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-xs font-bold text-zinc-900 mb-4 dark:text-white uppercase tracking-wider">추천 바인딩 상품 목록 ({result.assortment.recommended_products.length}개)</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <thead>
                    <tr className="border-b border-zinc-100 font-bold text-zinc-950 dark:border-zinc-800 dark:text-white">
                      <th className="py-2.5">이미지</th>
                      <th className="py-2.5">상품명</th>
                      <th className="py-2.5">브랜드</th>
                      <th className="py-2.5">소매 예상단가</th>
                      <th className="py-2.5">카테고리</th>
                      <th className="py-2.5">우선순위</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                    {result.assortment.recommended_products.map((prod: any) => (
                      <tr key={prod.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                        <td className="py-2">
                          {prod.image_url ? (
                            <img src={prod.image_url} alt={prod.name} className="h-10 w-10 object-cover rounded border" />
                          ) : (
                            <div className="h-10 w-10 bg-zinc-100 flex items-center justify-center rounded border text-[9px] dark:bg-zinc-800">No Img</div>
                          )}
                        </td>
                        <td className="py-3 font-semibold text-zinc-950 dark:text-white">{prod.name}</td>
                        <td className="py-3">{prod.brand_name}</td>
                        <td className="py-3">${prod.estimated_retail_price}</td>
                        <td className="py-3">{prod.category_code}</td>
                        <td className="py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            prod.priority_role === "REQUIRED" 
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : prod.priority_role === "CORE"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}>
                            {prod.priority_role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calibration Trace / Raw Calculations Output */}
            {result.trace && (
              <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-xs font-bold text-zinc-900 mb-4 dark:text-white uppercase tracking-wider">Calculation Trace Snapshot (로직 추적 데이터)</h3>
                
                <div className="space-y-4 text-xs font-mono">
                  {/* Scores Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-50 p-4 rounded dark:bg-zinc-950">
                      <h4 className="font-bold border-b pb-1 mb-2 dark:border-zinc-800">Display Candidate Raw Scores</h4>
                      <div>START Score: {result.trace.program_scores.START}</div>
                      <div>GROW Score: {result.trace.program_scores.GROW}</div>
                      <div>EXPAND Score: {result.trace.program_scores.EXPAND}</div>
                      <div className="mt-2 text-zinc-500">Valid Programs after constraints: {result.trace.valid_programs.join(', ')}</div>
                    </div>
                    <div className="bg-zinc-50 p-4 rounded dark:bg-zinc-950">
                      <h4 className="font-bold border-b pb-1 mb-2 dark:border-zinc-800">AP Raw Strength Scores</h4>
                      {Object.entries(result.trace.ap_scores).map(([ap, score]: any) => (
                        <div key={ap}>{ap}: {score}점</div>
                      ))}
                    </div>
                  </div>

                  {/* Turnover details */}
                  <div className="bg-zinc-50 p-4 rounded dark:bg-zinc-950">
                    <h4 className="font-bold border-b pb-1 mb-2 dark:border-zinc-800">Turnover Calculations Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>Q35 Base Turns: {result.trace.turnover_details.base_turnover}회</div>
                      <div>Q37 Multiplier: x{result.trace.turnover_details.q37_multiplier}</div>
                      <div>Q10 Multiplier: x{result.trace.turnover_details.q10_multiplier}</div>
                      <div>Q32 Multiplier: x{result.trace.turnover_details.q32_multiplier}</div>
                      <div>Q21 Multiplier: x{result.trace.turnover_details.q21_multiplier}</div>
                      <div>Q18 Multiplier: x{result.trace.turnover_details.q18_multiplier}</div>
                      <div className="col-span-1 md:col-span-3 mt-2 border-t pt-2 dark:border-zinc-800">
                        <strong>Expected Turns (Base * Mults): {result.trace.turnover_details.expected_turnover}회</strong>
                        <div className="text-[10px] text-zinc-500 mt-1">
                          (Conservative: {result.trace.turnover_details.conservative_turnover}회 / Growth: {result.trace.turnover_details.growth_turnover}회)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Confidence details */}
                  <div className="bg-zinc-50 p-4 rounded dark:bg-zinc-950">
                    <h4 className="font-bold border-b pb-1 mb-2 dark:border-zinc-800">Confidence Analysis</h4>
                    <div>Numeric Score: {result.trace.confidence_details.score} / 100</div>
                    {result.trace.confidence_details.contradictions.length > 0 && (
                      <div className="mt-2 text-red-600 dark:text-red-400">
                        <div>감지된 데이터 모순:</div>
                        <ul className="list-disc list-inside pl-2">
                          {result.trace.confidence_details.contradictions.map((c: string, idx: number) => (
                            <li key={idx}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
