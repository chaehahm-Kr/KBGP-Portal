# MAN-I-DOC-001 — Reference Guide & Master Assets
## K SELECT Internal Operations: Manual Creation & Update SOP Reference Guide
### (참조 가이드, 마스터 디자인 시스템 규격 및 코드 매핑)

---

## 1. Master Design System Reference
- **Master Reference File**: `Manuals/MAN-B-BRAND-001_Brand-Policy/03_PUBLISHED/MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Application Scope**:
  - All official K SELECT manual PDF publications (`MAN-B-*`, `MAN-I-*`, `MAN-A-*`) MUST strictly comply with the visual, typography, card layout, and callout standards established in `MAN-B-BRAND-001`.
- **Design Tokens**:
  - Canvas Dark Background: `#09090B` (Zinc-950)
  - Card Containers: `#18181B` (Zinc-900), Border: `#27272A` (Zinc-800)
  - Brand Primary Accent: `#4F46E5` (Indigo-600)
  - Success State Accent: `#059669` (Emerald-600)
  - Warning State Accent: `#D97706` (Amber-600)
  - Danger State Accent: `#E11D48` (Rose-600)

---

## 2. Technical Codebase & Database Schema Mapping

| Reference Asset Name | Primary Code Location | Role & Description |
| :--- | :--- | :--- |
| `knowledge_items` Table | `supabase/migrations/0100_knowledge_schema.sql` | 지식 아이템 마스터 메타데이터 테이블 |
| `knowledge_versions` Table | `supabase/migrations/0100_knowledge_schema.sql` | 매뉴얼 버전 이력 및 변경 사유 관리 테이블 |
| `knowledge_manual_assets` Table | `supabase/migrations/0100_knowledge_schema.sql` | 바이너리 PDF 실물 자산 바인딩 테이블 |
| `knowledge_relations` Table | `supabase/migrations/0100_knowledge_schema.sql` | 포털 및 어드민 메뉴 딥링크 매핑 테이블 |
| `knowledge_topics` Table | `supabase/migrations/0100_knowledge_schema.sql` | 지식 허브 카테고리 및 모듈 매칭 테이블 |
| `knowledge_faqs` Table | `supabase/migrations/0115_knowledge_faqs.sql` | 공식 1:1 연계 FAQ 마스터 테이블 |
| Grounded Ask Engine | `lib/knowledge/ask-engine.ts` | 결정론적 Q&A 매칭 및 출처 인용 엔진 |
| In-Memory Fallback Store | `lib/knowledge/store.ts` | 무중단 Fallback 보장을 위한 `memoryFaqs` 배열 |
| Asset Serving Route | `app/api/admin/knowledge/asset/[id]/route.ts` | 인증된 세션 대상 바이너리 PDF 스트리밍 엔드포인트 |
| Brand Help Pages | `app/portal/help/` (`page.tsx`, `[slug]/`, `ask/`, `faqs/`) | 브랜드 포털 사용자 지식 허브 화면 |
| Admin Knowledge Hub | `app/admin/knowledge/` (`page.tsx`, `library/`, `[id]/`) | 본사 관리자 지식 관리 백오피스 화면 |

---

## 3. Automation QA Script Inventory

| Script Path | Purpose | Execution Timing |
| :--- | :--- | :--- |
| `scripts/readback-verify-physical-files.js` | 패키지 파일의 물리적 실재성 및 0바이트 파일 검사 | Package Creation 직후 (Stage 04) |
| `scripts/verify-screenshots-hash.js` | 스크린샷 11장의 100% Unique SHA-256 해시 검증 | Package QA (Gate 2) |
| `scripts/verify-[domain]-faqs-publish.js` | Supabase DB FAQ 90개 전수 무결성 및 검색 검증 | FAQ QA (Gate 5) |
| `scripts/capture-doc-001-screenshots.js` | Production 및 Internal UI 자동 캡처 스위트 | Package Creation (Stage 03) |
