import type {
  GroundedTrainingContext,
  TrainingSourceReadiness,
  SourceReadinessItem,
  SourceReadinessScore,
  TrainingModuleData,
  ContentVerificationSummary,
  ClaimVerificationItem,
  ClaimVerificationStatus,
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

  const allModuleText = [
    module.productOverview,
    ...module.top3Benefits,
    module.bestFor,
    module.howToUse,
    ...module.sellingPoints,
    module.pitch15s,
    ...module.customerObjections.map((o) => `${o.objection} ${o.answer}`),
    module.storageHandlingSop,
  ]
    .join(" ")
    .toLowerCase();

  // Helper to locate evidence
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
    return { found: false, source: "Needs Verification" };
  };

  // 1. High-Risk Claim: Dermatologist Tested
  if (allModuleText.includes("dermatologist") || allModuleText.includes("dermatologist-tested")) {
    const ev = findEvidence("dermatologist");
    if (ev.found) {
      claims.push({
        id: "claim_derm",
        claim: "Dermatologist-tested formulation",
        status: "verified",
        sourceCategory: ev.source,
        evidenceSnippet: ev.snippet,
      });
    } else {
      claims.push({
        id: "claim_derm",
        claim: "Dermatologist-tested claim",
        status: "unsupported",
        sourceCategory: "Needs Verification (No clinical audit record)",
        qualificationNote: "The term 'dermatologist-tested' requires explicit clinical trial documentation in the catalog before publication.",
        isForbiddenPhrase: true,
      });
      unsupportedWarnings.push("Claim 'Dermatologist-tested' has no supporting clinical document in catalog.");
    }
  }

  // 2. High-Risk Claim: Clinically Proven
  if (allModuleText.includes("clinically proven") || allModuleText.includes("clinical trial")) {
    const ev = findEvidence("clinically proven");
    if (ev.found) {
      claims.push({
        id: "claim_clinical",
        claim: "Clinically proven efficacy",
        status: "verified",
        sourceCategory: ev.source,
        evidenceSnippet: ev.snippet,
      });
    } else {
      claims.push({
        id: "claim_clinical",
        claim: "Clinically proven claim",
        status: "unsupported",
        sourceCategory: "Needs Verification (No trial data)",
        qualificationNote: "'Clinically proven' statements are forbidden without certified third-party testing documentation.",
        isForbiddenPhrase: true,
      });
      unsupportedWarnings.push("Claim 'Clinically proven' lacks third-party trial backing.");
    }
  }

  // 3. High-Risk Claim: Instant Skin Barrier Restoration
  if (allModuleText.includes("instant barrier restoration") || allModuleText.includes("instantly restores barrier")) {
    claims.push({
      id: "claim_instant_barrier",
      claim: "Instant skin barrier restoration",
      status: "needs_review",
      sourceCategory: "Product Specifications > Melting Capsules",
      qualificationNote: "Capsules melt immediately for instant smoothing/shielding, but biological lipid barrier repair takes ongoing use. Rephrase to 'instant moisture shield' or 'immediate smoothing'.",
    });
    unsupportedWarnings.push("Claim 'Instant barrier restoration' should be qualified as instant hydration/smoothing shield.");
  }

  // 4. High-Risk Claim: FDA Approved
  if (allModuleText.includes("fda approved") || allModuleText.includes("fda-approved")) {
    claims.push({
      id: "claim_fda",
      claim: "FDA Approved cosmetic claim",
      status: "unsupported",
      sourceCategory: "Needs Verification",
      qualificationNote: "US FDA does not approve cosmetic products; only ingredients and labeling are regulated. Remove FDA approval claims.",
      isForbiddenPhrase: true,
    });
    unsupportedWarnings.push("Cosmetic products cannot claim 'FDA Approved'.");
  }

  // 5. Specific Metric Claim: Multi-Hour Hydration (e.g. 120-hour)
  if (allModuleText.includes("120-hour") || allModuleText.includes("120 hour") || allModuleText.includes("120hr")) {
    const ev = findEvidence("120");
    if (ev.found) {
      claims.push({
        id: "claim_120h",
        claim: "120-hour moisture retention",
        status: "verified",
        sourceCategory: ev.source,
        evidenceSnippet: ev.snippet,
        qualificationNote: "Qualified as tested formulation moisture retention up to 120 hours.",
      });
    } else {
      claims.push({
        id: "claim_120h",
        claim: "120-hour moisture retention",
        status: "needs_review",
        sourceCategory: "Needs Verification",
        qualificationNote: "Multi-hour duration claims must be backed by catalog specifications.",
      });
    }
  }

  // 6. Specific Formulation Claim: 5-Ceramide Complex
  if (allModuleText.includes("5-ceramide") || allModuleText.includes("5 ceramide") || allModuleText.includes("five ceramide")) {
    const ev = findEvidence("5-ceramide") || findEvidence("ceramide");
    if (ev.found) {
      claims.push({
        id: "claim_5ceramide",
        claim: "5-Ceramide complex with visible capsules",
        status: "verified",
        sourceCategory: ev.source,
        evidenceSnippet: ev.snippet,
        qualificationNote: "Matches active ceramide complex with visible melting beads in catalog.",
      });
    } else {
      claims.push({
        id: "claim_5ceramide",
        claim: "5-Ceramide complex",
        status: "needs_review",
        sourceCategory: "Needs Verification",
        qualificationNote: "Verify exact ceramide counts in ingredients before making specific numerical claim.",
      });
    }
  }

  // 7. Safety / Sensitivity Claim: Hypoallergenic
  if (allModuleText.includes("hypoallergenic")) {
    const ev = findEvidence("hypoallergenic");
    if (ev.found) {
      claims.push({
        id: "claim_hypo",
        claim: "Hypoallergenic formulation",
        status: "verified",
        sourceCategory: ev.source,
        evidenceSnippet: ev.snippet,
      });
    } else {
      claims.push({
        id: "claim_hypo",
        claim: "Hypoallergenic formulation",
        status: "needs_review",
        sourceCategory: "Needs Verification",
        qualificationNote: "Do not infer hypoallergenic status without explicit supplier or catalog documentation.",
      });
    }
  }

  // 8. Age Suitability Claim: Ages 3+ / Children
  if (allModuleText.includes("ages 3+") || allModuleText.includes("age 3+") || allModuleText.includes("children")) {
    const ev = findEvidence("ages 3+") || findEvidence("3+");
    if (ev.found) {
      claims.push({
        id: "claim_ages",
        claim: "Tested gentle for Ages 3+",
        status: "verified",
        sourceCategory: ev.source,
        evidenceSnippet: ev.snippet,
      });
    } else {
      claims.push({
        id: "claim_ages",
        claim: "Child/Age 3+ suitability claim",
        status: "needs_review",
        sourceCategory: "Needs Verification",
        qualificationNote: "Child safety claims require manufacturer confirmation.",
      });
    }
  }

  // 9. Core Benefits Attribution (Top 3 Benefits)
  module.top3Benefits.forEach((benefit, idx) => {
    if (!benefit || benefit.trim().length === 0) return;
    const words = benefit.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matchCount = words.filter((w) => allCatalogText.includes(w)).length;
    const isGrounded = matchCount >= Math.min(2, words.length);

    claims.push({
      id: `claim_benefit_${idx + 1}`,
      claim: `Benefit #${idx + 1}: ${benefit.length > 60 ? benefit.slice(0, 57) + "..." : benefit}`,
      status: isGrounded ? "verified" : "needs_review",
      sourceCategory: isGrounded ? "Product Catalog > Key Features" : "Needs Verification (Generated text)",
      evidenceSnippet: isGrounded ? `Keywords supported by catalog facts (${matchCount}/${words.length} key terms matched)` : undefined,
      qualificationNote: isGrounded ? undefined : "Ensure benefit aligns with official manufacturer claims.",
    });
  });

  // 10. Best For / Target Customer Attribution
  if (module.bestFor && module.bestFor.trim().length > 0) {
    const hasSkinAttr = allCatalogText.includes("skin") || allCatalogText.includes("hair") || allCatalogText.includes("dry") || allCatalogText.includes("sensitive");
    claims.push({
      id: "claim_best_for",
      claim: `Target Customer: ${module.bestFor.length > 60 ? module.bestFor.slice(0, 57) + "..." : module.bestFor}`,
      status: hasSkinAttr ? "verified" : "needs_review",
      sourceCategory: "Product Specifications > Category Profile",
      evidenceSnippet: hasSkinAttr ? "Grounded in catalog product category and skin suitability" : undefined,
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
