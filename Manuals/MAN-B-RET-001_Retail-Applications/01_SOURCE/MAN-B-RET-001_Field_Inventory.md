# MAN-B-RET-001: Field Inventory & UI Component Specification

---

## 1. Applications List Screen (`/portal/applications`)

### A. Header & Action Controls
| UI Element | Type | Permission / Condition | Description / Logic |
| :--- | :--- | :--- | :--- |
| **Page Title** | Typography (`h1`) | Public to module users | `입점 신청 현황` |
| **Subtitle** | Typography (`p`) | Public to module users | `제출하신 K SELECT NETWORK 참가 신청서 목록 및 상태를 확인합니다.` |
| **New Application Button** | Button (`<button type="submit">`) | `hasPortalPermission("application", "write")` | Calls `createDraftApplication()`, inserts blank row, redirects to draft workspace. |

### B. Applications Summary Table
| Column Name | Data Field | Display Format | Interaction / UI Rule |
| :--- | :--- | :--- | :--- |
| **신청 번호** | `application_number` | Text (Bold) | If `application_number` is null, displays `(임시저장 상태)`. Clickable link to `/portal/applications/[id]`. |
| **신청 상태** | `status` | Badge Pill | Colored status badge according to `APPLICATION_STATUS_LABEL`: <br/>- `approved`: Emerald (`bg-emerald-50 text-emerald-700`)<br/>- `rejected`: Rose (`bg-rose-50 text-rose-700`)<br/>- `info_requested`: Amber (`bg-amber-50 text-amber-700`)<br/>- `under_review`: Blue (`bg-blue-50 text-blue-700`)<br/>- `draft`: Zinc (`bg-zinc-100 text-zinc-600`) |
| **포함 제품 수** | Count of `application_products` | Number + "개" | Aggregate count of products linked to this application. |
| **최종 변경일** | `submitted_at` or `created_at` | Date string (`YYYY. M. D.`) | Formatted via `toLocaleDateString("ko-KR")`. |
| **Empty State** | Text container | Triggered when `applications.length === 0` | Displays: `아직 등록된 입점 신청서가 존재하지 않습니다. 상단의 '새 신청서 작성'을 클릭해 진행해 주세요.` |

---

## 2. Application Draft Workspace (`/portal/applications/[id]` — Status: `draft`)

### A. Product Picker Section
| Field / Control | Input Type | Required | Options / Validation | Backend Column |
| :--- | :--- | :--- | :--- | :--- |
| **Brand Group Title** | Label (`<p>`) | Read-only | Grouped dynamically by `brandName`. | `brands.name` |
| **Product Checkbox** | Checkbox (`productIds`) | Yes (Min 1 product for submit) | Value = `product.id`. Checked state saved into junction table `application_products`. | `application_products.product_id` |
| **Empty Product Alert** | Notice Text | Triggered when `products.length === 0` | Displays: `등록된 제품이 없습니다. 먼저 제품을 등록해주세요.` | N/A |

### B. Official Program Readiness Evaluation (6 Standards)
| Standard Key | Question Title & Description | Options | Default Value | Backend Column |
| :--- | :--- | :--- | :--- | :--- |
| `stable_supply` | **01 안정적인 생산 및 공급망 확보**<br/>현재 판매 중이거나 출시를 준비 중인 제품으로, 테스트 이후에도 안정적인 생산과 지속적인 공급이 가능합니다. | Radio: `available` (🟢 진행 가능) / `discussion_required` (🟡 협의 필요) | `available` | `applications.eligibility_responses` |
| `us_regulatory_compliance` | **02 미국 화장품 규제(MoCRA) 준수 및 FDA 등록 준비**<br/>미국 진출에 필요한 성분, 인증, 등록, 라벨링 및 통관 요건을 확인하고 필요한 보완 절차에 협력할 수 있습니다. | Radio: `available` (🟢 진행 가능) / `discussion_required` (🟡 협의 필요) | `available` | `applications.eligibility_responses` |
| `initial_test_quantity` | **03 초기 파트너십 테스트 물량 공급 의향**<br/>초기 시장 테스트를 위한 일정 수준의 테스트 물량 공급에 협력할 수 있습니다. | Radio: `available` (🟢 진행 가능) / `discussion_required` (🟡 협의 필요) | `available` | `applications.eligibility_responses` |
| `north_america_distribution` | **04 북미 온/오프라인 유통 및 가격 정책 동의**<br/>기존 유통 가격 및 판매 채널과 충돌 여부를 확인하고 북미 판매 정책에 협력할 수 있습니다. | Radio: `available` (🟢 진행 가능) / `discussion_required` (🟡 협의 필요) | `available` | `applications.eligibility_responses` |
| `joint_marketing` | **05 북미 현지 공동 마케팅 협력 의향**<br/>시장 테스트 이후 본격적인 판매 확대를 위해 상호 협의 기간과 범위 내에서 공동 마케팅 활동에 참여할 의향이 있습니다. | Radio: `available` (🟢 진행 가능) / `discussion_required` (🟡 협의 필요) | `available` | `applications.eligibility_responses` |
| `sales_content_support` | **06 상세 페이지 및 현지화 마케팅 콘텐츠 지원**<br/>제품 이미지, 영상, 사용 방법, 상세 정보 등 판매에 필요한 콘텐츠를 제공하거나 제작에 협력할 수 있습니다. | Radio: `available` (🟢 진행 가능) / `discussion_required` (🟡 협의 필요) | `available` | `applications.eligibility_responses` |

