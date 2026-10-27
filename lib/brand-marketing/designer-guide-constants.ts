/**
 * Brand Marketing Phase 2 — Designer Guide & AI Prompts Constants
 * Task ID: ADM-BSRC-006-R1-ADD1
 * Standards: DEPLOY-STD-001, AGENTS.md Rule 27
 */

export const DEFAULT_IMAGE_DESIGN_PROMPT = `Create a professional K SELECT NETWORK B2B K-Beauty partnership outreach email.

Audience:
Korean cosmetic manufacturers and brand owners.

Goal:
Introduce the Letusto partnership model for US market development, retail distribution and online sales.

Deliver an email-ready visual design with:
- Approx. 600px email width
- Mobile-friendly layout
- Clear K SELECT branding
- Strong headline and concise copy
- One primary CTA
- Clearly marked clickable image regions
- Image slices and link mapping
- Hosted image/asset requirements
- Real HTML personalization text locations
- Plain-text alternative
- Landing page URL placeholders

Keep all content professionally editable.
Do not invent business claims or metrics.`;

export const DEFAULT_HTML_DESIGN_PROMPT = `Create a complete responsive HTML email for K SELECT NETWORK brand outreach.

Provide:
- Email-client-compatible HTML
- Approximately 600px primary layout
- Inline CSS/table-based layout as needed
- Subject and Preview Text
- HTML and plain-text versions
- Hosted image references
- Clearly labeled CTA button and HTTPS URL
- Supported personalization placeholders:
  {{company_name}}, {{contact_name}}, {{brand_name}}, {{custom_message}}
- Required footer and unsubscribe placeholder
- Desktop/mobile rendering guidance

No JavaScript or external scripts.
Do not invent company information or results.`;

export interface DesignerGuideSection {
  title: string;
  badge?: string;
  items: { subtitle: string; description: string }[];
}

