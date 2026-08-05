import { createClient } from "@/lib/supabase/server";

export interface ExchangeRateInfo {
  rate: number;
  rateDate: string; // YYYY-MM-DD
  rateType: string; // 'Base Exchange Rate'
  source: "Automatic" | "Manual" | "Fallback";
  lastUpdated: string;
  isOld: boolean;
  warning?: string;
}

const DEFAULT_FALLBACK_RATE = 1350.00;

/**
 * 실시간 고시 환율 (원·달러 매매기준율) 자동 조회 및 캐싱
 */
export async function getExchangeRate(): Promise<ExchangeRateInfo> {
  const todayStr = new Date().toISOString().split("T")[0];
  const lastUpdatedTime = new Date().toLocaleString("ko-KR");

  try {
    // 1. 외부 Public API (Open Exchange Rates API) 호출 (인증서/키 불필요)
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 }, // 1시간 캐싱
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Exchange API error: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.result === "success" && data.rates && data.rates.KRW) {
      const krwRate = Number(data.rates.KRW);

      // DB 캐시에 오늘 날짜 환율로 Upsert 시도 (백그라운드 비동기)
      upsertCachedRate(todayStr, krwRate).catch((err) =>
        console.error("Failed to cache today's exchange rate in DB:", err)
      );

      return {
        rate: krwRate,
        rateDate: todayStr,
        rateType: "Base Exchange Rate",
        source: "Automatic",
        lastUpdated: lastUpdatedTime,
        isOld: false,
      };
    }

    throw new Error("Invalid exchange rate payload format");
  } catch (error) {
    console.warn("Failed to fetch live exchange rate from API, checking DB cache...", error);

    // 2. Fallback 1: DB에서 가장 최신의 캐시된 환율 로드
    try {
      const cached = await getLatestCachedRate();
      if (cached) {
        return {
          rate: cached.rate,
          rateDate: cached.date,
          rateType: "Base Exchange Rate",
          source: "Automatic",
          lastUpdated: lastUpdatedTime,
          isOld: true,
          warning: `최신 환율을 불러오지 못했습니다. ${cached.date}에 저장된 환율이 적용되었습니다.`,
        };
      }
    } catch (dbErr) {
      console.error("Failed to load cached exchange rate from DB:", dbErr);
    }

    // 3. Fallback 2: Admin 기본 Fallback 환율 제공
    return {
      rate: DEFAULT_FALLBACK_RATE,
      rateDate: todayStr,
      rateType: "Base Exchange Rate",
      source: "Fallback",
      lastUpdated: lastUpdatedTime,
      isOld: true,
      warning: `최신 환율을 조회할 수 없어 시스템 기본 환율(₩${DEFAULT_FALLBACK_RATE})이 임시 적용되었습니다.`,
    };
  }
}

/** DB 캐시 최신 환율 가져오기 */
async function getLatestCachedRate(): Promise<{ rate: number; date: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("rate_date, rate_value")
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    rate: Number(data.rate_value),
    date: data.rate_date,
  };
}

/** DB 캐시에 당일 환율 기록 캐싱 */
async function upsertCachedRate(dateStr: string, rate: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("exchange_rates")
    .upsert({
      rate_date: dateStr,
      rate_value: rate,
      source: "automatic",
      created_at: new Date().toISOString(),
    }, {
      onConflict: "rate_date"
    });

  if (error) {
    throw error;
  }
}
