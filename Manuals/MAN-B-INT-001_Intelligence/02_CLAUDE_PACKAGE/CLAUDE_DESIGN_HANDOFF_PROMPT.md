# CLAUDE DESIGN HANDOFF PROMPT: MAN-B-INT-001
## Final Handoff Summary & Design Verification Checklist

- **Manual ID:** `MAN-B-INT-001`
- **Manual Title:** `Intelligence & Insights Guide (인텔리전스, 지능형 정책 도우미 및 시장 분석 가이드)`
- **Audience:** `B — Brand Portal Users & Operations`
- **Source Review Basis:** `MAN-B-INT-001-SRC-001-R1`
- **Design Standard:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf` (K SELECT Official Design System)

---

## 1. Handoff Architecture Commitments

1. **Grounded Knowledge Assistant (`/portal/help/ask`)**:
   - Deterministic token/tag/domain-intent matching engine over `knowledge_articles` (`is_published = true`).
   - Strict security defenses against prompt injections, out-of-scope queries, and mutation attempts.
   - Grounded direct answers, summary bullets, and official manual citations (`sources`).

2. **Insights Auto-Engine (`lib/insights/auto-engine/*`)**:
   - Automated live market research across FDA MoCRA, USITC, Customs, and trade monitors.
   - 6-weight scoring system (Relevance 25, Actionability 25, Evidence 20, Timeliness 15, Originality 10, Strategic Fit 5) with Quality Threshold >= 80 points.
   - Daily 3+3 Quota Rule (Target: NETWORK 3 + HUB 3 drafts; Shared Core topic allocation).
   - Strict Human Review Gate: All drafts are generated with status = `'AI_DRAFT'`. Automatic publishing is disabled.

3. **Claim Risk Auditing & Fact Grounding**:
   - High, Medium, Low risk classification.
   - Automatic safe downgrade to `SIGNAL` with moderated phrasing when 1st-tier evidence is absent.
   - Claims and risk summaries are embedded as JSONB inside `insights_articles`.

4. **Reader Usefulness Feedback (`insights_reader_feedback`)**:
   - HMAC-SHA256 duplicate-protected anonymous helpfulness voting.
   - Purely an editorial signal for human editors; does NOT retrain AI models automatically.

5. **INT ↔ RPT Domain Separation**:
   - RPT manages deterministic operational reporting, sales, invoice totals, and PO fulfillment.
   - INT manages market research, export compliance intelligence, Grounded Q&A assistant, and analytical articles.
   - Ordinary dashboard KPI cards on `/portal` belong to RPT/ONB, not INT.

---

## 2. Package Artifacts Inventory (19 Files)

- `PACKAGE_README.md`
- `CLAUDE_DESIGN_MASTER_PROMPT.md`
- `CLAUDE_DESIGN_HANDOFF_PROMPT.md`
- `MAN-B-INT-001_Design_Structure.md`
- `01_CONTENT/MAN-B-INT-001_Manual_Content.md`
- `02_SCREENSHOTS/SCREENSHOT_ANNOTATION_GUIDE.md`
- `02_SCREENSHOTS/SCR-B-INT-001.png` ~ `SCR-B-INT-011.png` (11 High-Res Production Screenshots)
- `03_DIAGRAMS/INTELLIGENCE_ARCHITECTURE_DIAGRAMS.md`
- `04_REFERENCE/REFERENCE_GUIDE.md`

---

## 3. Pre-Flight Design Checklist

- [x] All 11 screenshots exist and possess unique SHA-256 hashes.
- [x] Operational KPI dashboard screens (`/portal`) removed from screenshot requirements.
- [x] Vector RAG / LLM runtime generation claims removed.
- [x] Automatic publishing claims removed (Mandatory Human Gate verified).
- [x] Automatic feedback retraining claims removed.
- [x] Standalone `insights_claims_audit` table corrected to embedded JSONB schema.
- [x] Zero unsupported absolute claims (`UNSUPPORTED ABSOLUTE CLAIMS: 0`).

---
*End of CLAUDE_DESIGN_HANDOFF_PROMPT.md*
