"use client";

import React, { useState } from "react";

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  verificationTip: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "chk-1-outlook",
    category: "Outlook Compatibility",
    title: "1. Outlook Desktop Word 엔진 렌더링 검증",
    description: "Flexbox, CSS Grid 및 최신 CSS3가 완전히 배제되고, 순수 <table role=\"presentation\"> 구조와 Outlook MSO 조건부 주석(<!--[if mso]>)이 적용되었는지 확인합니다.",
    verificationTip: "테스트 발송 후 Outlook 데스크톱 앱에서 레이아웃 붕괴나 가로 왜곡이 없는지 확인합니다.",
  },
  {
    id: "chk-2-darkmode",
    category: "Dark Mode & Contrast",
    title: "2. 다크 모드 가독성 및 명도 대비 (WCAG AA)",
    description: "배경과 텍스트 간 최소 명도 대비 4.5:1 이상을 준수하며, 로고나 그래픽이 투명 배경일 경우 어두운 테마에서도 사라지거나 어색하지 않은지 확인합니다.",
    verificationTip: "iOS Mail 또는 macOS Mail의 다크 모드에서 텍스트가 자동 반전되어도 식별 가능한지 점검합니다.",
  },
  {
    id: "chk-3-mobile",
    category: "Mobile Responsiveness",
    title: "3. 모바일 375px~414px 유연 반응형 검증",
    description: "모바일 화면에서 가로 스크롤(Horizontal Overflow)이 발생하지 않고, 본문 폰트 크기가 최소 14px~16px을 유지하여 핀치 줌 없이 편안하게 읽히는지 확인합니다.",
    verificationTip: "스마트폰 메일 앱(Gmail/Apple Mail)에서 좌우 여백과 버튼 터치 영역(최소 44px)을 확인합니다.",
  },
  {
    id: "chk-4-alttext",
    category: "Asset & Alt Text",
    title: "4. 이미지 자동 다운로드 차단 시 폴백 (Alt Text)",
    description: "기업용 메일 클라이언트가 보안상 이미지를 자동 차단했을 때, Alt 속성과 본문 텍스트만으로도 발신 목적과 핵심 제안 내용이 전달되는지 확인합니다.",
    verificationTip: "메일 클라이언트 설정에서 '이미지 자동 다운로드 안 함' 상태로 본문이 이해되는지 확인합니다.",
  },
  {
    id: "chk-5-links",
    category: "Security & Links",
    title: "5. 링크 보안 프로토콜 및 HTTPS 유효성 검증",
    description: "CTA 버튼과 배너에 매핑된 모든 URL이 유효한 https:// 프로토콜이며, 스팸 필터에 유해 사이트로 오인될 수 있는 단축 URL(bit.ly 등)이 배제되었는지 점검합니다.",
    verificationTip: "이메일 내 모든 클릭 요소를 직접 클릭하여 올바른 랜딩 페이지로 이동하는지 확인합니다.",
  },
  {
    id: "chk-6-footer",
    category: "Compliance & Footer",
    title: "6. 플랫폼 법적 푸터 자동 분리 및 중복 방지",
    description: "템플릿 본문에 가짜 수신 거부 링크나 중복된 회사 주소가 하드코딩되지 않고, K SELECT 발송 플랫폼이 주입하는 공식 CAN-SPAM 법적 푸터만 1회 노출되는지 확인합니다.",
    verificationTip: "최하단에 Letusto Inc. 공식 주소와 유효한 서명 원클릭 수신 거부 링크가 1회만 생성되는지 확인합니다.",
  },
];

