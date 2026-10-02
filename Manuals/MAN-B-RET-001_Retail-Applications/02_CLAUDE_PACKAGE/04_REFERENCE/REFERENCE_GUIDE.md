# MAN-B-RET-001: Technical Reference & Data Dictionary

---

## 1. System Constants & Status Enums

### Application Status (`ApplicationStatus`)
```typescript
export type ApplicationStatus =
  | "draft"             // 임시저장
  | "submitted"         // 제출됨 / 접수
  | "assigned"          // 배정됨
  | "under_review"      // 심사중
  | "info_requested"    // 추가자료요청
  | "re_review"         // 재검토중
  | "partial_approved"  // 부분승인
  | "approved"          // 승인됨
  | "invitation_sent"   // 초대장 발송
  | "onboarding"        // 온보딩 진행중
  | "onboarded"         // 온보딩 완료
  | "on_hold"           // 보류
  | "rejected"          // 반려됨
  | "cancelled"         // 취소
  | "deleted";          // 삭제
```

### Product Review Status (`ApplicationProductReviewStatus`)
```typescript
export type ApplicationProductReviewStatus =
  | "pending"          // 검토대기
  | "reviewing"        // 검토중
  | "info_requested"   // 보완요청
  | "approved"         // 승인
  | "on_hold"          // 보류
  | "rejected";        // 반려
```

---

## 2. 6 Official Program Readiness Items Data Model

```typescript
export const OFFICIAL_READINESS_ITEMS = [
  {
    key: "stable_supply",
    title: "01 안정적인 생산 및 공급망 확보",
    desc: "현재 판매 중이거나 출시를 준비 중인 제품으로, 테스트 이후에도 안정적인 생산과 지속적인 공급이 가능합니다.",
  },
  {
    key: "us_regulatory_compliance",
    title: "02 미국 화장품 규제(MoCRA) 준수 및 FDA 등록 준비",
    desc: "미국 진출에 필요한 성분, 인증, 등록, 라벨링 및 통관 요건을 확인하고 필요한 보완 절차에 협력할 수 있습니다.",
  },
  {
    key: "initial_test_quantity",
    title: "03 초기 파트너십 테스트 물량 공급 의향",
    desc: "초기 시장 테스트를 위한 일정 수준의 테스트 물량 공급에 협력할 수 있습니다.",
  },
  {
    key: "north_america_distribution",
    title: "04 북미 온/오프라인 유통 및 가격 정책 동의",
    desc: "기존 유통 가격 및 판매 채널과 충돌 여부를 확인하고 북미 판매 정책에 협력할 수 있습니다.",
  },
  {
    key: "joint_marketing",
    title: "05 북미 현지 공동 마케팅 협력 의향",
    desc: "시장 테스트 이후 본격적인 판매 확대를 위해 상호 협의 기간과 범위 내에서 공동 마케팅 활동에 참여할 의향이 있습니다.",
  },
  {
    key: "sales_content_support",
    title: "06 상세 페이지 및 현지화 마케팅 콘텐츠 지원",
    desc: "제품 이미지, 영상, 사용 방법, 상세 정보 등 판매에 필요한 콘텐츠를 제공하거나 제작에 협력할 수 있습니다.",
  },
] as const;
```

---

## 3. Role-Based Access Control (RBAC) Matrix

| Operation / Feature | Portal User (`application:read`) | Portal Admin (`application:write`) | Staff / MD Reviewer | Super Admin |
| :--- | :---: | :---: | :---: | :---: |
| **View Applications List** | ✅ (Own Company) | ✅ (Own Company) | ✅ (All) | ✅ (All) |
| **Create New Draft Application** | ❌ | ✅ | ❌ (Internal only) | ✅ |
| **Edit Draft & Select Products** | ❌ | ✅ | ❌ | ✅ |
| **Submit Draft Application** | ❌ | ✅ | ❌ | ✅ |
| **Reply to Info Request & Upload** | ❌ | ✅ | ❌ | ✅ |
| **Review Product (Approve/Reject/Hold)** | ❌ | ❌ | ✅ (Assigned MD) | ✅ |
| **Create Info Request** | ❌ | ❌ | ✅ (Assigned MD) | ✅ |
| **Delete Application (Soft Delete)** | ❌ | ❌ | ❌ | ✅ |

---

## 4. Database Entities & Schemas

### `applications`
- `id`: UUID (PK)
- `company_id`: UUID (FK $\rightarrow$ `companies.id`, NOT NULL)
- `application_number`: Text (Unique, generated via RPC)
- `status`: `ApplicationStatus` (Default: `draft`)
- `motivation_note`: Text
- `eligibility_responses`: JSONB (Array of `{ itemKey, response }`)
- `self_check_answers`: JSONB (Array of booleans)
- `submitted_at`: Timestamptz
- `created_by`: UUID (FK $\rightarrow$ `company_users.id`)
- `created_at`: Timestamptz
- `updated_at`: Timestamptz

### `application_products`
- `id`: UUID (PK)
- `application_id`: UUID (FK $\rightarrow$ `applications.id`, Cascade Delete)
- `product_id`: UUID (FK $\rightarrow$ `products.id`, Cascade Delete)
- `company_id`: UUID (FK $\rightarrow$ `companies.id`)
- `review_status`: `ApplicationProductReviewStatus` (Default: `pending`)
- `review_reason`: Text (Mandatory if `rejected` or `on_hold`)
- `reviewer_id`: UUID (FK $\rightarrow$ `staff_members.id`)
- `reviewed_at`: Timestamptz
- `created_at`: Timestamptz

### `additional_info_requests`
- `id`: UUID (PK)
- `application_id`: UUID (FK $\rightarrow$ `applications.id`)
- `company_id`: UUID (FK $\rightarrow$ `companies.id`)
- `product_id`: UUID (FK $\rightarrow$ `products.id`, Nullable)
- `request_content`: Text (NOT NULL)
- `requested_by`: UUID (FK $\rightarrow$ `staff_members.id`)
- `requested_at`: Timestamptz
- `reply_content`: Text
- `reply_attachment_path`: Text (Storage bucket path in `company-uploads`)
- `status`: Text (`pending` | `replied`)
- `replied_at`: Timestamptz
- `reply_due_at`: Timestamptz
