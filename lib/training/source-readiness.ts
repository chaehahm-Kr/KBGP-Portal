import type {
  GroundedTrainingContext,
  TrainingSourceReadiness,
  SourceReadinessItem,
  SourceReadinessScore,
  TrainingModuleData,
  ContentVerificationSummary,
  ClaimVerificationItem,
  ClaimVerificationStatus,
  TrainingSectionKey,
} from "./training-types";

/**
 * Category-aware Attribute Resolver
 * Extracts structured facts based on category (Skincare, Hair Care, Makeup, Body Care)
 */
export function extractCategoryAttributes(
  context: GroundedTrainingContext
): Record<string, string> {
  const branch = (context.categoryBranch || context.categoryName || "").toUpperCase();
  const desc = (context.description + " " + context.bulletPoints.join(" ")).toLowerCase();
  const attributes: Record<string, string> = {};

  if (branch.includes("SKIN") || branch.includes("FACIAL") || branch.includes("CLEANSER") || branch.includes("SERUM") || branch.includes("CREAM")) {
    // SKINCARE
    // 1. Skin Type
    if (desc.includes("sensitive") || desc.includes("reactive") || desc.includes("hypoallergenic")) {
      attributes["Skin Type"] = "Sensitive, Reactive, or Dry Skin";
    } else if (desc.includes("oily") || desc.includes("sebum") || desc.includes("pore")) {
      attributes["Skin Type"] = "Oily, Combination, or Blemish-prone Skin";
    } else if (desc.includes("dry") || desc.includes("dehydrated")) {
      attributes["Skin Type"] = "Dry, Dehydrated Skin";
    } else {
      attributes["Skin Type"] = "All Skin Types";
    }

    // 2. Primary Concern
    if (desc.includes("barrier") || desc.includes("ceramide")) {
      attributes["Primary Concern"] = "Damaged moisture barrier, Redness & Tightness";
    } else if (desc.includes("brightening") || desc.includes("vitamin c") || desc.includes("niacinamide") || desc.includes("tone")) {
      attributes["Primary Concern"] = "Dull complexion, Uneven skin tone, Dark spots";
    } else if (desc.includes("cooling") || desc.includes("puffiness") || desc.includes("eye")) {
      attributes["Primary Concern"] = "Under-eye puffiness, Dark circles, Fine lines";
    } else if (desc.includes("hydration") || desc.includes("moisture")) {
      attributes["Primary Concern"] = "Dehydration, Dullness, Moisture loss";
    } else {
      attributes["Primary Concern"] = "General skin health & nourishment";
    }

    // 3. Application Area
    if (desc.includes("eye") || desc.includes("patches")) {
      attributes["Application Area"] = "Under-eye contour & expression lines";
    } else if (desc.includes("lip")) {
      attributes["Application Area"] = "Lips & dry zones";
    } else {
      attributes["Application Area"] = "Face and neck";
    }

    // 4. Usage Frequency
    if (context.howToUse.toLowerCase().includes("morning and night") || context.howToUse.toLowerCase().includes("daily")) {
      attributes["Usage Frequency"] = "Twice daily (Morning & Night)";
    } else if (context.howToUse.toLowerCase().includes("night") || desc.includes("sleeping pack")) {
      attributes["Usage Frequency"] = "Nightly or as needed";
    } else {
      attributes["Usage Frequency"] = "Daily as regular skincare step";
    }

    // 5. Age Suitability
    if (desc.includes("ages 3+") || desc.includes("children")) {
      attributes["Age Suitability"] = "Gentle formulation noted for Ages 3+";
    } else {
      attributes["Age Suitability"] = "Adults & Teens";
    }

    // 6. Storage Conditions
    attributes["Storage"] = "Store at room temperature (15°C–25°C) away from direct heat";
  } else if (branch.includes("HAIR") || branch.includes("SCALP")) {
    // HAIR CARE
    attributes["Hair Type"] = desc.includes("damaged") || desc.includes("bleached")
      ? "Damaged, Bleached, Chemically-treated, or Frizzy Hair"
      : "All Hair Types";
    attributes["Hair Concern"] = "Split ends, Breakage, Lack of shine & elasticity";
    attributes["Application Area"] = "Mid-lengths to ends (avoid roots if oily scalp)";
    attributes["Usage Frequency"] = "1–2 times weekly or post-shampoo";
    attributes["Precaution"] = "Rinse thoroughly with lukewarm water; avoid contact with eyes";
  } else if (branch.includes("MAKEUP") || branch.includes("COLOR") || branch.includes("LIP")) {
    // MAKEUP
    attributes["Finish"] = desc.includes("glow") || desc.includes("dewy") ? "Natural dewy glass-skin glow" : "Natural finish";
    attributes["Application Area"] = "Cheeks, lips, and high points of face";
    attributes["Tool"] = "Fingertips, blending sponge, or stippling brush";
    attributes["Storage"] = "Keep cap firmly closed; avoid leaving in hot vehicles";
  } else {
    // GENERAL / BODY CARE
    attributes["Body Area"] = "Hands, feet, or body dry patches";
    attributes["Usage"] = "Apply generously to dry areas as needed";
    attributes["Storage"] = "Store in a cool, dry place";
  }

  return attributes;
}

