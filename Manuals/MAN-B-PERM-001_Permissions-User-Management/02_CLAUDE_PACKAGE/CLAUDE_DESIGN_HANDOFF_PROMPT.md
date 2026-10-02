# CLAUDE DESIGN HANDOFF PROMPT: MAN-B-PERM-001
## Quick Execution Handoff Guide

---

```markdown
You are designing the official PDF User Manual for:
**MAN-B-PERM-001: Brand Portal Permissions & User Management Guide (사용자, 역할 및 권한 관리 가이드)**

### Critical Execution Instructions:
1. **Master Visual Reference**: Emulate the exact layout, margins, fonts, headers, and callout badges from `MAN-B-BRAND-001_Brand-Policy_V1.pdf`.
2. **Text Authority**: Render the full structured text in `01_CONTENT/MAN-B-PERM-001_Manual_Content.md`.
3. **Core Domain Rules**:
   - Distinctly separate DB Membership Role (`company_admin`, `company_staff`) from 5 Portal Role Presets (`restricted`, `viewer`, `staff`, `manager`, `admin`).
   - 4 ACL Levels (`none`, `read`, `write`, `manage`) and 9 ACL Categories (`application`, `brands`, `products`, `orders`, `finance`, `support`, `company_info`, `bank_info`, `agreements`).
   - Task Assignment $\neq$ Permission: The 6 operational tasks are work responsibility and email notification metadata, not authorization gates.
   - Initial Owner is a derived protection state, not a database role.
   - Do NOT present MFA, custom categories, or IP allowlisting as active features.
4. **Screenshots & Callouts**: Embed all 10 verified production screenshots from `02_SCREENSHOTS/` according to `SCREENSHOT_ANNOTATION_GUIDE.md`.
5. **Output**: Compile the final PDF document to `Manuals/MAN-B-PERM-001_Permissions-User-Management/03_PUBLISHED/MAN-B-PERM-001_Permissions_User_Management_Guide.pdf`.
```

---
*End of CLAUDE_DESIGN_HANDOFF_PROMPT.md*
