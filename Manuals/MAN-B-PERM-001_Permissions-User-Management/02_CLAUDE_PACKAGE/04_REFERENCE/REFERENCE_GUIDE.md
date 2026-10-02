# MAN-B-PERM-001: Technical Reference & Data Dictionary
## Permissions & User Management (사용자, 역할 및 권한 관리)

---

## 1. System Constants & TypeScript Definitions

### Database Membership Role (`CompanyRole`)
```typescript
export type CompanyRole = "company_admin" | "company_staff";
```

### Brand Portal Role Presets (`BrandPortalRole`)
```typescript
export type BrandPortalRole = "restricted" | "viewer" | "staff" | "manager" | "admin";
```

### 4 ACL Access Levels (`AclLevel`)
```typescript
export type AclLevel = "none" | "read" | "write" | "manage";

export const ACL_LEVEL_NUMERIC: Record<AclLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  manage: 3,
};
```

### 9 ACL Menu Categories (`AclCategory`)
```typescript
export type AclCategory =
  | "application"    // 입점 신청서
  | "brands"         // 브랜드 관리
  | "products"       // 제품 관리
  | "orders"         // 주문 관리
  | "finance"        // 정산 / 인보이스
  | "support"        // 문의 지원
  | "company_info"   // 회사 기본 정보
  | "bank_info"      // 송금 계좌 정보
  | "agreements";    // 계약 및 문서
```

### 6 Operational Task Definitions (`TASK_DEFINITIONS`)
```typescript
export const TASK_DEFINITIONS = [
  { code: "company_apply", label: "회사·신청", desc: "회사 정보, 브랜드 등록, 입점 신청, 보완 및 심사 관련 업무" },
  { code: "contract", label: "계약", desc: "계약서 확인, 계약 조건 검토, 서명 및 갱신 관련 업무" },
  { code: "product_cert", label: "제품·콘텐츠·인증", desc: "제품 정보, 콘텐츠, 이미지, 성분, 인증 및 규제 서류 관련 업무" },
  { code: "pricing_quote", label: "가격·견적", desc: "공급가격, 원가, 견적, 가격 검토 및 승인 관련 업무" },
  { code: "logistics_inventory", label: "발주·물류·재고", desc: "발주, 생산, 선적, 입고, 물류 및 재고 관련 업무" },
  { code: "settlement_inquiry", label: "정산·문의", desc: "인보이스, 지급, 정산, 일반 문의 및 이슈 대응 업무" },
] as const;
```

---

## 2. Password Security Policy

```text
- 최소 길이: 8자 이상
- 문자 조합 필수 규칙:
  1. 영문 대문자 (A-Z) 최소 1자
  2. 영문 소문자 (a-z) 최소 1자
  3. 숫자 (0-9) 최소 1자
  4. 특수문자 (!@#$%^&* 등) 최소 1자
- 유효기간: 초청 링크 7일간 유효
```

---

## 3. Database Entities & Schemas

### `public.company_users`
- `id`: `uuid` (PK, FK $\rightarrow$ `profiles.id`)
- `company_id`: `uuid` (FK $\rightarrow$ `companies.id`, NOT NULL)
- `name`: `text` (NOT NULL)
- `english_name`: `text` (Nullable)
- `email`: `text` (NOT NULL)
- `company_role`: `text` (`company_admin` | `company_staff`)
- `status`: `text` (`invited` | `active` | `suspended`)
- `invited_by`: `uuid` (Nullable, FK $\rightarrow$ `profiles.id`)
- `invited_at`: `timestamptz` (Nullable)
- `joined_at`: `timestamptz` (Nullable)
- `title`: `text` (Nullable)
- `position`: `text` (Nullable)
- `phone`: `text` (Nullable)
- `is_primary`: `boolean` (Default: `false`)
- `permissions`: `jsonb` (Default: `'{}'::jsonb`)
- `created_at`: `timestamptz` (Default: `now()`)

### `public.company_task_assignments`
- `company_id`: `uuid` (PK 1/3, FK $\rightarrow$ `companies.id`)
- `user_id`: `uuid` (PK 2/3, FK $\rightarrow$ `company_users.id`)
- `task_code`: `text` (PK 3/3, CHECK in 6 task codes)
- `is_primary`: `boolean` (Default: `false`)
- `email_notify`: `boolean` (Default: `false`)
- `updated_at`: `timestamptz` (Default: `now()`)
- `updated_by`: `uuid` (Nullable, FK $\rightarrow$ `profiles.id`)
- `updated_path`: `text` (`portal` | `admin`)

---
*End of REFERENCE_GUIDE.md*
