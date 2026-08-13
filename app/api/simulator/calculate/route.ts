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
    const { answers, email } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload. 'answers' object is required." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 시뮬레이터 코어 엔진 가동 (DB 매트릭스 Join 매핑 계산)
    const result = await simulateGrowth(answers);

    // Supabase Admin 클라이언트를 통해 이력 DB 적재
    const supabase = createAdminClient();
    const { error: dbError } = await supabase
      .from("simulation_results")
      .insert({
        email: email || null,
        answers_snapshot: answers,
        result_snapshot: result
      });

    if (dbError) {
      console.error("Failed to archive simulation result:", dbError);
      // DB 적재가 실패하더라도 사용자 경험을 위해 계산 결과는 전달
    }

    return NextResponse.json(result, {
      status: 200,
      headers: corsHeaders
    });

  } catch (err: any) {
    console.error("Simulator engine execution error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err?.message || err },
      { status: 500, headers: corsHeaders }
    );
  }
}
