/**
 * Brand Marketing Phase 2 — Universal Master AI Prompt Generator
 * Task ID: ADM-EMAIL-TPL-002
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 *
 * Generates a unified, cross-tool Master Prompt for Claude, ChatGPT, Gemini,
 * and human creative agencies to produce standardized K SELECT email packages.
 */

import {
  CampaignBrief,
  BriefValidationResult,
  ExamplePreset,
  DeliveryPackageContract,
} from "./master-prompt-types";

export const SUPPORTED_PERSONALIZATION_VARIABLES = [
  { name: "{{company_name}}", desc: "수신 기업명 (예: 아모레퍼시픽, 닥터자르트)", example: "코스맥스" },
  { name: "{{contact_name}}", desc: "수신 담당자명 또는 직함", example: "김대표님 / 마케팅 총괄" },
  { name: "{{brand_name}}", desc: "수신 대표 브랜드명", example: "이니스프리" },
  { name: "{{custom_message}}", desc: "기업별 1:1 맞춤 제안 문구", example: "지난 코스모프로프 라스베이거스 부스에서 안내드렸던..." },
] as const;

export const DEFAULT_CAMPAIGN_BRIEF: CampaignBrief = {
  campaignObjective: "미국 오프라인 리테일 진출 및 온·오프라인 하이브리드 유통 채널 입점을 제안하여 K-뷰티 브랜드 파트너십 유치",
  targetAudience: "미국 시장 진출 또는 확장을 모색하는 한국 화장품 및 K-뷰티 브랜드사 대표, 해외영업 총괄, 마케팅 디렉터",
  coreMessage: "K SELECT NETWORK를 통해 미국 현지 대형 유통망과 아마존 채널을 통합 관리하고, 리스크 없이 안정적인 북미 도매 공급을 실현하세요.",
  requiredContent: "1) K SELECT 글로벌 공급망 핵심 혜택, 2) 미국 리테일러 입점 네트워크 개요, 3) 위탁/직매입 하이브리드 정산 시스템, 4) 입점 신청 및 미팅 신청 절차 안내",
  designDirection: "모던하고 신뢰감 있는 프리미엄 K-Beauty 기업 비즈니스 룩앤필. 짙은 네이비와 세련된 로즈 골드/화이트 포인트, 가독성이 뛰어난 카드형 섹션 분할",
  primaryCtaText: "파트너십 입점 신청하기 (Apply for Partnership)",
  primaryCtaUrl: "https://www.kselectnetwork.com/apply",
  campaignTitle: "2026 K SELECT 미국 뷰티 유통 네트워크 파트너십 제안",
  preferredLanguage: "ko",
  designFormat: "responsive-html",
  brandColors: "#0F172A (Navy/Charcoal), #F43F5E (Accent Rose), #F8FAFC (Light Gray BG)",
  secondaryCtaText: "파트너십 소개서 다운로드 (Download Deck)",
  secondaryCtaUrl: "https://www.kselectnetwork.com/deck",
  additionalInstructions: "수신자가 모바일 메일 앱(Gmail, iOS Mail)에서 볼 때 가독성이 최적화되도록 텍스트 폰트 크기를 충분히 확보하고, 수신 거부 푸터는 K SELECT 플랫폼에서 자동 삽입되므로 이중 삽입하지 마십시오.",
};

