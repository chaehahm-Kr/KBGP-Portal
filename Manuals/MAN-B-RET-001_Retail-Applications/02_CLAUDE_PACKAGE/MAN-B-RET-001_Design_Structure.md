# MAN-B-RET-001: Design Structure & Page Layout Specification

---

## Document Overview
- **Manual ID**: `MAN-B-RET-001`
- **Manual Title**: Brand Portal Retail Placement & Application Guide (입점 신청 및 리테일 네트워크 가이드)
- **Target Audience**: Brand Users, Brand Admins, Operations Managers
- **Visual Reference**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Total Estimated Pages**: 6 Pages (A4 Portrait)

---

## Page-by-Page Layout Blueprint

### Page 1: 1. 개요 및 파트너십 프로세스
- **Header Section**:
  - Document Title: `입점 신청 및 리테일 네트워크 가이드 (MAN-B-RET-001)`
  - Metadata block: Audience: `Brand Portal`, Category: `입점 & 리테일 네트워크`, Version: `v1.0`
- **Section 1.1: K SELECT Retail Network 입점 구조**:
  - Purpose of the application module
  - Key benefits of North American B2B retail matching
- **Section 1.2: 신청 전 필수 사전 준비**:
  - Brand Registration (`MAN-B-BRAND-001`)
  - Product Catalog & Specs (`MAN-B-PROD-001`)
  - US MoCRA / FDA Compliance Basics (`MAN-B-REG-001`)
- **Process Diagram**:
  - Horizontal 4-step sequence: `1. 상품 선택` $\rightarrow$ `2. 준비사항 응답` $\rightarrow$ `3. 제출 & MD 심사` $\rightarrow$ `4. 승인 및 입점`

---

### Page 2: 2. 신청 현황 대시보드 (`/portal/applications`)
- **Section 2.1: 신청 목록 및 대시보드 인터페이스**:
  - Main Screenshot Placement: `SCR-B-RET-001.png` (Desktop 1440×900)
  - Callout 1: '새 신청서 작성' 액션 버튼 (권한: `application:write`)
  - Callout 2: 신청번호 및 임시저장 링크
  - Callout 3: 상태 뱃지 체계
  - Callout 4: 포함 제품 수 및 최종 변경일
- **Section 2.2: 신청 상태 뱃지 및 색상 기준 표**:
  - Status Table (Status key, Korean label, Color token, Meaning)
- **Section 2.3: 모바일 반응형 뷰**:
  - Mobile Screenshot Placement: `SCR-B-RET-009.png` (Mobile 390×844)

---

### Page 3: 3. 신규 입점 신청서 작성 (Draft Mode)
- **Section 3.1: 드래프트 생성 및 다중 브랜드 제품 선택**:
  - Screenshot Placement: `SCR-B-RET-002.png`
  - Multi-brand grouping logic and product checkbox controls
- **Section 3.2: 6대 프로그램 참여 준비 사항 (Readiness Criteria)**:
  - Screenshot Placement: `SCR-B-RET-003.png`
  - 6 Official Criteria Table (Stable supply, MoCRA/FDA, Initial test quantity, North America distribution, Joint marketing, Sales content support)
  - Explanation of `🟢 진행 가능` vs `🟡 협의 필요`
- **Section 3.3: 임시저장 및 제출 유효성 검증**:
  - Screenshot Placement: `SCR-B-RET-004.png`
  - Validation rules: Minimum 1 product required; Auto-number generation via RPC on submit

---

### Page 4: 4. 실시간 심사 현황 및 타임라인 모니터링
- **Section 4.1: 신청서 상세 헤더 및 상태**:
  - Screenshot Placement: `SCR-B-RET-005.png`
  - Application Number, Submission Timestamp, and In-Review Badges
- **Section 4.2: 제품별 개별 심사 상태 및 실시간 타임라인**:
  - Screenshot Placement: `SCR-B-RET-007.png`
  - Granular product review table
  - Timeline log structure (Dot indicator, Status label, Timestamp, Reviewer reason `↳ 사유: ...`)
- **Section 4.3: 자동 상태 집계 엔진 (`computeAggregatedStatus`)**:
  - Logic explanation: All approved $\rightarrow$ Approved, All rejected $\rightarrow$ Rejected, Mixed $\rightarrow$ Partial Approved / On Hold

---

### Page 5: 5. 추가 자료 요청(Info Request) 대응 및 문서 제출
- **Section 5.1: MD 추가 자료 요청 알림 패널**:
  - Screenshot Placement: `SCR-B-RET-006.png`
  - Amber alert panel, urgent pulse dot, request content, and deadline badge
- **Section 5.2: 회신 작성 및 증빙 서류 업로드**:
  - Textarea requirements and supported file formats (PDF, PNG, JPG, WEBP, CSV, XLSX)
  - Secure storage upload pipeline
- **Section 5.3: 재검토(`re_review`) 전환 및 후속 프로세스**:
  - Request status update to `replied`, application status update to `re_review`, and automated MD notifications

---

### Page 6: 6. 사이드바 평가 요약 & 결과 후속 절차 및 FAQ
- **Section 6.1: 참여 조건 자가진단 및 준비사항 요약 카드**:
  - Screenshot Placement: `SCR-B-RET-008.png`
  - Review of the right sidebar cards
- **Section 6.2: 심사 결과별 후속 조치**:
  - Approved (`approved`) / Partial Approved (`partial_approved`) $\rightarrow$ 리테일 네트워크 후속 협의 및 `MAN-B-ORD-001` 독립적 발주 연계
  - On Hold (`on_hold`) $\rightarrow$ MD 추가 조율
  - Rejected (`rejected`) $\rightarrow$ 사유 확인 및 스펙 보완
- **Section 6.3: 자주 묻는 질문 (FAQ 7선)**:
  - 7 Grounded Q&A items covering multi-brand applications, post-submission editing, readiness options, partial approval, info request replies, rejection reasons, and next steps.
