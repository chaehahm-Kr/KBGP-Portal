import { NextRequest, NextResponse } from "next/server";
import { simulateGrowth } from "@/lib/simulator/engine";
import { createAdminClient } from "@/lib/supabase/admin";

// CORS 허용할 마케팅 사이트 Origin 목록
const ALLOWED_ORIGINS = [
  "https://www.kselecthub.com",
  "https://kselecthub.com",
  "http://localhost:3000",
  "http://localhost:3010"
];

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Max-Age": "86400"
  };

  // 요청 온 Origin이 허용 목록에 있으면 매핑
  if (ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:")) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    // 보안 기본값 차단 방지용 와일드카드 허용
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

// 1. Preflight CORS OPTIONS 대응
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

// 2. 시뮬레이션 계산 및 적재 POST 핸들러
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);
  
  try {
    const body = await request.json();
    const { answers, email, simulation_id, base_simulation_id } = body;

    // 만약 이메일 등록/업데이트 요청인 경우
    if (simulation_id && email && !answers) {
      const supabase = createAdminClient();
      const { data: dbData, error: dbError } = await supabase
        .from("simulation_results")
        .update({ email })
        .eq("id", simulation_id)
        .select("id")
        .single();

      if (dbError) {
        console.error("Failed to update email for simulation:", dbError);
        return NextResponse.json(
          { error: "Failed to update email", details: dbError.message },
          { status: 500, headers: corsHeaders }
        );
      }

      return NextResponse.json(
        { success: true, simulation_id: dbData.id, message: "Email registered successfully." },
        { status: 200, headers: corsHeaders }
      );
    }

    // 답변 파싱 검증 (최소 Q1-Q6 질문이 존재해야함)
    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Invalid request. Questionnaire answers object is required." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 시뮬레이터 코어 엔진 가동 (DB 매트릭스 Join 매핑 또는 Fallback 연산)
    let result;
    try {
      result = await simulateGrowth(answers);
    } catch (engineErr: any) {
      console.warn("⚠️ Engine DB fetch failed, running sandbox/offline fallback mode:", engineErr?.message);
      // Fallback mode using in-memory engine logic if DB network fails
      const { runGrowthSimulatorEngine } = require("@/lib/simulator/engine");
      result = await runGrowthSimulatorEngine({ userAnswers: answers, isSandbox: true });
    }

    // Session & Revision Architecture V1 Persistence
    let sessionInfo;
    try {
      const { persistSimulationSession } = require("@/lib/simulator/session");
      sessionInfo = await persistSimulationSession({
        email: email || null,
        answers,
        result,
        baseSimulationIdInput: base_simulation_id || body.parent_simulation_id || null
      });

      result.simulation_id = sessionInfo.simulation_id;
      result.simulation_code = sessionInfo.simulation_code;
    } catch (archiveErr: any) {
      console.warn("⚠️ DB Persistence skipped or failed (non-fatal):", archiveErr?.message);
    }

    // Public API Response Sanitization: Remove internal candidate products, SKUs, brand names, and trace
    const publicResponse = {
      simulation_id: sessionInfo?.simulation_id || result.simulation_id || "SIM-" + Math.floor(10000 + Math.random() * 90000),
      simulation_code: sessionInfo?.simulation_code || "GS-" + Math.floor(10000 + Math.random() * 90000),
      base_simulation_id: sessionInfo?.base_simulation_id || sessionInfo?.simulation_id || null,
      revision_no: sessionInfo?.revision_no ?? 0,
      is_no_change: sessionInfo?.is_no_change || false,
      is_sandbox: result.is_sandbox || false,
      display: result.display,
      assortment: {
        primary: result.assortment.primary,
        secondary: result.assortment.secondary,
        primary_description_ko: result.assortment.primary_description_ko,
        secondary_description_ko: result.assortment.secondary_description_ko,
        primary_description_en: result.assortment.primary_description_en,
        secondary_description_en: result.assortment.secondary_description_en,
        category_mix: result.assortment.category_mix,
        price_mix: result.assortment.price_mix || []
      },
      financial: result.financial,
      confidence: result.confidence,
      action_plan_90d: result.action_plan_90d || null
    };

    return NextResponse.json(publicResponse, {
      status: 200,
      headers: corsHeaders
    });

  } catch (err: any) {
    console.error("Simulator engine execution error:", err);
    return NextResponse.json(
      {
        error: "분석 결과를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        error_en: "We couldn't generate your results. Please try again in a moment.",
        details: process.env.NODE_ENV === "development" ? err?.message : undefined
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