export const DESIGNER_GUIDE_SECTIONS: DesignerGuideSection[] = [
  {
    title: "1. 이메일 캔버스 구조 (Email Canvas Structure)",
    badge: "Core Layout",
    items: [
      {
        subtitle: "표준 캔버스 너비 (600px Standard)",
        description: "데스크톱 및 태블릿 이메일 클라이언트(Outlook, Apple Mail, Gmail)에서 가장 왜곡 없이 렌더링되는 표준 캔버스 너비는 600px입니다. 모바일 기기에서는 375px~414px 뷰포트에 맞추어 유연하게 축소되거나 스택되어야 합니다.",
      },
      {
        subtitle: "브랜딩 및 헤더 영역",
        description: "상단에 공식 K SELECT NETWORK 로고와 'GLOBAL BRAND SOURCING & DISTRIBUTION HUB' 서브타이틀을 명확하게 배치하여 신뢰성을 확보합니다.",
      },
      {
        subtitle: "가독성 및 타이포그래피",
        description: "최소 본문 폰트 크기 14px~16px, 제목 20px~28px 권장. 배경과 텍스트 간 최소 명도 대비 4.5:1 이상을 준수하여 접근성을 보장합니다.",
      },
      {
        subtitle: "단일 주요 행동 유도 (Primary CTA)",
        description: "수신자가 다음 행동(파트너십 안내서 확인, 상담 신청 등)을 즉시 취할 수 있도록 시각적으로 두드러지는 명확한 메인 CTA 버튼을 중앙 또는 핵심 단락 바로 아래에 배치합니다.",
      },
      {
        subtitle: "법적 고지 및 수신 거부 푸터",
        description: "하단에 발신 주체(Letusto Inc. / K SELECT NETWORK), 본사 정보, 고객지원 이메일(support@kselectnetwork.com) 및 수신 거부 안내가 반드시 포함되어야 합니다.",
      },
    ],
  },
  {
    title: "2. 이미지 템플릿 제작 가이드 (Image Slicing & Link Mapping)",
    badge: "Image Format",
    items: [
      {
        subtitle: "슬라이스 분할 (Image Slices)",
        description: "전체 비주얼을 하나의 거대한 단일 이미지로 만들지 마십시오. 헤더, 핵심 제안, 상품 갤러리, CTA 영역 등을 수평 슬라이스(높이 200px~500px 권장)로 분할하여 독립된 이미지 파일로 제공해야 합니다.",
      },
      {
        subtitle: "클릭 영역 매핑 (100% 클라이언트 호환성)",
        description: "이메일 클라이언트는 CSS absolute 오버레이나 HTML imagemap 태그를 지원하지 않거나 보안상 차단합니다. 각 분할된 이미지 슬라이스마다 독립된 <a> 태그를 래핑하는 슬라이스 앵커 방식을 사용해야 Outlook과 Gmail에서 완벽히 작동합니다.",
      },
      {
        subtitle: "개인화 텍스트 분리 (동적 텍스트 금지)",
        description: "수신사명({{company_name}}), 담당자명({{contact_name}})과 같은 동적 개인화 텍스트는 이미지 안에 픽셀로 영구 합성하지 마십시오. 이미지는 비주얼/그래픽을 담당하고, 개인화는 HTML 텍스트 또는 맞춤 메시지 블록으로 처리합니다.",
      },
      {
        subtitle: "대체 텍스트 (Alt Text) 필수",
        description: "수신자 이메일 클라이언트가 이미지 자동 표시를 차단한 상태에서도 제안 요지를 파악할 수 있도록 각 슬라이스마다 핵심 내용을 요약한 대체 텍스트(Alt Text)를 작성해야 합니다.",
      },
      {
        subtitle: "자산 최적화 (WebP / PNG / JPG)",
        description: "이메일 로딩 지연 및 스팸 점수 상승을 방지하기 위해 각 슬라이스 파일 용량은 300KB 이하(전체 합계 2MB 미만)로 압축 최적화해야 합니다.",
      },
    ],
  },
  {
    title: "3. HTML 템플릿 마크업 가이드 (Email-Safe HTML Standards)",
    badge: "HTML Format",
    items: [
      {
        subtitle: "테이블 기반 레이아웃 (Table-Based Markup)",
        description: "Flexbox나 CSS Grid는 대부분의 데스크톱 Outlook 버전(Word 렌더링 엔진 기반)에서 지원되지 않습니다. 반드시 <table role='presentation' border='0' cellpadding='0' cellspacing='0'> 구조를 기반으로 작성하십시오.",
      },
      {
        subtitle: "인라인 CSS 스타일링",
        description: "일부 웹메일 서비스(구형 웹메일 및 모바일 앱)는 <style> 태그를 제거합니다. 모든 핵심 시각 속성(배경색, 폰트 크기, 마진, 패딩)은 인라인 style='' 속성으로 작성하십시오.",
      },
      {
        subtitle: "보안 위협 요소 제거 (Zero Scripts / No Iframes)",
        description: "<script>, <object>, <embed>, <iframe>, onclick/onload 이벤트 핸들러 및 javascript: 프로토콜 링크는 엄격히 금지되며 플랫폼 업로드 시 자동으로 완전 제거됩니다.",
      },
      {
        subtitle: "호환 개인화 변수 목록",
        description: "HTML 마크업 내에서 지원되는 개인화 플레이스홀더: {{company_name}} (회사명), {{contact_name}} (담당자명), {{brand_name}} (브랜드명), {{custom_message}} (맞춤형 제안 메시지).",
      },
      {
        subtitle: "순수 텍스트 버전 동봉 (Plain-Text Alternative)",
        description: "스팸 필터 회피 및 스마트워치/스크린리더 호환성을 위해 HTML 본문과 1:1 대응되는 깔끔한 순수 텍스트 버전이 함께 제공되어야 합니다.",
      },
    ],
  },
  {
    title: "4. 외주 디자이너 최종 납품 패키지 체크리스트",
    badge: "Delivery Checklist",
    items: [
      {
        subtitle: "1) 이미지 템플릿 납품 시",
        description: "순서대로 정렬된 번호가 매겨진 슬라이스 이미지 파일 (예: slice_01_hero.png, slice_02_value.png...), 각 슬라이스별 클릭 이동 HTTPS URL 링크 매핑표, 각 슬라이스별 대체 텍스트(Alt Text) 목록, 전체 순수 텍스트 대체본.",
      },
      {
        subtitle: "2) HTML 템플릿 납품 시",
        description: "단일 통합 HTML 파일 (.html), 영구 호스팅된 HTTPS 이미지 절대 경로 (또는 플랫폼 업로드용 에셋), 이메일 제목(Subject) 및 사전보기 텍스트(Preview Text), 지원 변수 포함 확인표.",
      },
      {
        subtitle: "3) 링크 보안 규격",
        description: "모든 외부 랜딩 링크는 유효한 SSL 인증서가 적용된 https:// 프로토콜이어야 하며, 허용되지 않은 비정상 리다이렉트나 HTTP 프로토콜은 사용할 수 없습니다.",
      },
    ],
  },
];
