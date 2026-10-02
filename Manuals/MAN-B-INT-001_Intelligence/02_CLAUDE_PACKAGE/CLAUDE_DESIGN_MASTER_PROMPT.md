# CLAUDE DESIGN MASTER PROMPT: MAN-B-INT-001
## K SELECT Brand Portal Intelligence & Insights Official PDF Manual Generation Prompt

```text
You are an expert technical documentation designer and visual layout specialist.
Your task is to generate the authoritative, production-grade PDF manual for:

Manual ID: MAN-B-INT-001
Manual Name: Intelligence & Insights Guide (인텔리전스, 지능형 정책 도우미 및 시장 분석 가이드)
Target Audience: B — Brand Portal Users & Operations (Brand Owners, Operations Managers & Platform Staff)
Master Reference: MAN-B-BRAND-001_Brand-Policy_V1.pdf

==================================================
1. SOURCE INTEGRITY & FACTUAL ACCURACY RULES
==================================================
1. Domain Separation & Surface Boundaries:
   - Portal Operational Dashboard (/portal): Ordinary KPI cards, onboarding checklist, and invoice/PO counts belong to RPT / ONB operational baseline, NOT Intelligence.
   - Grounded Knowledge Assistant (/portal/help/ask): Server-side deterministic token/tag/domain-intent matching engine over published knowledge_articles (is_published = true). It does NOT use unverified vector RAG or realtime LLM generation. Cites official manual sources.
   - Admin Insights & Auto-Engine (/admin/insights/*): Multi-channel market intelligence system featuring automated research, 6-weight scoring, claim risk auditing, human moderation queue, and reader feedback.
2. Auto-Engine Quality Gates & Quota Rules:
   - Topic Evaluation: Scored 0-100 on 6 weights (Relevance 25, Actionability 25, Evidence 20, Timeliness 15, Originality 10, Strategic Fit 5). Quality threshold >= 80 points + 5 Critical Conditions PASS.
   - Daily Quota (3+3 Rule): Target NETWORK max 3 + HUB max 3 drafts daily. Shared core topics allocated to both channels. 0 draft days occur if no candidates meet >= 80 points (Quality > Volume).
   - Human Review Gate: All generated articles are saved as status = 'AI_DRAFT'. Automatic publication is strictly disabled by default (auto_publish = false).
3. Claim Risk Audit & Safe Downgrades:
   - Classify claims into HIGH, MEDIUM, LOW risk.
   - High risk claims lacking Tier A/B sources are safely downgraded to SIGNAL with moderated phrasing.
   - Headline risk audits rewrite sensational words (e.g. "Crackdown") into compliance checklists.
   - Database Model: insights_claims_audit is NOT a standalone table; claims and risk summaries are embedded as JSONB in insights_articles.
4. Reader Usefulness Feedback:
   - insights_reader_feedback collects anonymous helpful/not helpful votes with HMAC-SHA256 duplicate prevention.
   - Provides usefulness metrics for human editors; does NOT retrain AI models automatically.
5. Absolute Claim & System Gap Restrictions:
   - Prohibit unverified absolute assertions or guarantees.
   - Explicitly list non-implemented features: Predictive demand ML, dynamic automated pricing, automated inventory allocation.

==================================================
2. VISUAL LAYOUT & TYPOGRAPHY SYSTEM
==================================================
- Grid: 12-column layout with 16px gutter, 32px/40px margins.
- Typography: Sans-serif Korean Clear Sans + Inter numbers, strict H1/H2/H3 hierarchy.
- Color Tokens:
  • Primary Brand: #4F46E5 (Indigo 600)
  • Primary Dark: #3730A3 (Indigo 800)
  • Status Colors: Emerald #10B981 (Verified/Published), Blue #3B82F6 (Inferred), Amber #F59E0B (Signal/Draft), Rose #E11D48 (High Risk/Action Required)
  • Borders & Backgrounds: Slate 200 / Slate 50
- Callout Pins: Indigo Solid Circle with White Number `(1)`, `(2)`, `(3)`, `(4)` matching SCREENSHOT_ANNOTATION_GUIDE.md.
- High-Resolution Production Screenshots: Integrate all 11 verified screenshots (SCR-B-INT-001.png ~ SCR-B-INT-011.png).

==================================================
3. DOCUMENT STRUCTURE (7 CHAPTERS)
==================================================
- Chapter 01: System Overview & Three Intelligence Principles
- Chapter 02: Brand Grounded Knowledge Assistant & Policy Guidance (SCR-B-INT-001, SCR-B-INT-002)
- Chapter 03: Admin Insights Platform & Dashboard Overview (SCR-B-INT-003, SCR-B-INT-006)
- Chapter 04: Auto-Engine Research Pipeline & 3+3 Quota Rules (SCR-B-INT-008, SCR-B-INT-009)
- Chapter 05: Claim Risk Auditing, Safe Downgrades & Content Layers (SCR-B-INT-005, SCR-B-INT-007)
- Chapter 06: Editorial Moderation Queue & Publishing Governance (SCR-B-INT-004, SCR-B-INT-010)
- Chapter 07: Reader Usefulness Feedback, System Gaps & Appendix (SCR-B-INT-011)
```

---
*End of CLAUDE_DESIGN_MASTER_PROMPT.md*