### C. Draft Actions & Buttons
| Button | Type | Behavior | Error Handling |
| :--- | :--- | :--- | :--- |
| **임시저장** | Submit (`saveDraftApplication`) | Saves selected product IDs and 6 readiness answers without locking the application. | Displays inline error if update fails. |
| **신청서 제출** | Submit (`submitApplication`) | 1. Verifies `productCount >= 1`<br/>2. Generates official application number via RPC `generate_application_number`<br/>3. Updates status to `submitted`<br/>4. Dispatches email notifications. | If 0 products selected: `제품을 최소 1개 선택해야 제출할 수 있습니다.` |

---

## 3. Application Detail & Review Screen (`/portal/applications/[id]` — Status: Submitted/Under Review/Approved/Rejected)

### A. Application Status Header
| Element | Field | Format / Rules |
| :--- | :--- | :--- |
| **Header Label** | Static | `APPLICATION NUMBER` |
| **Application Number** | `application.application_number` | e.g. `APP-20261001-0001` (Font: Mono Bold) |
| **Submission Date** | `application.submitted_at` | `제출 일자: YYYY. MM. DD. HH:mm:ss` |
| **Overall Status Badge** | `application.status` | Styled status pill (`draft`, `submitted`, `assigned`, `under_review`, `info_requested`, `re_review`, `partial_approved`, `approved`, `on_hold`, `rejected`) |

### B. Additional Info Request Action Panel (Active when `pendingRequests.length > 0`)
| Field / Component | Type | Validation / Behavior |
| :--- | :--- | :--- |
| **Urgent Notice Header** | Pulse Dot + Text | `추가 자료 제출이 필요합니다` (Amber theme) |
| **Request Content** | Text Display | Displays MD prompt (`[요청 사항] {request.request_content}`) |
| **Reply Due Date** | Badge Pill | Displays deadline: `회신 기한: YYYY년 M월 D일까지` |
| **Reply Textarea** | Textarea (`replyContent`) | Required, min 1 char, placeholder: `회신 내용을 입력해주세요` |
| **Attachment Upload** | File Input (`attachment`) | Supported MIME: PDF, JPEG, PNG, WEBP, CSV, XLSX. File stored at `company-uploads/{companyId}/applications/...` |
| **Submit Reply Button** | Button (`replyToInfoRequest`) | Updates request to `replied`, resets application to `re_review`, notifies MD. |

### C. Granular Product Review & Audit Timeline Table
| Column / Sub-element | Field | Behavior / Display Rules |
| :--- | :--- | :--- |
| **Product Name** | `products.name` | Bold title of the submitted product. |
| **Review Status** | `application_products.review_status` | Status text colored by outcome:<br/>- `approved` (승인): Green<br/>- `rejected` (반려): Red<br/>- `under_review` (검토중): Blue<br/>- `info_requested` (보완요청): Amber<br/>- `pending` (검토대기): Zinc |
| **Timeline Event** | `activity_logs` | Vertical timeline showing chronological log events: <br/>- Dot indicator (Green for latest, Zinc for past)<br/>- Status Label (e.g. `[접수 완료]`, `[심사 진행 중]`, `[보완 요청]`, `[심사 승인]`)<br/>- Timestamp (`YYYY. MM. DD. HH:mm:ss`)<br/>- Reviewer Reason (`↳ 사유: {reason}`) |

### D. Additional Info Request History Card
| Element | Field | Behavior / Display Rules |
| :--- | :--- | :--- |
| **Request Bubble** | `request_content` | MD question with `[요청]` header. |
| **Reply Bubble** | `reply_content` | Brand response with `[회신]` header. |
| **Attachment Link** | `reply_attachment_path` | Secure signed URL link: `📎 첨부파일 보기` (opens in new tab). |

### E. Sidebar Summary Cards
| Card Name | Contents | Visual Indicator |
| :--- | :--- | :--- |
| **참여 조건 자가진단 결과** | 6 Self-check agreement items | `✅` (Agreed) / `❌` (Disagreed) |
| **프로그램 참여 준비 사항** | 6 Official Readiness evaluation items | `🟢 진행 가능` (`available`) / `🟡 협의 필요` (`discussion_required`) |
