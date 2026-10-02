# MAN-B-PERM-001: Claude Design Package
## Permissions & User Management Guide (사용자, 역할 및 권한 관리 가이드)

---

## 1. Package Metadata

| Property | Value |
| :--- | :--- |
| **Manual ID** | `MAN-B-PERM-001` |
| **Manual Title** | Brand Portal Permissions & User Management Guide (사용자, 역할 및 권한 관리 가이드) |
| **Audience** | `B — Brand Portal User` (Company Owner, Admin, Team Members) |
| **Topic Category** | `topic-company` (회사 및 사용자 관리 / Permissions & Security) |
| **Topic Sequence** | Core Foundation Manual |
| **Visual Design Standard** | **`MAN-B-BRAND-001_Brand-Policy_V1.pdf`** (Authoritative Master Style Reference) |
| **Content Source of Truth** | `01_SOURCE` (`MAN-B-PERM-001-SRC-001-R1`) & `01_CONTENT/MAN-B-PERM-001_Manual_Content.md` |
| **Current Status** | `READY FOR CHATGPT PACKAGE QA` |

---

## 2. Package Directory Layout

```text
Manuals/MAN-B-PERM-001_Permissions-User-Management/02_CLAUDE_PACKAGE/
├── PACKAGE_README.md
├── CLAUDE_DESIGN_MASTER_PROMPT.md
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md
├── MAN-B-PERM-001_Design_Structure.md
├── 01_CONTENT/
│   └── MAN-B-PERM-001_Manual_Content.md
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md
│   ├── SCR-B-PERM-001.png
│   ├── SCR-B-PERM-002.png
│   ├── SCR-B-PERM-003.png
│   ├── SCR-B-PERM-004.png
│   ├── SCR-B-PERM-005.png
│   ├── SCR-B-PERM-006.png
│   ├── SCR-B-PERM-007.png
│   ├── SCR-B-PERM-008.png
│   ├── SCR-B-PERM-009.png
│   └── SCR-B-PERM-010.png
├── 03_DIAGRAMS/
│   └── PERMISSIONS_ARCHITECTURE_DIAGRAMS.md
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md
```

---

## 3. Core Architectural Boundaries & Design Rules

1. **Strict Role Separation**:
   - **DB Membership Roles**: `company_admin` vs `company_staff`.
   - **Portal Role Presets**: `restricted`, `viewer`, `staff`, `manager`, `admin`.
   - *Never describe Portal Presets as database enums.*
2. **ACL Granularity**:
   - **4 ACL Levels**: `none` (0), `read` (1), `write` (2), `manage` (3).
   - **9 Categories**: `application`, `brands`, `products`, `orders`, `finance`, `support`, `company_info`, `bank_info`, `agreements`.
   - Per-category overrides are fully supported and persisted in `company_users.permissions` JSONB.
3. **Task Assignment $\neq$ Permission**:
   - The 6 `TASK_DEFINITIONS` are operational work responsibility and email notification routing metadata, NOT authorization gates.
4. **Verified Account Protections**:
   - Initial Owner derived-state protection.
   - Last Admin downgrade/removal protection.
   - Self-removal prevention.
   - Single-company membership constraint.
5. **No Unsupported Claims or Features**:
   - MFA/2FA, custom categories, and IP allowlisting are categorized as **NOT IMPLEMENTED / OUT OF SCOPE**. Do not represent them as active features.

---

## 4. Master Design Reference Standard

> [!IMPORTANT]
> **MASTER DESIGN REFERENCE**:
> Claude Design MUST emulate the exact visual layout, grid standards, header/footer branding, typography scale, table formatting, callout styling, and callout badge badges established in **`MAN-B-BRAND-001_Brand-Policy_V1.pdf`**.

---
*End of PACKAGE_README.md*