export const CAMPAIGN_BRIEF_PRESETS: ExamplePreset[] = [
  {
    id: "us-wholesale-retail",
    title: "1. 미국 오프라인 리테일 네트워크 진출 제안 (US Wholesale & Retail)",
    description: "미국 내 오프라인 뷰티 편집숍 및 메이저 유통망 입점 확장을 원하는 브랜드를 위한 표준 B2B 제안서",
    brief: {
      campaignTitle: "K SELECT NETWORK 2026 북미 오프라인 리테일 유통 파트너십",
      campaignObjective: "한국 우수 뷰티 브랜드의 미국 50개 주 오프라인 리테일 네트워크 도매 납품 제안 및 신규 브랜드 유치",
      targetAudience: "국내 뷰티 브랜드 대표이사, 해외 영업팀장, 글로벌 사업개발 책임자",
      coreMessage: "복잡한 현지 통관·물류·재고 부담 없이 K SELECT 네트워크를 통해 미국 주요 오프라인 스토어에 브랜드를 직접 진열하세요.",
      requiredContent: "1. K SELECT 오프라인 유통망 커버리지\n2. 물류 및 교환/반품 안전장치 (Protection Coverage)\n3. 바이어 위클리 리포트 및 판매 대시보드 제공\n4. 입점 신청 및 1:1 상담 안내",
      designDirection: "전문적이고 신뢰감 있는 B2B 코퍼레이트 디자인, 군더더기 없는 타이포그래피, 실적 인포그래픽 카드 배치",
      primaryCtaText: "파트너십 입점 상담 신청",
      primaryCtaUrl: "https://www.kselectnetwork.com/apply",
      preferredLanguage: "ko",
      designFormat: "responsive-html",
      brandColors: "#0A192F (Navy), #00B4D8 (Tech Blue), #FFFFFF",
      secondaryCtaText: "유통 프로그램 가이드 보기",
      secondaryCtaUrl: "https://www.kselectnetwork.com/guide",
      additionalInstructions: "미국 현지 매장 사진이나 실적을 상징하는 비주얼 플레이스홀더를 헤더 바로 아래에 배치해 주세요.",
    },
  },
  {
    id: "amazon-hybrid-fba",
    title: "2. 아마존 FBA + 오프라인 하이브리드 파트너십 (Amazon Hybrid Distribution)",
    description: "아마존 채널과 오프라인 리테일을 동시 공략하는 옴니채널 파트너십 제안",
    brief: {
      campaignTitle: "K SELECT 옴니채널 프로그램: 아마존 독점 유통 및 현지 물류 대행",
      campaignObjective: "미국 아마존 랭킹 진입 및 오프라인 매장 동시 확장을 원하는 K-뷰티 유망 브랜드 발굴",
      targetAudience: "미국 이커머스 매출 증대를 목표로 하는 화장품 제조사 및 D2C 브랜드사",
      coreMessage: "아마존 공식 플래그십 운영과 오프라인 스토어 납품을 단 하나의 통합 계약으로 해결하세요.",
      requiredContent: "1. 아마존 FBA 및 미국 내 현지 창고 풀필먼트 원스톱 지원\n2. 브랜드 IP 보호 및 가격 붕괴 방지 정책\n3. 주간 매출 및 재고 회전율 분석 리포트\n4. 공식 제휴 문의",
      designDirection: "성장과 활력을 상징하는 다이내믹한 핀테크/이커머스 스타일, 높은 대비와 명확한 메트릭 강조",
      primaryCtaText: "하이브리드 프로그램 참여하기",
      primaryCtaUrl: "https://www.kselectnetwork.com/amazon-hybrid",
      preferredLanguage: "ko",
      designFormat: "responsive-html",
      brandColors: "#111827 (Dark Gray), #FF9900 (Amazon Orange), #10B981 (Success Green)",
      secondaryCtaText: "사례 연구 자료 신청",
      secondaryCtaUrl: "https://www.kselectnetwork.com/casestudy",
      additionalInstructions: "주요 숫자가 눈에 띄도록 강조 카운터 블록을 구성해 주세요.",
    },
  },
  {
    id: "global-exhibitor-outreach",
    title: "3. 글로벌 뷰티 박람회 참가사 맞춤 제안 (Beauty Show Exhibitor Outreach)",
    description: "코스모프로프/인디뷰티쇼 등 국제 전시회 참가 브랜드를 대상으로 한 영문/국문 파트너십 제안",
    brief: {
      campaignTitle: "K SELECT Partnership Proposal for International Beauty Exhibitors",
      campaignObjective: "국제 뷰티 박람회에 출품한 글로벌 역량을 갖춘 뷰티 기업의 북미 총판 파트너십 체결",
      targetAudience: "Exhibitors at Cosmoprof / Indie Beauty Show / K-Beauty Expos seeking North American distribution",
      coreMessage: "Accelerate your US wholesale footprint with K SELECT's established verified retailer network and guaranteed inventory terms.",
      requiredContent: "1. Welcome message for exhibition participants\n2. K SELECT 360 Distribution Framework\n3. Risk-free wholesale fulfillment & retailer matching\n4. Schedule a 15-minute introductory meeting",
      designDirection: "International luxury beauty editorial aesthetic, high visual impact, clean grid layout with bilingual readiness",
      primaryCtaText: "Schedule Partnership Call",
      primaryCtaUrl: "https://www.kselectnetwork.com/schedule",
      preferredLanguage: "bilingual",
      designFormat: "responsive-html",
      brandColors: "#1A1A1A (Black), #D4AF37 (Metallic Gold), #F9F9F9",
      secondaryCtaText: "View Brand Deck",
      secondaryCtaUrl: "https://www.kselectnetwork.com/deck-en",
      additionalInstructions: "국문 및 영문 수신자 모두 자연스럽게 읽을 수 있도록 핵심 요약은 2개 언어 병기를 고려해 주세요.",
    },
  },
];

