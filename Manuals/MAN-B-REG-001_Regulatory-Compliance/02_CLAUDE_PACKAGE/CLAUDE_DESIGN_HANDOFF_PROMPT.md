# CLAUDE_DESIGN_HANDOFF_PROMPT.md
## Executable Handoff Prompt for Claude Design

> **Instructions for User:**  
> Copy the prompt block below and paste it into Claude Design along with attaching the `02_CLAUDE_PACKAGE` folder.

```markdown
Hello Claude Design! Please generate the published user guide document for **MAN-B-REG-001 — Regulatory, Certification & Compliance User Guide**.

### Package Context & Attachments
I have attached the complete `02_CLAUDE_PACKAGE` directory containing:
1. `01_CONTENT/MAN-B-REG-001_Manual_Content.md` — Complete verified Korean manual text.
2. `02_SCREENSHOTS/SCR-B-REG-001.png` ~ `SCR-B-REG-008.png` — 8 Production screenshots and `SCREENSHOT_ANNOTATION_GUIDE.md`.
3. `03_DIAGRAMS/REGULATORY_ARCHITECTURE_DIAGRAMS.md` — Mermaid process workflow diagrams.
4. `CLAUDE_DESIGN_MASTER_PROMPT.md` — Master document style & design system rules.

### Design Principles & Directives
- **Master Design System Reference**: Use `MAN-BRAND-001 Brand Policy.pdf` (and `MAN-B-ONB-001`) as the **Master Design Reference** for K SELECT Manual Series.
- **No New Visual Concepts**: Do NOT create new visual styles or arbitrary layouts. Layout, typography, color system (`#131E2E` headers, `#27272A` body), header/footer, screenshot framing/callouts, and GitHub-style alert boxes (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`) MUST follow the Master Design Reference.
- **Content Source of Truth**: The functional content, system features, and workflow rules MUST originate strictly from `02_CLAUDE_PACKAGE`.
- **Product Navigation Alignment**: Note that "인허가 & 보증서" (`#certs`) is **Tab 6** in the official Product Detail navigation.
- **Format**: Format this as a **Professional SaaS User Guide Document**, NOT a slide deck.
- **Screenshot Embedding**: Embed the 8 production screenshots in their respective chapters with highlighted callouts, step badges, and captions as specified in `SCREENSHOT_ANNOTATION_GUIDE.md`.
- **Mermaid Diagrams**: Render the Mermaid workflow diagrams clearly at the beginning of relevant chapters.
- **Strict Boundaries**: Describe software features as implemented in K SELECT NETWORK. Do NOT add legal interpretations of external FDA/MoCRA statutes.
- **MSDS / COA Representation**: Keep MSDS/COA document explanations strictly aligned with the `ingredient_certification` or `other` certificate categories.

Please proceed with generating the published manual output in `03_PUBLISHED/MAN-B-REG-001_Regulatory_Compliance_User_Guide.md`.
```
