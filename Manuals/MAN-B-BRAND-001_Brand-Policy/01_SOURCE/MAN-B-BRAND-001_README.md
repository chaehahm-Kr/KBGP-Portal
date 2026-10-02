# K SELECT MANUAL MANAGEMENT README

| 항목 (Field) | 내용 (Value) |
|---|---|
| **Manual ID** | `MAN-B-BRAND-001` |
| **Manual Name** | `K SELECT Brand Registration & Management Policy` |
| **Korean Name** | `K SELECT 브랜드 등록 및 관리 정책` |
| **Version** | `v1.0` |
| **Created Date** | `2026-10-01` |
| **Updated Date** | `2026-10-01` |
| **Target User** | K SELECT Brand Portal 사용자 (브랜드사 관리자, 실무자, 총괄) |
| **Production Brand Portal URL** | `https://portal.kselectnetwork.com/portal/brands` |
| **Production Admin URL** | `https://admin.kselectnetwork.com` |
| **Screenshot Date** | `2026-10-01` |
| **Claude Package Status** | `READY FOR CLAUDE DESIGN` (`01_CLAUDE_PACKAGE` 완성) |
| **Design Status** | `READY_FOR_CLAUDE_DESIGN` |
| **QA Status** | `PASSED` (Production Live Screens & Flow Verified) |
| **Published Status** | `PENDING_DESIGN_OUTPUT` |
| **최종 게시 예정 파일** | `03_PUBLISHED/MAN-B-BRAND-001_KSELECT_Brand-Policy_PUBLISHED_V1.0.pdf` |

---

## 📁 디렉토리 구조 및 역할 가이드

```text
/Manuals/
└── MAN-B-BRAND-001_Brand-Policy/
    │
    ├── 00_README/
    │   ├── MAN-B-BRAND-001_README.docx
    │   └── MAN-B-BRAND-001_README.md
    │
    ├── 01_CLAUDE_PACKAGE/                          <-- ⭐ [전달 대상] Claude Design에 전달할 단일 폴더
    │   ├── MAN-B-BRAND-001_CLAUDE_MASTER_PROMPT.docx
    │   ├── MAN-B-BRAND-001_CLAUDE_MASTER_PROMPT.md
    │   ├── MAN-B-BRAND-001_MANUAL_CONTENT.docx
    │   ├── MAN-B-BRAND-001_MANUAL_CONTENT.md
    │   ├── MAN-B-BRAND-001_SCREENSHOT_GUIDE.docx
    │   ├── MAN-B-BRAND-001_SCREENSHOT_GUIDE.md
    │   ├── SCREENSHOTS/
    │   │   ├── MAN-B-BRAND-001_SS-01_Brand-Management.png
    │   │   ├── MAN-B-BRAND-001_SS-02_Brand-Registration-Entry.png
    │   │   ├── MAN-B-BRAND-001_SS-03_Brand-Registration-Form.png
    │   │   ├── MAN-B-BRAND-001_SS-04_Brand-Detail-Edit.png
    │   │   ├── MAN-B-BRAND-001_SS-05_Brand-Empty-State.png
    │   │   ├── MAN-B-BRAND-001_SS-06_Product-Brand-Selection.png
    │   │   ├── MAN-B-BRAND-001_SS-07_Brand-Deactivation-Action.png
    │   │   └── MAN-B-BRAND-001_SS-08_Trademark-Information-Fields.png
    │   └── REFERENCES/
    │       ├── ksn-logo-dark.png
    │       ├── ksn-logo-new.png
    │       ├── ksn-symbol.png
    │       └── apple-touch-icon.png
    │
    ├── 02_CLAUDE_OUTPUT/
    │   ├── DRAFT/                                  <-- Claude 디자인 작업 중간 시안 보관
    │   └── FINAL/                                  <-- 최종 승인된 편집 가능 Word (.docx) 및 완성본 PDF (.pdf) 보관
    │
    └── 03_PUBLISHED/                               <-- 실제 포털 게시용 버전 (V1.0, V1.1 등)
```

---

## 🚀 사용자 작업 안내 (User Action)

**사용자는 `01_CLAUDE_PACKAGE` 폴더 전체를 Claude Design에 전달하시면 바로 디자인 작업을 시작할 수 있습니다.**
- 별도의 파일 검색이나 스크린샷 추가 작업이 필요 없습니다.
- 모든 스크린샷은 실제 프로덕션 포털에서 고해상도(Retina 2x)로 정밀 캡처되었습니다.
