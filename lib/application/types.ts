export type ApplicationPartnerType = "brand" | "retailer";
export type ApplicationEntryMode = "public_application" | "admin_invitation";

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "assigned"
  | "under_review"
  | "info_requested"
  | "re_review"
  | "partial_approved"
  | "approved"
  | "invitation_sent"
  | "onboarding"
  | "onboarded"
  | "on_hold"
  | "rejected"
  | "cancelled"
  | "deleted";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "임시저장",
  submitted: "제출됨 / 접수",
  assigned: "배정됨",
  under_review: "심사중",
  info_requested: "추가자료요청",
  re_review: "재검토중",
  partial_approved: "부분승인",
  approved: "승인됨",
  invitation_sent: "초대장 발송",
  onboarding: "온보딩 진행중",
  onboarded: "온보딩 완료",
  on_hold: "보류",
  rejected: "반려됨",
  cancelled: "취소",
  deleted: "삭제",
};

export const PARTNER_TYPE_LABEL: Record<ApplicationPartnerType, { ko: string; en: string }> = {
  brand: { ko: "브랜드 파트너", en: "Brand Partner" },
  retailer: { ko: "리테일러 파트너", en: "Retailer Partner" },
};

export const ENTRY_MODE_LABEL: Record<ApplicationEntryMode, { ko: string; en: string }> = {
  public_application: { ko: "공개 신청", en: "Public Application" },
  admin_invitation: { ko: "어드민 직접 초대", en: "Admin Invitation" },
};

export type ApplicationProductReviewStatus =
  | "pending"
  | "reviewing"
  | "info_requested"
  | "approved"
  | "on_hold"
  | "rejected";

export const REVIEW_STATUS_LABEL: Record<ApplicationProductReviewStatus, string> = {
  pending: "검토대기",
  reviewing: "검토중",
  info_requested: "보완요청",
  approved: "승인",
  on_hold: "보류",
  rejected: "반려",
};

export const SELF_CHECK_ITEMS = [
  "리오더에도 안정적으로 재생산 · 공급이 가능한 생산 캐파를 갖추고 있습니다",
  "미국 상표권을 등록했거나 진행할 의지가 있고, 성분 · 라벨링 인증에 대응할 수 있습니다",
  "초도 테스트 물량 300개(오프라인 240 + 온라인 60)를 공급할 수 있습니다",
  "타 총판 · 이커머스와 중복 없이 공급 우선권을 제공할 수 있습니다",
  "목표 달성 시 마케팅 비용의 일부를 분담할 의지가 있습니다",
  "제품 이미지 · 사용법 · 루틴 등 판매용 콘텐츠를 제공할 수 있습니다",
] as const;

export interface ReadinessResponseItem {
  itemKey: string;
  response: "available" | "discussion_required";
}

export const OFFICIAL_READINESS_ITEMS = [
  {
    key: "stable_supply",
    title: "01 안정적인 생산 및 공급망 확보",
    label: "안정적인 생산 및 공급망 확보",
    desc: "현재 판매 중이거나 출시를 준비 중인 제품으로, 테스트 이후에도 안정적인 생산과 지속적인 공급이 가능합니다.",
  },
  {
    key: "us_regulatory_compliance",
    title: "02 미국 화장품 규제(MoCRA) 준수 및 FDA 등록 준비",
    label: "미국 화장품 규제(MoCRA) 준수 및 FDA 등록 준비",
    desc: "미국 진출에 필요한 성분, 인증, 등록, 라벨링 및 통관 요건을 확인하고 필요한 보완 절차에 협력할 수 있습니다.",
  },
  {
    key: "initial_test_quantity",
    title: "03 초기 파트너십 테스트 물량 공급 의향",
    label: "초기 파트너십 테스트 물량 공급 의향",
    desc: "초기 시장 테스트를 위한 일정 수준의 테스트 물량 공급에 협력할 수 있습니다.",
  },
  {
    key: "north_america_distribution",
    title: "04 북미 온/오프라인 유통 및 가격 정책 동의",
    label: "북미 온/오프라인 유통 및 가격 정책 동의",
    desc: "기존 유통 가격 및 판매 채널과 충돌 여부를 확인하고 북미 판매 정책에 협력할 수 있습니다.",
  },
  {
    key: "joint_marketing",
    title: "05 북미 현지 공동 마케팅 협력 의향",
    label: "북미 현지 공동 마케팅 협력 의향",
    desc: "시장 테스트 이후 본격적인 판매 확대를 위해 상호 협의 기간과 범위 내에서 공동 마케팅 활동에 참여할 의향이 있습니다.",
  },
  {
    key: "sales_content_support",
    title: "06 상세 페이지 및 현지화 마케팅 콘텐츠 지원",
    label: "상세 페이지 및 현지화 마케팅 콘텐츠 지원",
    desc: "제품 이미지, 영상, 사용 방법, 상세 정보 등 판매에 필요한 콘텐츠를 제공하거나 제작에 협력할 수 있습니다.",
  },
] as const;