export const PROPOSED_DELIVERY_PACKAGE_CONTRACT: DeliveryPackageContract = {
  packageName: "email-package.zip",
  proposedStandardVersion: "1.0.0-draft (Pending ADM-EMAIL-TPL-001 Integration Gate)",
  files: [
    {
      fileName: "manifest.json",
      description: "템플릿 메타데이터, 버전, 지원 플레이스홀더, 작성자 및 슬라이스 매핑 정보",
      required: true,
      formatDetails: "JSON 객체 (name, version, format, author, variables, supportedClients 등)",
    },
    {
      fileName: "email.html",
      description: "이메일 클라이언트 호환 테이블 기반 마크업 및 인라인 CSS가 적용된 완성형 HTML 본문",
      required: true,
      formatDetails: "HTML5 (최대 너비 600px, 테이블 레이아웃, zero-script, zero-iframe)",
    },
    {
      fileName: "email.txt",
      description: "스팸 필터 회피 및 스크린리더를 위한 1:1 순수 텍스트 대체본",
      required: true,
      formatDetails: "UTF-8 Plain Text (개인화 변수 포함)",
    },
    {
      fileName: "assets/",
      description: "이메일에 사용된 슬라이스 이미지 및 그래픽 자산 폴더",
      required: false,
      formatDetails: "JPG / PNG / WebP (슬라이스당 300KB 이하, 전체 2MB 미만)",
    },
    {
      fileName: "links.json",
      description: "각 CTA 및 이미지 슬라이스별 클릭 시 이동할 HTTPS 랜딩 링크 매핑표",
      required: false,
      formatDetails: "JSON 객체 (슬라이스 또는 버튼 식별자 -> HTTPS URL 매핑)",
    },
    {
      fileName: "README.md",
      description: "외주 디자이너 또는 AI 제작자의 렌더링 노트, 폰트 정보 및 권장 검증 절차",
      required: false,
      formatDetails: "Markdown 문서",
    },
  ],
  manifestSchemaExample: {
    templateName: "2026 K-Beauty US Expansion Outreach",
    version: "1.0.0",
    format: "responsive-html",
    author: "K SELECT Marketing Creative Team",
    variables: ["company_name", "contact_name", "brand_name", "custom_message"],
    primaryCta: {
      label: "Apply for Partnership",
      targetUrl: "https://www.kselectnetwork.com/apply",
    },
    previewText: "미국 50개 주 뷰티 유통망 입점 및 도매 공급망 파트너십을 제안드립니다.",
    recommendedEmailWidth: 600,
  },
  linksJsonExample: {
    hero_header: "https://www.kselectnetwork.com",
    primary_cta: "https://www.kselectnetwork.com/apply",
    secondary_cta: "https://www.kselectnetwork.com/deck",
    inquiry_email: "mailto:Contact@letusto.com",
  },
};

