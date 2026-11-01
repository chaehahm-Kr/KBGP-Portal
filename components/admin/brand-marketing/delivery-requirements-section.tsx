"use client";

import React, { useState } from "react";
import { PROPOSED_DELIVERY_PACKAGE_CONTRACT } from "@/lib/brand-marketing/master-prompt-generator";

export function DeliveryRequirementsSection() {
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState(false);

  const manifestJsonString = JSON.stringify(
    PROPOSED_DELIVERY_PACKAGE_CONTRACT.manifestSchemaExample,
    null,
    2
  );

  const linksJsonString = JSON.stringify(
    PROPOSED_DELIVERY_PACKAGE_CONTRACT.linksJsonExample,
    null,
    2
  );

  const handleCopyManifest = async () => {
    try {
      await navigator.clipboard.writeText(manifestJsonString);
      setCopiedSchema(true);
      setTimeout(() => setCopiedSchema(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyLinks = async () => {
    try {
      await navigator.clipboard.writeText(linksJsonString);
      setCopiedLinks(true);
      setTimeout(() => setCopiedLinks(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                3. 외주 디자이너 및 AI 납품 규격 계약 (Delivery Package Contract)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                Proposed Standard (Draft)
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              외주 크리에이티브 에이전시 또는 AI가 산출해야 하는 표준 ZIP 아카이브 및 파일 구조 규격입니다.
            </p>
          </div>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono self-start sm:self-center">
            {PROPOSED_DELIVERY_PACKAGE_CONTRACT.proposedStandardVersion}
          </span>
        </div>

        {/* Integration Gate Notice */}
        <div className="mt-3 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
          <div className="font-bold flex items-center gap-1.5 mb-0.5">
            <span>ℹ️</span>
            <span>ADM-EMAIL-TPL-001 연계 안내 (Integration Gate Notice):</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
            현재 표시되는 ZIP 아카이브 구조 및 파일 규격은 제안 규격(Proposed Standard)입니다.
            Agent 3이 개발 중인 <strong>ADM-EMAIL-TPL-001 (템플릿 관리자 개편 및 ZIP 임포터)</strong>의 파서 및 밸리데이터 구현 완료 시
            상호 검증을 거쳐 최종 공식 패키지 규격으로 확정됩니다.
          </p>
        </div>
      </div>

      {/* Visual Package Tree */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3">
        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
          <span>📦 표준 납품 아카이브 트리 구조 (Package Directory Tree)</span>
          <span className="text-[10px] text-zinc-400 font-normal">ZIP 압축 파일 1개로 납품</span>
        </h4>

        <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-zinc-800 leading-relaxed">
          <div className="text-emerald-400 font-bold">email-package.zip</div>
          <div className="text-zinc-300">├── <span className="text-amber-300 font-bold">manifest.json</span>    <span className="text-zinc-500 text-[11px]"># [필수] 메타데이터, 버전, 변수 목록, CTA 정의</span></div>
          <div className="text-zinc-300">├── <span className="text-blue-300 font-bold">email.html</span>       <span className="text-zinc-500 text-[11px]"># [필수] 600px 테이블 기반 완성형 HTML (인라인 CSS)</span></div>
          <div className="text-zinc-300">├── <span className="text-purple-300 font-bold">email.txt</span>        <span className="text-zinc-500 text-[11px]"># [필수] 스팸 필터 회피용 1:1 순수 텍스트 대체본</span></div>
          <div className="text-zinc-300">├── <span className="text-cyan-300 font-bold">assets/</span>          <span className="text-zinc-500 text-[11px]"># [선택] 슬라이스 이미지 자산 폴더 (&lt; 300KB/슬라이스)</span></div>
          <div className="text-zinc-300">│   ├── hero_slice.png</div>
          <div className="text-zinc-300">│   └── cta_banner.png</div>
          <div className="text-zinc-300">├── <span className="text-teal-300 font-bold">links.json</span>       <span className="text-zinc-500 text-[11px]"># [선택] CTA 및 슬라이스별 HTTPS 랜딩 URL 매핑표</span></div>
          <div className="text-zinc-300">└── <span className="text-zinc-400 font-bold">README.md</span>        <span className="text-zinc-500 text-[11px]"># [선택] 디자이너 작업 노트, 폰트 명세, 주의사항</span></div>
        </div>
      </div>

      {/* Package Files Specification Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            📑 파일별 상세 규격 및 요구사항 (File Specifications)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 text-[11px] font-bold">
              <tr>
                <th className="py-2.5 px-4">파일명 (File Name)</th>
                <th className="py-2.5 px-3">필수 여부</th>
                <th className="py-2.5 px-3">형식 (Format)</th>
                <th className="py-2.5 px-4">상세 설명 및 기술 기준</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {PROPOSED_DELIVERY_PACKAGE_CONTRACT.files.map((file, idx) => (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/40">
                  <td className="py-2.5 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {file.fileName}
                  </td>
                  <td className="py-2.5 px-3">
                    {file.required ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                        필수 (Required)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        선택 (Optional)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[11px] text-zinc-500 font-mono">
                    {file.formatDetails}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-zinc-600 dark:text-zinc-300">
                    {file.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Schema Previews (Manifest & Links) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Manifest Preview */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              manifest.json 예시
            </span>
            <button
              type="button"
              onClick={handleCopyManifest}
              className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              {copiedSchema ? "✓ Copied!" : "📋 Copy Schema"}
            </button>
          </div>
          <pre className="p-3 bg-zinc-950 text-zinc-200 rounded-lg text-[11px] font-mono overflow-x-auto border border-zinc-800 max-h-56">
            {manifestJsonString}
          </pre>
        </div>

        {/* Links Preview */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono">
              links.json 예시
            </span>
            <button
              type="button"
              onClick={handleCopyLinks}
              className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
            >
              {copiedLinks ? "✓ Copied!" : "📋 Copy Links"}
            </button>
          </div>
          <pre className="p-3 bg-zinc-950 text-zinc-200 rounded-lg text-[11px] font-mono overflow-x-auto border border-zinc-800 max-h-56">
            {linksJsonString}
          </pre>
        </div>
      </div>

      {/* Technical Standards Summary Card */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 space-y-3">
        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
          ⚙️ 핵심 이메일 마크업 기술 기준 요약 (Canonical Technical Rules)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-1">
            <div className="font-bold text-zinc-900 dark:text-zinc-100">📏 600px 표준 너비</div>
            <p className="text-[11px] text-zinc-500">
              데스크톱 인박스 최적화 너비 600px 유지, 모바일(375px~414px) 유연 반응형 스택
            </p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-1">
            <div className="font-bold text-zinc-900 dark:text-zinc-100">📊 테이블 기반 레이아웃</div>
            <p className="text-[11px] text-zinc-500">
              Flexbox/Grid 절대 금지. Outlook Word 엔진을 위해 &lt;table role=&quot;presentation&quot;&gt; 필수
            </p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-1">
            <div className="font-bold text-zinc-900 dark:text-zinc-100">🎨 100% 인라인 CSS</div>
            <p className="text-[11px] text-zinc-500">
              폰트, 색상, 여백 등 모든 필수 시각 속성을 태그 내 style=&quot;&quot; 속성에 인라인 적용
            </p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-1">
            <div className="font-bold text-zinc-900 dark:text-zinc-100">🛡️ 무스크립트 (Zero Scripts)</div>
            <p className="text-[11px] text-zinc-500">
              &lt;script&gt;, &lt;iframe&gt;, onclick 이벤트 핸들러 완전 배제. 발견 시 자동 차단
            </p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-1">
            <div className="font-bold text-zinc-900 dark:text-zinc-100">🗜️ 자산 용량 최적화</div>
            <p className="text-[11px] text-zinc-500">
              슬라이스당 300KB 이하, 전체 이미지 2MB 미만, WebP/PNG/JPG 권장
            </p>
          </div>
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 space-y-1">
            <div className="font-bold text-zinc-900 dark:text-zinc-100">🔒 보안 HTTPS 프로토콜</div>
            <p className="text-[11px] text-zinc-500">
              모든 외부 링크는 https:// 프로토콜 필수. 비보안 http:// 또는 비정상 스킴 금지
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