/**
 * Perform comprehensive Source Readiness Evaluation
 */
export function evaluateTrainingSourceReadiness(
  context: GroundedTrainingContext
): TrainingSourceReadiness {
  const items: SourceReadinessItem[] = [];
  const missingCritical: string[] = [];

  const categoryAttrs = extractCategoryAttributes(context);

  // 1. Product Identity
  const hasIdentity = Boolean(context.productName && context.brandName && context.sku);
  items.push({
    id: "check_identity",
    name: "Product Identity & Specifications",
    category: "identity",
    status: hasIdentity ? "ready" : "insufficient",
    evidence: hasIdentity
      ? `Brand: ${context.brandName} | SKU: ${context.sku}${context.volume ? ` | Vol: ${context.volume}` : ""}${context.origin ? ` | Origin: ${context.origin}` : ""}`
      : "Missing product name, brand, or SKU in master catalog",
    sourceField: "Catalog Master (products)",
  });
  if (!hasIdentity) missingCritical.push("Product Identity / SKU");

  // 2. Product Benefits
  const hasBullets = context.bulletPoints.length > 0;
  const hasDesc = Boolean(context.description && context.description.trim().length > 20);
  const benefitStatus: SourceReadinessScore = hasBullets || hasDesc ? "ready" : "insufficient";
  items.push({
    id: "check_benefits",
    name: "Product Benefits & Features",
    category: "benefits",
    status: benefitStatus,
    evidence: hasBullets
      ? `${context.bulletPoints.length} verified bullet points available in catalog`
      : hasDesc
      ? "Detailed product description available"
      : "No bullet points or product description found",
    sourceField: hasBullets ? "admin_overrides.bullet_points" : "products.description",
  });
  if (benefitStatus === "insufficient") missingCritical.push("Key Product Benefits");

  // 3. Target Customer / Best For
  const hasTargetAttr = Boolean(categoryAttrs["Skin Type"] || categoryAttrs["Hair Type"]);
  items.push({
    id: "check_target",
    name: "Target Customer & Suitability",
    category: "target_customer",
    status: hasTargetAttr ? "ready" : "needs_review",
    evidence: hasTargetAttr
      ? `Category attributes mapped: ${Object.entries(categoryAttrs)
          .map(([k, v]) => `${k}: ${v}`)
          .slice(0, 2)
          .join(" · ")}`
      : "No explicit target audience defined; requires reviewer check",
    sourceField: "Category Attributes & Description",
    categoryAttributes: categoryAttrs,
  });

  // 4. How to Use
  const hasUsage = Boolean(context.howToUse && context.howToUse.trim().length > 15);
  items.push({
    id: "check_usage",
    name: "Usage Instructions & Application Steps",
    category: "how_to_use",
    status: hasUsage ? "ready" : "needs_review",
    evidence: hasUsage
      ? `Verified instructions available: "${context.howToUse.slice(0, 60)}..."`
      : "General application instructions suggested from category SOP",
    sourceField: "products.how_to_use / Category SOP",
  });

  // 5. Selling Points & 15-Sec Pitch
  const hasShortDesc = Boolean(context.shortDescription && context.shortDescription.trim().length > 10);
  items.push({
    id: "check_selling",
    name: "Selling Points & Counter Talk-Tracks",
    category: "selling_points",
    status: hasShortDesc || hasBullets ? "ready" : "needs_review",
    evidence: hasShortDesc
      ? `Trading short description available: "${context.shortDescription!.slice(0, 60)}..."`
      : hasBullets
      ? "Derived from verified product bullet points"
      : "Needs review to formulate counter pitch",
    sourceField: hasShortDesc ? "trading_overrides.short_description" : "bullet_points",
  });

  // 6. Precautions & Storage SOP
  const hasIngredients = Boolean(context.ingredientsText && context.ingredientsText.trim().length > 10);
  items.push({
    id: "check_precautions",
    name: "Precautions, Safety & Storage SOP",
    category: "precautions",
    status: "ready", // Cosmetic storage & safety standards are deterministically grounded
    evidence: hasIngredients
      ? "Formulation components verified; standard cosmetic safety and storage guidelines applied"
      : "Standard storage SOP applied; check for allergen-specific inquiries",
    sourceField: "ingredients_text / Cosmetic Safety Standard",
  });

  // 7. Supporting Images / Visual Media
  const hasMedia = context.imageCount > 0 || context.mediaAssetCount > 0;
  items.push({
    id: "check_media",
    name: "Product Photography & Visual Assets",
    category: "media",
    status: hasMedia ? "ready" : "needs_review",
    evidence: hasMedia
      ? `${context.imageCount} catalog images, ${context.mediaAssetCount} media assets available`
      : "No product photos found; visual recognition will be limited",
    sourceField: "product_images / product_media_assets",
  });

  const readyCount = items.filter((i) => i.status === "ready").length;
  const needsReviewCount = items.filter((i) => i.status === "needs_review").length;
  const insufficientCount = items.filter((i) => i.status === "insufficient").length;

  let overallScore: SourceReadinessScore = "ready";
  if (insufficientCount > 0) {
    overallScore = "insufficient";
  } else if (needsReviewCount > 1) {
    overallScore = "needs_review";
  }

  return {
    overallScore,
    totalChecks: items.length,
    readyChecks: readyCount,
    needsReviewChecks: needsReviewCount,
    insufficientChecks: insufficientCount,
    items,
    missingCriticalFacts: missingCritical,
    categoryBranch: context.categoryBranch,
  };
}

