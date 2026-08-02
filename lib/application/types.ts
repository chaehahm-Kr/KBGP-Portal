export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "assigned"
  | "under_review"
  | "info_requested"
  | "re_review"
  | "partial_approved"
  | "approved"
  | "on_hold"
  | "rejected"
  | "cancelled";

// 06_상태값정의.md 1번 신청 상태값
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "임시저장",
  submitted: "제출됨",
  assigned: "배정됨",
  under_review: "심사중",
  info_requested: "추가자료요청",
  re_review: "재검토중",
  partial_approved: "부분승인",
  approved: "승인",
  on_hold: "보류",
  rejected: "반려",
  cancelled: "취소",
};

export type ApplicationProductReviewStatus =
  | "pending"
  | "reviewing"
  | "info_requested"
  | "approved"
  | "on_hold"
  | "rejected";

// 06_상태값정의.md 2번 제품 심사 상태값
export const REVIEW_STATUS_LABEL: Record<ApplicationProductReviewStatus, string> = {
  pending: "검토대기",
  reviewing: "검토중",
  info_requested: "보완요청",
  approved: "승인",
  on_hold: "보류",
  rejected: "반려",
};

// 마케팅 사이트 자가진단 6문항과 동일(web/lib/content.ts eligibilityConditions).
// 08_주요화면과AC.md 화면 5: "참여 조건 자가진단 6개 항목 재확인 체크".
export const SELF_CHECK_ITEMS = [
  "리오더에도 안정적으로 재생산 · 공급이 가능한 생산 캐파를 갖추고 있습니다",
  "미국 상표권을 등록했거나 진행할 의지가 있고, 성분 · 라벨링 인증에 대응할 수 있습니다",
  "초도 테스트 물량 300개(오프라인 240 + 온라인 60)를 공급할 수 있습니다",
  "타 총판 · 이커머스와 중복 없이 공급 우선권을 제공할 수 있습니다",
  "목표 달성 시 마케팅 비용의 일부를 분담할 의지가 있습니다",
  "제품 이미지 · 사용법 · 루틴 등 판매용 콘텐츠를 제공할 수 있습니다",
] as const;