/**
 * Validates the Campaign Brief inputs.
 */
export function validateCampaignBrief(brief: Partial<CampaignBrief>): BriefValidationResult {
  const errors: Record<string, string> = {};
  const warnings: string[] = [];

  // Six Primary Required Fields
  if (!brief.campaignObjective || brief.campaignObjective.trim().length === 0) {
    errors.campaignObjective = "캠페인 목표(Campaign Objective)를 입력해 주세요.";
  }
  if (!brief.targetAudience || brief.targetAudience.trim().length === 0) {
    errors.targetAudience = "타깃 오디언스(Target Audience)를 입력해 주세요.";
  }
  if (!brief.coreMessage || brief.coreMessage.trim().length === 0) {
    errors.coreMessage = "핵심 메시지(Core Message)를 입력해 주세요.";
  }
  if (!brief.requiredContent || brief.requiredContent.trim().length === 0) {
    errors.requiredContent = "필수 포함 내용(Required Content)을 입력해 주세요.";
  }
  if (!brief.designDirection || brief.designDirection.trim().length === 0) {
    errors.designDirection = "디자인 방향성(Design Direction)을 입력해 주세요.";
  }
  if (!brief.primaryCtaText || brief.primaryCtaText.trim().length === 0) {
    errors.primaryCtaText = "주요 행동 유도 버튼 문구(Primary CTA)를 입력해 주세요.";
  }

  // URL Validation (if supplied)
  if (brief.primaryCtaUrl && brief.primaryCtaUrl.trim().length > 0) {
    try {
      const u = new URL(brief.primaryCtaUrl.trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        errors.primaryCtaUrl = "CTA 링크는 올바른 HTTP/HTTPS URL이어야 합니다.";
      }
    } catch {
      errors.primaryCtaUrl = "올바른 URL 형식을 입력해 주세요 (예: https://example.com).";
    }
  }

  if (brief.secondaryCtaUrl && brief.secondaryCtaUrl.trim().length > 0) {
    try {
      const u = new URL(brief.secondaryCtaUrl.trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        errors.secondaryCtaUrl = "보조 CTA 링크는 올바른 HTTP/HTTPS URL이어야 합니다.";
      }
    } catch {
      errors.secondaryCtaUrl = "올바른 URL 형식을 입력해 주세요 (예: https://example.com).";
    }
  }

  // Warning checks
  if (brief.campaignObjective && brief.campaignObjective.length < 15) {
    warnings.push("캠페인 목표가 너무 짧습니다. 보다 구체적인 비즈니스 목적을 작성하면 AI 생성 품질이 향상됩니다.");
  }
  if (brief.coreMessage && brief.coreMessage.length < 20) {
    warnings.push("핵심 메시지를 보다 상세하게 보완하면 수신자 설득력이 높아집니다.");
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}

/**
 * Generates the Universal Master AI Prompt from the Campaign Brief.
 * Can be directly copied and pasted into Claude, ChatGPT, Gemini, or delivered to a design agency.
 */
export function generateUniversalMasterPrompt(brief: CampaignBrief): string {
  const languageLabel =
    brief.preferredLanguage === "ko"
      ? "Korean (한국어 중심, 자연스러운 비즈니스 정중체)"
      : brief.preferredLanguage === "en"
      ? "English (Professional US B2B Executive tone)"
      : "Bilingual (Korean + English 핵심 요약 병기)";

  const formatInstruction =
    brief.designFormat === "responsive-html"
      ? "Default Responsive HTML email with inline CSS and table layout"
      : "Image-led email design with sliced graphical sections wrapped in email-safe HTML table structure";

  return `=== K SELECT NETWORK EMAIL DESIGN & DEVELOPMENT MASTER PROMPT ===
# ROLE & MISSION
You are an Elite B2B Email Designer and Senior Email Developer specializing in bulletproof, high-deliverability marketing emails for K SELECT NETWORK (operated by Letusto Inc.).
Your mission is to generate a complete, professional, production-grade email marketing package based on the approved Campaign Brief below.

This email must strictly render flawlessly across all major email clients (Gmail web/mobile, Outlook desktop Word-engine, Apple Mail, Outlook mobile, Yahoo).

--------------------------------------------------------------------------------
# PART 1: APPROVED CAMPAIGN BRIEF
--------------------------------------------------------------------------------
- Campaign Title: ${brief.campaignTitle || "K SELECT B2B Outreach Campaign"}
- Preferred Language: ${languageLabel}
- Design Format: ${formatInstruction}
- Campaign Objective:
  ${brief.campaignObjective}
- Target Audience:
  ${brief.targetAudience}
- Core Value Proposition & Message:
  ${brief.coreMessage}
- Required Content Sections:
  ${brief.requiredContent}
- Visual Design Direction:
  ${brief.designDirection}
- Primary Call to Action (CTA):
  Button Label: "${brief.primaryCtaText}"
  Target URL: ${brief.primaryCtaUrl || "https://www.kselectnetwork.com/apply"}
${brief.secondaryCtaText ? `- Secondary Call to Action (CTA):\n  Button Label: "${brief.secondaryCtaText}"\n  Target URL: ${brief.secondaryCtaUrl || "https://www.kselectnetwork.com"}` : ""}
${brief.brandColors ? `- Brand Colors & Palette:\n  ${brief.brandColors}` : ""}
${brief.brandLogoDescription ? `- Brand Logo / Visual Assets:\n  ${brief.brandLogoDescription}` : ""}
${brief.supportingDocuments ? `- Supporting Documents / Context:\n  ${brief.supportingDocuments}` : ""}
${brief.referenceLinks ? `- Reference URLs:\n  ${brief.referenceLinks}` : ""}
${brief.additionalInstructions ? `- Special Instructions / Tone Notes:\n  ${brief.additionalInstructions}` : ""}

--------------------------------------------------------------------------------
# PART 2: CANONICAL EMAIL HTML & CSS TECHNICAL STANDARDS
--------------------------------------------------------------------------------
1. CANVAS & SIZING:
   - Maximum container width on desktop: Exactly 600px.
   - Fluid responsive presentation on mobile (375px to 414px viewports).
   - Centered alignment on desktop with neutral outer background.

2. TABLE-BASED ARCHITECTURE (CRITICAL FOR OUTLOOK COMPATIBILITY):
   - Never use Flexbox or CSS Grid for essential layout. Outlook desktop relies on Microsoft Word's rendering engine and will completely break modern layout engines.
   - Use <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"> for all structural wrapping.
   - Wrap all major rows in distinct <tr><td> blocks.
   - Include Microsoft Outlook conditional comments for bulletproof desktop container width:
     <!--[if (gte mso 9)|(IE)]>
     <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
     <tr><td>
     <![endif]-->
     ... email body ...
     <!--[if (gte mso 9)|(IE)]>
     </td></tr></table>
     <![endif]-->

3. INLINE CSS & STYLING RULES:
   - Apply all critical layout, font-size, line-height, color, margin, and padding styles INLINE via the 'style=""' attribute.
   - Allowed in <style> block: only responsive media queries (@media only screen and (max-width: 600px)) for mobile stacking and font scaling.
   - Minimum body font size: 14px–16px; headings: 20px–28px.
   - Minimum text-to-background contrast ratio: 4.5:1 (WCAG AA accessibility standard).
   - Base system font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple SD Gothic Neo', 'Malgun Gothic'.

4. SECURITY & HYGIENE (ZERO SCRIPTS):
   - ABSOLUTELY NO <script>, <iframe>, <object>, <embed>, <form>, or <input> tags.
   - NO inline JavaScript event handlers (onclick, onload, etc.).
   - NO 'javascript:' pseudo-protocol links.
   - All links must use secure HTTPS protocol ('https://...').

5. IMAGE & ASSET RULES:
   - Do NOT create a single massive image of the entire email. Essential text (headlines, body, CTAs) MUST be real HTML text so that the email remains readable even if images are blocked by the recipient's mail client.
   - For all images, provide descriptive 'alt=""' attributes.
   - Use 'display: block; border: 0; outline: none; text-decoration: none;' on all <img> tags.
   - If image slices are used, keep each slice under 300KB (total assets under 2MB).
   - Wrap each clickable image slice in its own <a> anchor tag.

--------------------------------------------------------------------------------
# PART 3: SUPPORTED PERSONALIZATION VARIABLES (STRICT)
--------------------------------------------------------------------------------
The K SELECT platform supports the following 4 personalization placeholders ONLY:
- {{company_name}}   -> Replaced with recipient company name (e.g. 코스맥스, 아모레퍼시픽)
- {{contact_name}}   -> Replaced with recipient contact name or title (e.g. 김대표님, 마케팅 총괄)
- {{brand_name}}     -> Replaced with recipient brand name (e.g. 이니스프리)
- {{custom_message}} -> Replaced with customized account-level notes

CRITICAL INSTRUCTION:
Do NOT invent or use unsupported placeholders (e.g. do NOT use {{first_name}}, {{recipient_email}}, {{job_title}}, {{date}}, etc.).
Use the 4 supported placeholders naturally in the subject line, greeting, and body text.

--------------------------------------------------------------------------------
# PART 4: FOOTER & COMPLIANCE SEPARATION
--------------------------------------------------------------------------------
The K SELECT delivery engine automatically appends the official legal compliance footer, physical business address (23B Roland Ave., Mount Laurel, NJ 08054, USA), contact email (Contact@letusto.com), and cryptographically signed one-click unsubscribe links at dispatch time.

THEREFORE:
- Do NOT hardcode a second duplicate legal footer or fake unsubscribe link.
- Simply leave appropriate bottom breathing room (30px–40px) or include the placeholder comment:
  <!-- K_SELECT_FOOTER_PLACEHOLDER -->
  This prevents awkward duplicate footers and preserves strict anti-spam compliance.

--------------------------------------------------------------------------------
# PART 5: REQUIRED DELIVERABLES & OUTPUT FORMAT
--------------------------------------------------------------------------------
Please generate the complete K SELECT email package deliverables.

If your AI environment supports direct ZIP or file downloads, package them as:
email-package.zip
├── manifest.json   (Template metadata and variables)
├── email.html      (Complete email-safe HTML code)
├── email.txt       (Clean plain-text alternative)
├── links.json      (CTA link mapping)
└── README.md       (Rendering and design notes)

IF YOU CANNOT GENERATE A ZIP FILE DIRECTLY:
Provide the FULL, COMPLETE content of each file inside separate labeled markdown code blocks as follows:

\`\`\`json:manifest.json
{
  "templateName": "${brief.campaignTitle || "K SELECT Outreach"}",
  "version": "1.0.0",
  "format": "${brief.designFormat}",
  "variables": ["company_name", "contact_name", "brand_name", "custom_message"],
  "subject": "[Subject line with {{company_name}}]",
  "previewText": "[Preview text for inboxes]"
}
\`\`\`

\`\`\`html:email.html
<!-- Complete HTML markup following all table & inline CSS rules above -->
\`\`\`

\`\`\`text:email.txt
<!-- Complete plain-text equivalent for spam filter avoidance -->
\`\`\`

\`\`\`json:links.json
{
  "primary_cta": "${brief.primaryCtaUrl || "https://www.kselectnetwork.com/apply"}"
}
\`\`\`

Do not truncate code blocks. Provide full, copy-paste-ready deliverables ready for upload into K SELECT NETWORK.`;
}