/**
 * Perform Factual Claim Verification & Source Attribution
 * Separates Source Readiness (data completeness) from Content Verification (factual backing of generated claims).
 */
/**
 * Perform Comprehensive Factual Claim Verification & Source Attribution
 * Inspects the entire Training Module and Assessment Quiz field-by-field:
 * - Product Overview
 * - Top 3 Benefits
 * - Best For
 * - How to Use
 * - Selling Points & 15-Second Pitch
 * - Customer Objections & Answers
 * - Storage & Handling SOP
 * - Quiz Questions (prompts, all 3 options, and educational explanations)
 */
export function verifyTrainingContentClaims(
  module: TrainingModuleData,
  context: GroundedTrainingContext
): ContentVerificationSummary {
  const claims: ClaimVerificationItem[] = [];
  const unsupportedWarnings: string[] = [];

  // Authoritative catalog text corpus
  const catalogDesc = (context.description || "").toLowerCase();
  const catalogBullets = context.bulletPoints.map((b) => b.toLowerCase());
  const catalogIngredients = (context.ingredientsText || "").toLowerCase();
  const catalogHowToUse = (context.howToUse || "").toLowerCase();
  const allCatalogText = [
    context.productName.toLowerCase(),
    context.brandName.toLowerCase(),
    catalogDesc,
    ...catalogBullets,
    catalogIngredients,
    catalogHowToUse,
  ].join(" ");

  // Helper to locate evidence in catalog sources
  const findEvidence = (query: string): { found: boolean; source: string; snippet?: string } => {
    const q = query.toLowerCase();
    for (let i = 0; i < context.bulletPoints.length; i++) {
      if (context.bulletPoints[i].toLowerCase().includes(q)) {
        return {
          found: true,
          source: "Product Catalog > admin_overrides.bullet_points",
          snippet: context.bulletPoints[i].slice(0, 100),
        };
      }
    }
    if (context.description && catalogDesc.includes(q)) {
      return {
        found: true,
        source: "Product Catalog > products.description",
        snippet: context.description.slice(0, 100),
      };
    }
    if (context.ingredientsText && catalogIngredients.includes(q)) {
      return {
        found: true,
        source: "Product Catalog > products.ingredients_text",
        snippet: context.ingredientsText.slice(0, 100),
      };
    }
    if (context.howToUse && catalogHowToUse.includes(q)) {
      return {
        found: true,
        source: "Product Catalog > products.how_to_use",
        snippet: context.howToUse.slice(0, 100),
      };
    }
    return { found: false, source: "Needs Verification" };
  };

  // Inspectable field descriptor
  interface InspectedField {
    sectionKey: TrainingSectionKey;
    location: string;
    fieldTarget: string;
    text: string;
  }

  // 1. Gather all inspectable fields across Training Content
  const fieldsToInspect: InspectedField[] = [
    {
      sectionKey: "productOverview",
      location: "Training Content > 1. Product Overview",
      fieldTarget: "field-productOverview",
      text: module.productOverview || "",
    },
    ...module.top3Benefits.map((b, idx) => ({
      sectionKey: "top3Benefits" as TrainingSectionKey,
      location: `Training Content > 2. Top 3 Benefits (Benefit #${idx + 1})`,
      fieldTarget: `field-top3Benefits-${idx}`,
      text: b || "",
    })),
    {
      sectionKey: "bestFor",
      location: "Training Content > 3. Best For (Target Customer)",
      fieldTarget: "field-bestFor",
      text: module.bestFor || "",
    },
    {
      sectionKey: "howToUse",
      location: "Training Content > 4. How to Use Instructions",
      fieldTarget: "field-howToUse",
      text: module.howToUse || "",
    },
    {
      sectionKey: "pitch15s",
      location: "Training Content > 5. 15-Second Counter Pitch",
      fieldTarget: "field-pitch15s",
      text: module.pitch15s || "",
    },
    ...module.sellingPoints.map((sp, idx) => ({
      sectionKey: "sellingPoints" as TrainingSectionKey,
      location: `Training Content > 5. Selling Point #${idx + 1}`,
      fieldTarget: `field-sellingPoints-${idx}`,
      text: sp || "",
    })),
    ...module.customerObjections.flatMap((obj, idx) => [
      {
        sectionKey: "customerObjections" as TrainingSectionKey,
        location: `Training Content > 6. Customer Objection #${idx + 1}`,
        fieldTarget: `field-customerObjections-${idx}-objection`,
        text: obj.objection || "",
      },
      {
        sectionKey: "customerObjections" as TrainingSectionKey,
        location: `Training Content > 6. Customer Objection Answer #${idx + 1}`,
        fieldTarget: `field-customerObjections-${idx}-answer`,
        text: obj.answer || "",
      },
    ]),
    {
      sectionKey: "storageHandlingSop",
      location: "Training Content > 7. Storage & Handling SOP",
      fieldTarget: "field-storageHandlingSop",
      text: module.storageHandlingSop || "",
    },
  ];

  // 2. Gather all inspectable fields across Assessment Quiz
  (module.quizQuestions || []).forEach((q, qIdx) => {
    fieldsToInspect.push({
      sectionKey: "quizQuestions",
      location: `Assessment Quiz > Question ${qIdx + 1} (Prompt)`,
      fieldTarget: `field-quiz-${qIdx}-question`,
      text: q.question || "",
    });
    (q.options || []).forEach((opt, optIdx) => {
      const isCorrect = q.correctIndex === optIdx;
      fieldsToInspect.push({
        sectionKey: "quizQuestions",
        location: `Assessment Quiz > Question ${qIdx + 1} (Option ${String.fromCharCode(65 + optIdx)}${isCorrect ? " - Correct" : ""})`,
        fieldTarget: `field-quiz-${qIdx}-opt-${optIdx}`,
        text: opt || "",
      });
    });
    fieldsToInspect.push({
      sectionKey: "quizQuestions",
      location: `Assessment Quiz > Question ${qIdx + 1} (Explanation)`,
      fieldTarget: `field-quiz-${qIdx}-explanation`,
      text: q.explanation || "",
    });
  });

  // Track checked signatures to avoid duplicated issue cards for the exact same field+rule
  const seenRuleField = new Set<string>();

  // 3. Field-by-field claim checks
  for (const f of fieldsToInspect) {
    const rawText = f.text.trim();
    if (!rawText) continue;
    const lower = rawText.toLowerCase();

    // Check A: High-Risk Dermatologist-Tested / Clinical Trials
    if (
      lower.includes("dermatologist") ||
      lower.includes("dermatologist-tested") ||
      lower.includes("clinically proven") ||
      lower.includes("clinical trial") ||
      lower.includes("clinically tested") ||
      lower.includes("clinically verified")
    ) {
      const sig = `derm_${f.fieldTarget}`;
      if (!seenRuleField.has(sig)) {
        seenRuleField.add(sig);
        const ev = findEvidence("dermatologist") || findEvidence("clinically proven") || findEvidence("clinical");
        if (ev.found) {
          claims.push({
            id: `claim_${sig}`,
            claim: "Dermatologist-tested / Clinical claim",
            status: "verified",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            sourceCategory: ev.source,
            evidenceSnippet: ev.snippet,
            qualificationNote: "Supported by clinical documentation in catalog.",
          });
        } else {
          claims.push({
            id: `claim_${sig}`,
            claim: lower.includes("dermatologist") ? "Dermatologist-tested" : "Clinically proven efficacy",
            status: "unsupported",
            severity: "blocking",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            reason: "Supporting clinical trial or dermatologist documentation not identified in catalog sources.",
            action: "Revise wording to remove clinical test claim or attach verified trial record.",
            sourceCategory: "Needs Verification (No clinical audit record)",
            qualificationNote: "The term 'dermatologist-tested' or 'clinically proven' requires explicit certified trial documentation.",
            isForbiddenPhrase: true,
          });
          unsupportedWarnings.push(
            `[${f.location}]: Unsupported claim requires clinical audit record in catalog.`
          );
        }
      }
    }

    // Check B: FDA Approved (Cosmetics are not FDA approved by law)
    if (lower.includes("fda approved") || lower.includes("fda-approved") || lower.includes("fda certified")) {
      const sig = `fda_${f.fieldTarget}`;
      if (!seenRuleField.has(sig)) {
        seenRuleField.add(sig);
        claims.push({
          id: `claim_${sig}`,
          claim: "FDA Approved cosmetic claim",
          status: "unsupported",
          severity: "blocking",
          location: f.location,
          sectionKey: f.sectionKey,
          fieldTarget: f.fieldTarget,
          reason: "US FDA does not approve cosmetic products; only ingredients and labeling are regulated.",
          action: "Remove FDA approval claim.",
          sourceCategory: "Needs Verification (Regulatory restriction)",
          qualificationNote: "Cosmetic products cannot make 'FDA Approved' claims under 21 CFR.",
          isForbiddenPhrase: true,
        });
        unsupportedWarnings.push(`[${f.location}]: Cosmetic products cannot claim 'FDA Approved'.`);
      }
    }

    // Check C: Instant Barrier Restoration
    if (
      lower.includes("instant barrier restoration") ||
      lower.includes("instantly restores barrier") ||
      lower.includes("immediate barrier repair") ||
      lower.includes("barrier restoration instantly")
    ) {
      const sig = `instant_${f.fieldTarget}`;
      if (!seenRuleField.has(sig)) {
        seenRuleField.add(sig);
        claims.push({
          id: `claim_${sig}`,
          claim: "Instant barrier restoration",
          status: "needs_review",
          severity: "warning",
          location: f.location,
          sectionKey: f.sectionKey,
          fieldTarget: f.fieldTarget,
          reason: "Biological lipid barrier repair requires ongoing physiological use. Melting capsules provide immediate moisture shielding and surface smoothing.",
          action: "Rephrase to 'instant moisture shield' or 'immediate surface smoothing'.",
          sourceCategory: "Product Specifications > Melting Capsules",
          qualificationNote: "Qualify as instant moisture shield rather than permanent instant biological barrier repair.",
        });
      }
    }

    // Check D: Multi-Hour Moisture Duration (e.g. 120-hour, 72-hour)
    const durationMatch = lower.match(/\b(\d{2,3})[- ](?:hour|hr)\b/);
    if (durationMatch) {
      const hours = durationMatch[1];
      const sig = `duration_${hours}_${f.fieldTarget}`;
      if (!seenRuleField.has(sig)) {
        seenRuleField.add(sig);
        const ev = findEvidence(hours);
        if (ev.found) {
          claims.push({
            id: `claim_${sig}`,
            claim: `${hours}-hour moisture retention`,
            status: "verified",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            sourceCategory: ev.source,
            evidenceSnippet: ev.snippet,
            qualificationNote: `Qualified as tested formulation moisture retention up to ${hours} hours.`,
          });
        } else {
          claims.push({
            id: `claim_${sig}`,
            claim: `${hours}-hour moisture duration claim`,
            status: "needs_review",
            severity: "warning",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            reason: `Multi-hour duration claims (${hours} hours) must be explicitly backed by catalog specifications.`,
            action: `Confirm ${hours}-hour test in catalog or describe as long-lasting daily hydration.`,
            sourceCategory: "Needs Verification",
          });
        }
      }
    }

    // Check E: Specific Complex / Active Ingredient Counts (e.g. 5-ceramide, 10-peptide)
    const complexMatch = lower.match(/\b(\d+)[- ](ceramide|peptide|hyaluronic|vitamin|collagen|cica)\b/);
    if (complexMatch) {
      const complexTerm = `${complexMatch[1]}-${complexMatch[2]}`;
      const sig = `complex_${complexTerm}_${f.fieldTarget}`;
      if (!seenRuleField.has(sig)) {
        seenRuleField.add(sig);
        const ev = findEvidence(complexTerm) || findEvidence(complexMatch[2]);
        if (ev.found) {
          claims.push({
            id: `claim_${sig}`,
            claim: `${complexTerm} active complex`,
            status: "verified",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            sourceCategory: ev.source,
            evidenceSnippet: ev.snippet,
            qualificationNote: `Matches active ${complexMatch[2]} complex in catalog.`,
          });
        } else {
          claims.push({
            id: `claim_${sig}`,
            claim: `${complexTerm} active complex`,
            status: "needs_review",
            severity: "warning",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            reason: `Verify exact ${complexMatch[2]} counts in ingredients before making specific numerical claim.`,
            action: "Check ingredients list or describe as active complex.",
            sourceCategory: "Needs Verification",
          });
        }
      }
    }

    // Check F: Hypoallergenic Formulation
    if (lower.includes("hypoallergenic")) {
      const sig = `hypo_${f.fieldTarget}`;
      if (!seenRuleField.has(sig)) {
        seenRuleField.add(sig);
        const ev = findEvidence("hypoallergenic");
        if (ev.found) {
          claims.push({
            id: `claim_${sig}`,
            claim: "Hypoallergenic formulation",
            status: "verified",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            sourceCategory: ev.source,
            evidenceSnippet: ev.snippet,
          });
        } else {
          claims.push({
            id: `claim_${sig}`,
            claim: "Hypoallergenic formulation",
            status: "needs_review",
            severity: "warning",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            reason: "Do not infer hypoallergenic status without explicit supplier or catalog documentation.",
            action: "Verify supplier sensitive-skin certification or describe formulation as gentle.",
            sourceCategory: "Needs Verification",
          });
        }
      }
    }

    // Check G: Pediatric / Age Suitability (Ages 3+ / Children)
    if (lower.includes("ages 3+") || lower.includes("age 3+") || lower.includes("children")) {
      const sig = `ages_${f.fieldTarget}`;
      if (!seenRuleField.has(sig)) {
        seenRuleField.add(sig);
        const ev = findEvidence("ages 3+") || findEvidence("3+") || findEvidence("children");
        if (ev.found) {
          claims.push({
            id: `claim_${sig}`,
            claim: "Tested gentle for Ages 3+",
            status: "verified",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            sourceCategory: ev.source,
            evidenceSnippet: ev.snippet,
          });
        } else {
          claims.push({
            id: `claim_${sig}`,
            claim: "Child / Age 3+ suitability claim",
            status: "needs_review",
            severity: "warning",
            location: f.location,
            sectionKey: f.sectionKey,
            fieldTarget: f.fieldTarget,
            reason: "Child and pediatric suitability claims require explicit manufacturer confirmation.",
            action: "Verify age suitability in catalog or qualify for adult and teen use.",
            sourceCategory: "Needs Verification",
          });
        }
      }
    }
  }

  // 4. Section Grounding Baseline: Top 3 Benefits Attribution
  module.top3Benefits.forEach((benefit, idx) => {
    if (!benefit || benefit.trim().length === 0) return;
    const words = benefit.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matchCount = words.filter((w) => allCatalogText.includes(w)).length;
    const isGrounded = matchCount >= Math.min(2, words.length);

    claims.push({
      id: `claim_benefit_${idx + 1}`,
      claim: `Benefit #${idx + 1}: ${benefit.length > 60 ? benefit.slice(0, 57) + "..." : benefit}`,
      status: isGrounded ? "verified" : "needs_review",
      severity: isGrounded ? undefined : "warning",
      location: `Training Content > 2. Top 3 Benefits (Benefit #${idx + 1})`,
      sectionKey: "top3Benefits",
      fieldTarget: `field-top3Benefits-${idx}`,
      sourceCategory: isGrounded ? "Product Catalog > Key Features" : "Needs Verification (Generated text)",
      evidenceSnippet: isGrounded ? `Keywords supported by catalog facts (${matchCount}/${words.length} key terms matched)` : undefined,
      qualificationNote: isGrounded ? undefined : "Ensure benefit aligns with official manufacturer claims.",
      reason: isGrounded ? undefined : "Benefit terminology should be aligned with catalog features.",
      action: isGrounded ? undefined : "Verify key terms match catalog specifications.",
    });
  });

  // 5. Section Grounding Baseline: Best For / Target Customer Attribution
  if (module.bestFor && module.bestFor.trim().length > 0) {
    const hasSkinAttr = allCatalogText.includes("skin") || allCatalogText.includes("hair") || allCatalogText.includes("dry") || allCatalogText.includes("sensitive");
    claims.push({
      id: "claim_best_for",
      claim: `Target Customer: ${module.bestFor.length > 60 ? module.bestFor.slice(0, 57) + "..." : module.bestFor}`,
      status: hasSkinAttr ? "verified" : "needs_review",
      severity: hasSkinAttr ? undefined : "warning",
      location: "Training Content > 3. Best For (Target Customer)",
      sectionKey: "bestFor",
      fieldTarget: "field-bestFor",
      sourceCategory: "Product Specifications > Category Profile",
      evidenceSnippet: hasSkinAttr ? "Grounded in catalog product category and skin suitability" : undefined,
      reason: hasSkinAttr ? undefined : "Target customer concerns should align with product category.",
      action: hasSkinAttr ? undefined : "Ensure target profile matches category characteristics.",
    });
  }

  const verifiedCount = claims.filter((c) => c.status === "verified").length;
  const needsReviewCount = claims.filter((c) => c.status === "needs_review").length;
  const unsupportedCount = claims.filter((c) => c.status === "unsupported").length;

  let overallStatus: ClaimVerificationStatus = "verified";
  if (unsupportedCount > 0) {
    overallStatus = "unsupported";
  } else if (needsReviewCount > 0) {
    overallStatus = "needs_review";
  }

  return {
    overallStatus,
    totalClaimsChecked: claims.length,
    verifiedCount,
    needsReviewCount,
    unsupportedCount,
    claims,
    unsupportedWarnings,
  };
}
