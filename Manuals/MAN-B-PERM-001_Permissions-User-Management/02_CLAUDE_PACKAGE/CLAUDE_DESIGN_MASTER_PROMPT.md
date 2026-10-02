# CLAUDE DESIGN MASTER PROMPT: MAN-B-PERM-001
## Permissions & User Management Guide (사용자, 역할 및 권한 관리 가이드)

---

## 1. Objective

Your task is to design and compile the official publication-ready PDF User Manual for **Brand Portal Permissions & User Management (`MAN-B-PERM-001`)**.

---

## 2. Master Visual Standard: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

> [!IMPORTANT]
> **STRICT DESIGN MASTER REFERENCE**:
> You MUST strictly emulate the exact visual design language, grid layout, header/footer structure, typography scales, badge color tokens, and table styles established in **`MAN-B-BRAND-001_Brand-Policy_V1.pdf`**.
> Do NOT create alternative design systems or modify brand colors.

### Key Design Tokens
- **Primary Palette**: Indigo-600 (`#4F46E5`), Zinc-900 (`#18181B`), Zinc-100 (`#F4F4F5`), White (`#FFFFFF`).
- **Accent Tokens**: Emerald-600 (`#059669` / Success), Amber-500 (`#D97706` / Warning), Rose-600 (`#E11D48` / Danger), Purple-600 (`#7C3AED` / Manager).
- **Typography**: Pretendard / Inter, crisp tabular numbers, clear hierarchical headings.
- **Page Format**: A4 Portrait (210mm × 297mm), standard multi-column grid.

---

## 3. Package Assets Inventory

All necessary input assets are located in `Manuals/MAN-B-PERM-001_Permissions-User-Management/02_CLAUDE_PACKAGE/`:

1. **`01_CONTENT/MAN-B-PERM-001_Manual_Content.md`**: Complete Korean-first manual text.
2. **`02_SCREENSHOTS/`**: 10 real production screenshots (`SCR-B-PERM-001.png` through `SCR-B-PERM-010.png`).
3. **`02_SCREENSHOTS/SCREENSHOT_ANNOTATION_GUIDE.md`**: Detailed mapping of callouts and annotations.
4. **`03_DIAGRAMS/PERMISSIONS_ARCHITECTURE_DIAGRAMS.md`**: Simplified business-friendly architecture diagrams.
5. **`04_REFERENCE/REFERENCE_GUIDE.md`**: Data dictionary, role mappings, and ACL definitions.

---

## 4. Strict Domain Rules & Guardrails

1. **Role Layer Separation**:
   - Clearly distinguish Database Membership Roles (`company_admin`, `company_staff`) from Portal Role Presets (`restricted`, `viewer`, `staff`, `manager`, `admin`).
   - Do NOT label Portal presets as database enums.
2. **ACL Model**:
   - 4 Levels (`none`, `read`, `write`, `manage`) and 9 Categories (`application`, `brands`, `products`, `orders`, `finance`, `support`, `company_info`, `bank_info`, `agreements`).
   - Explain that presets provide default baselines, and individual categories can be custom overridden.
3. **Task Assignment $\neq$ Permission**:
   - The 6 operational task definitions are work responsibilities and notification settings, NOT authorization gates.
4. **No Unsupported Absolute Claims**:
   - Do not claim "100% perfect security" or "guaranteed data isolation".
5. **Out of Scope Features**:
   - Do NOT represent MFA enforcement, custom ACL categories, or IP allowlisting as active features.

---

## 5. Document Structure (Target: 6–8 Pages)

- **Cover & Header**: Manual Title, Manual ID `MAN-B-PERM-001`, Version `v1.0`, Category `회사 및 사용자 관리 (topic-company)`.
- **Chapter 1: 개요 및 권한 체계 아키텍처** (계정, 소속, 역할 프리셋, ACL 4단계 분리)
- **Chapter 2: 소속 멤버 목록 및 상태 관리** (`SCR-B-PERM-001`, `SCR-B-PERM-010`)
- **Chapter 3: 신규 멤버 초대 및 역할 설정** (`SCR-B-PERM-002`, `SCR-B-PERM-003`)
- **Chapter 4: 멤버 정보 수정, ACL 커스텀 및 6대 업무 배정** (`SCR-B-PERM-004`, `SCR-B-PERM-005`, `SCR-B-PERM-008`)
- **Chapter 5: 초대 수락 및 비밀번호 온보딩** (`SCR-B-PERM-006`)
- **Chapter 6: 본인 계정 관리 (My Account)** (`SCR-B-PERM-007`)
- **Chapter 7: 어드민 지원 및 테넌트 데이터 보안** (`SCR-B-PERM-009`)
- **Chapter 8: 자주 묻는 질문 (FAQ 7선)**

---

## 6. Visual Quality Checklist

- [ ] All 10 screenshots from `02_SCREENSHOTS/` embedded with crisp aspect ratios.
- [ ] Numbered badge callouts placed accurately according to `SCREENSHOT_ANNOTATION_GUIDE.md`.
- [ ] Visual styling perfectly matches `MAN-B-BRAND-001_Brand-Policy_V1.pdf`.
- [ ] Header, footer, page numbering (`Page X of Y`), and document ID clearly visible on every page.

---
*End of CLAUDE_DESIGN_MASTER_PROMPT.md*
