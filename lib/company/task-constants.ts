// K-Select Network 6대 담당 업무 정의 상수 고정 (Next.js "use server" 제약 우회를 위한 독립 파일)

export const TASK_DEFINITIONS = [
  { code: "company_apply", label: "회사·신청", desc: "회사 정보, 브랜드 등록, 입점 신청, 보완 및 심사 관련 업무" },
  { code: "contract", label: "계약", desc: "계약서 확인, 계약 조건 검토, 서명 및 갱신 관련 업무" },
  { code: "product_cert", label: "제품·콘텐츠·인증", desc: "제품 정보, 콘텐츠, 이미지, 성분, 인증 및 규제 서류 관련 업무" },
  { code: "pricing_quote", label: "가격·견적", desc: "공급가격, 원가, 견적, 가격 검토 및 승인 관련 업무" },
  { code: "logistics_inventory", label: "발주·물류·재고", desc: "발주, 생산, 선적, 입고, 물류 및 재고 관련 업무" },
  { code: "settlement_inquiry", label: "정산·문의", desc: "인보이스, 지급, 정산, 일반 문의 및 이슈 대응 업무" },
] as const;

export type TaskCode = typeof TASK_DEFINITIONS[number]["code"];