const FAQS = [
  {
    q: "이 프롬프트를 ChatGPT나 Claude에 그대로 복사해서 넣으면 되나요?",
    a: "네, 완벽히 작동합니다. Claude 3.5 / 3.7 Sonnet 또는 ChatGPT Plus(GPT-4o)에 그대로 붙여넣으면 본문의 지침을 엄격히 준수하여 프로덕션 등급의 HTML 및 manifest 코드를 생성합니다.",
  },
  {
    q: "사용하는 AI 도구가 ZIP 압축 파일을 직접 생성하지 못하면 어떻게 하나요?",
    a: "문제없습니다. 마스터 프롬프트에 '대체 코드 블록(Fallback Code Blocks)' 지침이 포함되어 있어, AI가 manifest.json, email.html, email.txt 등의 완성된 코드를 개별 코드 블록으로 출력합니다. 이를 복사하여 텍스트 파일로 저장하거나 추후 ZIP으로 묶을 수 있습니다.",
  },
  {
    q: "{{first_name}} 같은 새로운 개인화 변수를 임의로 추가해도 되나요?",
    a: "절대 안 됩니다. K SELECT 발송 엔진은 오직 4개 변수({{company_name}}, {{contact_name}}, {{brand_name}}, {{custom_message}})만 엄격히 지원합니다. 임의의 변수는 치환되지 않고 그대로 수신자에게 노출되거나 발송 오류를 일으킬 수 있습니다.",
  },
  {
    q: "수신 거부 링크나 회사 주소 푸터도 프롬프트에서 요청해야 하나요?",
    a: "아니오! 푸터는 K SELECT 발송 플랫폼이 실제 이메일 발송 시 미국 CAN-SPAM 법적 주소(23B Roland Ave., Mount Laurel, NJ 08054)와 암호화 서명된 원클릭 수신 거부 링크를 자동으로 삽입합니다. 디자인 단계에서는 <!-- K_SELECT_FOOTER_PLACEHOLDER --> 주석만 남겨두시면 이중 푸터 발생을 방지할 수 있습니다.",
  },
  {
    q: "브랜드사로 실제 대량 발송하기 전에 수신 환경을 어떻게 사전 검증하나요?",
    a: "이메일 캠페인 관리 화면의 '테스트 발송(Send Test)' 기능을 활용하여 본인 또는 사내 테스트 이메일 계정(Gmail, Outlook, 모바일 메일 앱 등)으로 먼저 발송한 후 아래 6단계 렌더링 체크리스트를 확인하십시오.",
  },
];

export function ValidationChecklistSection() {
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setCheckedState((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const checkedCount = Object.values(checkedState).filter(Boolean).length;
  const totalCount = CHECKLIST_ITEMS.length;

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                4. 활용 가이드 & 수신 품질 6단계 체크리스트
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Delivery Fidelity
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              자주 묻는 질문 5선과 수신자 인박스 도달률을 보장하기 위한 6단계 사전 점검 기준입니다.
            </p>
          </div>
          <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 self-start sm:self-center">
            점검 진행도: <span className="text-blue-600 dark:text-blue-400">{checkedCount}</span> / {totalCount}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${(checkedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Part 1: 5 Concise Q&As */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 space-y-4">
        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>💬</span>
          <span>자주 묻는 질문 (FAQ) — 5선</span>
        </h4>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/40 space-y-1.5"
            >
              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-extrabold shrink-0">Q{idx + 1}.</span>
                <span>{faq.q}</span>
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300 pl-6 leading-relaxed">
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Part 2: 6-Step Delivery Fidelity Checklist */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🛡️</span>
            <span>인박스 렌더링 6단계 품질 검증 체크리스트 (Delivery Fidelity Checklist)</span>
          </h4>
          <button
            type="button"
            onClick={() => {
              const allChecked = checkedCount === totalCount;
              const next: Record<string, boolean> = {};
              CHECKLIST_ITEMS.forEach((it) => {
                next[it.id] = !allChecked;
              });
              setCheckedState(next);
            }}
            className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium cursor-pointer"
          >
            {checkedCount === totalCount ? "전체 해제" : "전체 선택"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {CHECKLIST_ITEMS.map((item) => {
            const isChecked = !!checkedState[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isChecked
                    ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                    : "bg-zinc-50/50 dark:bg-zinc-850/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // handled by parent onClick
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-zinc-300 cursor-pointer"
                  />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isChecked ? "text-emerald-900 dark:text-emerald-200" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {item.title}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                      {item.description}
                    </p>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 italic bg-white/70 dark:bg-zinc-900/60 p-1.5 rounded mt-1 border border-zinc-200/50 dark:border-zinc-800/50">
                      💡 점검 요령: {item.verificationTip}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
