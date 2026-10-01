"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AskAnswerResponse, AskSourceCitation } from "@/lib/knowledge/ask-engine";

export interface AskKSelectViewProps {
  portalType: "BRAND" | "RETAILER" | "ADMIN";
  baseHelpPath: string;
  baseSupportPath: string;
  apiEndpoint?: string;
  quickQuestions?: string[];
  placeholderText?: string;
  heroBadge?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}

export function AskKSelectView({
  portalType,
  baseHelpPath,
  baseSupportPath,
  apiEndpoint = "/api/knowledge/ask",
  quickQuestions = portalType === "BRAND"
    ? [
        "브랜드 등록 전제조건이 무엇인가요?",
        "상표권이 없어도 등록할 수 있나요?",
        "상품이 연결된 브랜드를 삭제할 수 있나요?",
        "동일 브랜드를 여러 회사가 취급할 수 있나요?"
      ]
    : portalType === "RETAILER"
    ? [
        "바이어 발주 절차는 어떻게 되나요?",
        "결제 및 정산 주기 안내",
        "매장 추가 및 권한 설정 방법",
        "1:1 문의하기 안내"
      ]
    : [
        "INSIGHTS Topic Score 기준은?",
        "HIGH Risk 검증 기준은?",
        "0 Draft Day 운영 원칙",
        "지식 개정(Version) 절차"
      ],
  placeholderText = portalType === "BRAND"
    ? "브랜드 등록, 상표권, 삭제 정책 등 궁금한 점을 질문해 보세요..."
    : portalType === "RETAILER"
    ? "바이어 발주, 매장 설정, 정산 정책 등 질문을 입력하세요..."
    : "K SELECT 플랫폼 운영 지침 및 시스템 규칙을 질문하세요...",
  heroBadge = "Grounded Knowledge Assistant",
  heroTitle = portalType === "BRAND"
    ? "Ask K SELECT (지능형 정책 도우미)"
    : portalType === "RETAILER"
    ? "Ask K SELECT (Retail Assistant)"
    : "Ask K SELECT Guide",
  heroSubtitle = portalType === "BRAND"
    ? "공식 승인된 Brand Portal 운영 매뉴얼 및 정책에 기반하여 실시간으로 안내해 드립니다."
    : portalType === "RETAILER"
    ? "K SELECT Retail Portal 공식 도움말에 기반하여 실시간으로 안내해 드립니다."
    : "검증된 공식 지식 및 Live System Rule을 기반으로 실시간 운영 가이드를 제공합니다."
}: AskKSelectViewProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskAnswerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (questionToAsk?: string) => {
    const q = (questionToAsk || query).trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    if (questionToAsk) setQuery(questionToAsk);

    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          audience: portalType === "BRAND" ? "BRAND" : portalType === "RETAILER" ? "RETAILER" : "INTERNAL",
          currentRoute: baseHelpPath
        })
      });

      if (!res.ok) {
        throw new Error(`답변 조회에 실패했습니다. (상태 코드: ${res.status})`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (err: any) {
      console.error("Ask K SELECT error:", err);
      setError(err.message || "오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type?.toUpperCase()) {
      case "MANUAL":
        return <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">MANUAL</span>;
      case "POLICY":
        return <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">POLICY</span>;
      case "FAQ":
        return <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">FAQ</span>;
      case "SOP":
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">SOP</span>;
      case "SYSTEM_RULE":
        return <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">SYSTEM RULE</span>;
      default:
        return <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href={baseHelpPath} className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
          Help Center
        </Link>
        <span>/</span>
        <span className="font-semibold text-zinc-900 dark:text-white">Ask K SELECT</span>
      </div>

      {/* Hero Search & Header Card */}
      <div className="rounded-2xl bg-gradient-to-b from-zinc-900 via-[#131E2E] to-zinc-900 text-white p-6 sm:p-10 shadow-lg space-y-6">
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider text-cyan-300 backdrop-blur-xs">
            <span>✨</span> {heroBadge}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {heroTitle}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            {heroSubtitle}
          </p>
        </div>

        {/* Search Question Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="max-w-2xl mx-auto space-y-3"
        >
          <div className="relative flex items-center">
            <span className="absolute left-4 text-zinc-400 text-lg select-none">💬</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholderText}
              disabled={loading}
              className="w-full rounded-xl bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white pl-12 pr-28 py-3.5 text-sm font-medium shadow-lg border border-zinc-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-zinc-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              {loading ? (
                <span>조회 중...</span>
              ) : (
                <>
                  <span>질문하기</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Question Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-zinc-400 text-[11px] shrink-0 font-medium">추천 질문:</span>
            {quickQuestions.map((qText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(qText)}
                className="rounded-full bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white px-3 py-1 text-[11px] font-medium transition-all shrink-0 cursor-pointer border border-white/10"
              >
                {qText}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-4 animate-pulse">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
          <div className="space-y-2 pt-2">
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-full" />
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-5/6" />
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded w-4/6" />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* Answer Presentation Card */}
      {response && !loading && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm space-y-6">
            {/* Answer Header Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span>🛡️</span>
                  <span>{response.isUnknown ? "안내 (Notice)" : "공식 승인 지식 기반 답변"}</span>
                </span>
                <span className="text-xs text-zinc-400">
                  대상: {response.audience}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400">
                {new Date(response.createdAt).toLocaleTimeString()} 기준
              </span>
            </div>

            {/* Direct Answer */}
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white leading-snug">
                {response.directAnswer}
              </h3>

              {/* Bullet Points */}
              {response.currentRuleBullets && response.currentRuleBullets.length > 0 && (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 p-4 space-y-2.5 border border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                    📌 핵심 정책 및 운영 규칙 (Core Rules)
                  </span>
                  <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                    {response.currentRuleBullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-blue-500 font-bold mt-0.5">•</span>
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Official Source Citations */}
            {response.sources && response.sources.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                  📚 공식 출처 및 근거 문서 (Official Citations)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {response.sources.map((src: AskSourceCitation) => (
                    <Link
                      key={src.id}
                      href={src.url}
                      className="group flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          {getTypeBadge(src.type)}
                          <span className="text-[10px] font-semibold text-zinc-400">
                            버전 {src.version}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {src.title}
                        </h4>
                      </div>
                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>시행일: {src.effectiveDate}</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                          문서 보기 &rarr;
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Related PDF Manuals */}
            {response.relatedManuals && response.relatedManuals.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                  📄 첨부 공식 PDF 매뉴얼
                </span>
                <div className="space-y-2">
                  {response.relatedManuals.map((man, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">📄</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {man.title}
                          </p>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                            공식 배포본 ({man.version})
                          </p>
                        </div>
                      </div>
                      <a
                        href={man.viewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        PDF 열기
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Questions / Follow-ups */}
            {response.relatedQuestions && response.relatedQuestions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 block">
                  💡 연관 질문 (Related Questions)
                </span>
                <div className="flex flex-wrap gap-2">
                  {response.relatedQuestions.map((rq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAsk(rq)}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      {rq} &rarr;
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {response.actions && response.actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                {response.actions.map((act, i) => (
                  <Link
                    key={i}
                    href={act.url}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                      act.type === "support"
                        ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {act.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Support Escalation Footer Banner */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              추가 문의가 필요하신가요?
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            K SELECT 운영팀에 1:1 문의를 남겨주시면 담당자가 신속히 확인하여 안내해 드립니다.
          </p>
        </div>
        <Link
          href={baseSupportPath}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#131E2E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1f3047] dark:bg-white dark:text-[#131E2E] transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          <span>1:1 문의하기</span>
          <span>&rarr;</span>
        </Link>
      </div>
    </div>
  );
}
