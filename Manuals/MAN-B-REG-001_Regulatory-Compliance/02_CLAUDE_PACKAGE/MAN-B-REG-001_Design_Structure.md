# MAN-B-REG-001 — Design Structure
## Document Design System, Page Layout & Visual Hierarchy Specs

**Manual ID:** `MAN-B-REG-001`  
**Document Title:** `Regulatory, Certification & Compliance User Guide`  
**Target Design System:** K SELECT Standard Manual Specification (Reference: `MAN-B-ONB-001`)  

---

## 1. Color Palette & Typography

### Color Palette
- **Primary Header / Brand Accent**: `#131E2E` (Dark Navy)
- **Secondary Header**: `#1F3047` (Slate Navy)
- **Body Text**: `#27272A` (Zinc 800 Charcoal)
- **Muted Text / Meta Info**: `#71717A` (Zinc 500)
- **Border Dividers**: `#E4E4E7` (Zinc 200)
- **Callout Backgrounds**:
  - Note: `#F4F4F5` (Zinc 100)
  - Tip: `#EEF2FF` (Indigo 50)
  - Important: `#FEF3C7` (Amber 50)
  - Warning: `#FFE4E6` (Rose 50)

### Typography Hierarchy
- **Title (H1)**: 24pt Bold, Navy (`#131E2E`)
- **Chapter Header (H2)**: 18pt Bold, Navy (`#131E2E`), Bottom border 1px solid `#E4E4E7`
- **Section Header (H3)**: 14pt Semi-bold, Dark Charcoal (`#27272A`)
- **Sub-section Header (H4)**: 12pt Bold, Charcoal (`#3F3F46`)
- **Body Text**: 10.5pt Regular, Charcoal (`#27272A`), Line height 1.6
- **Badges & Monospace**: 9.5pt Mono (`font-mono`), rounded badge style

---

## 2. Document Page Hierarchy

```text
Document Root
├── Header Meta Block (Manual ID, Title, Target Audience, Version, Effective Date)
├── Document Table of Contents
├── Chapter 1: Regulatory & Certification Module Overview
│   ├── 1.1 System Scope & Purpose
│   └── 1.2 End-to-End Compliance Lifecycle Workflow (Mermaid Diagram)
├── Chapter 2: Brand Trademark Declaration (KIPO / USPTO)
│   ├── 2.1 Trademark Declaration Policy (Policy 02)
│   ├── 2.2 Registering KIPO / USPTO Numbers & Proof Files
│   └── 2.3 Screenshots SCR-B-REG-001 & SCR-B-REG-002 Walkthrough
├── Chapter 3: Dual-Language Ingredient Declaration & AI Translation
│   ├── 3.1 Korean & English Ingredient Text Declaration
│   ├── 3.2 Claude AI Translation Widget Usage (KR -> EN)
│   └── 3.3 Screenshots SCR-B-REG-003 & SCR-B-REG-004 Walkthrough
├── Chapter 4: Product Certificates Upload & Version Control (Tab 6 #certs)
│   ├── 4.1 Certificate Categories (fda_registration, trademark, ingredient_certification, patent, other)
│   ├── 4.2 Document Versioning Rules (version, is_current)
│   └── 4.3 Screenshots SCR-B-REG-005 & SCR-B-REG-006 Walkthrough
├── Chapter 5: Product Barcode & Commercial Export Specifications
│   ├── 5.1 UPC (12-digit) & EAN (13-digit) Barcode Formatting
│   ├── 5.2 FOB USD Price, Origin & Registration Evaluator Check
│   └── 5.3 Screenshot SCR-B-REG-007 & Barcode Inquiry Channel
└── Chapter 6: Admin Audit History & System Status Revalidation
    ├── 6.1 Admin Verification Views & Proof File Inspection
    ├── 6.2 Screenshot SCR-B-REG-008 & Change History Audit
    └── 6.3 Appendix & Help Center Navigation
```

---

## 3. Visual Callout Component Specifications

### Note Callout (`> [!NOTE]`)
Used for explaining system file formats, bucket security, or database behavior.
```markdown
> [!NOTE]
> All uploaded trademark and certificate files are stored securely in the `company-uploads` private bucket. Access links expire automatically after 1 hour (3600 seconds) to protect sensitive brand documents.
```

### Tip Callout (`> [!TIP]`)
Used for operational shortcuts, such as the AI translation widget.
```markdown
> [!TIP]
> After entering Korean ingredients, click **[번역하기 (Translate)]** to automatically generate standard English INCI ingredient names. Click **[리뷰 완료 및 적용 (Apply to field)]** to populate the English field instantly.
```

### Important Callout (`> [!IMPORTANT]`)
Used for barcode formatting or required export fields.
```markdown
> [!IMPORTANT]
> A valid 12-digit UPC or 13-digit EAN barcode is required for products to reach `COMPLETE (등록 완료)` status. Products with missing or invalid barcodes remain in `DRAFT (보완 대기)` status.
```

### Warning Callout (`> [!WARNING]`)
Used for alerts regarding versioning or document overrides.
```markdown
> [!WARNING]
> Uploading a new certificate file under the same category will set the previous file's status to inactive (`is_current: false`) and increment the version number by +1. Ensure you upload official PDF or image documents.
```
