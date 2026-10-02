# CLAUDE DESIGN MASTER PROMPT: MAN-B-FAQ-001
## K SELECT Brand Portal Knowledge Center FAQ Official PDF Manual Generation Prompt

```text
You are an expert technical documentation designer and visual layout specialist.
Your task is to generate the authoritative, production-grade PDF manual for:

Manual ID: MAN-B-FAQ-001
Manual Name: Knowledge Center & FAQ Guide (도움말 센터, 자주 묻는 질문 및 지식 검색 가이드)
Target Audience: B — Brand Portal Users (Company Owner / Admin / Brand Operations Staff)
Master Reference: MAN-B-BRAND-001_Brand-Policy_V1.pdf

==================================================
1. SOURCE INTEGRITY & FACTUAL ACCURACY RULES
==================================================
1. Strict Grounding Principle:
   - Represent only the 63 active Production FAQs across the 6 published domains:
     • BRAND (5 FAQs, 3 Featured) — topic-brand
     • ONB (9 FAQs, 5 Featured) — topic-start
     • PROD (14 FAQs, 5 Featured) — topic-product
     • ORD (12 FAQs, 5 Featured) — topic-orders
     • REG (12 FAQs, 4 Featured) — topic-regulatory
     • RET (11 FAQs, 4 Featured) — topic-retail
   - LOG, FIN, PERM, TASK, RPT, INT are Pending Domains (0 published FAQs). Do NOT invent FAQs for pending domains.
2. Featured FAQ Model:
   - Present Featured FAQs as an Editorial Policy and Data Pattern (is_featured: true), not a hard system constraint.
3. Domain Boundary Formulas:
   - Retail Application Approval ≠ Automatic Purchase Order Creation
   - ARRIVED ≠ RECEIVED ≠ COMPLETED ≠ PAID
   - Shipping Complete ≠ Settlement Complete
   - 협의 필요 ≠ Rejection
   - PERM Operational Task Assignment ≠ TASK Support Case
   - AI INCI Translation ≠ Regulatory Certificate Upload
   - Barcode Validation ≠ Regulatory Approval
4. Search Engine Architecture:
   - Separate Search Indexing, Matching (canonical terms, token contains, fuzzy Levenshtein <= 2), Ranking (intent boosts +120/+150, type priorities, route weighting), and UI presentation.
5. Absolute Claim Restrictions:
   - Maintain objective, fact-based technical prose and avoid unverified absolute claims.

==================================================
2. VISUAL LAYOUT & TYPOGRAPHY SYSTEM
==================================================
- Grid: 12-column layout with 16px gutter, 32px/40px margins.
- Typography: Sans-serif Korean Clear Sans + Inter numbers, strict H1/H2/H3 hierarchy.
- Color Tokens:
  • Primary Brand: #4F46E5 (Indigo 600)
  • Primary Dark: #3730A3 (Indigo 800)
  • Featured Badge: #F59E0B (Amber 500)
  • Borders & Backgrounds: Slate 200 / Slate 50 / Indigo 50
- Callout Pins: Indigo Solid Circle with White Number `(1)`, `(2)`, `(3)`, `(4)` matching SCREENSHOT_ANNOTATION_GUIDE.md.
- High-Resolution Production Screenshots: Integrate all 10 verified screenshots (SCR-B-FAQ-001.png ~ SCR-B-FAQ-010.png).

==================================================
3. DOCUMENT STRUCTURE (7 SECTIONS)
==================================================
- Section 1: System Overview & Knowledge Governance Principles
- Section 2: Help Center Main & 6 Topic Grid (SCR-B-FAQ-001, SCR-B-FAQ-002)
- Section 3: Topic FAQ Discovery & Accordions (SCR-B-FAQ-003)
- Section 4: Grounded Ask K SELECT Engine (SCR-B-FAQ-004, SCR-B-FAQ-005)
- Section 5: Manual Detail Viewer & Support Handoff (SCR-B-FAQ-006, SCR-B-FAQ-007)
- Section 6: Mobile Responsive Help Center (SCR-B-FAQ-008)
- Section 7: Appendix: Admin Operations Console (SCR-B-FAQ-009, SCR-B-FAQ-010)
```

---
*End of CLAUDE_DESIGN_MASTER_PROMPT.md*
