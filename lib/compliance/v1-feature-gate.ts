/**
 * KSN-COMPLIANCE-V1 Authoritative Feature Release Gate
 *
 * Controlled gate governing the activation of:
 * - Manufacturing facility management (company_shipping_origins 0200 columns & manufacturing_facility_compliance)
 * - Product facility association (product_manufacturing_facilities)
 * - Regulatory & Compliance workspace (product_regulatory_compliance)
 * - Regulatory attribute relocation & standalone completeness
 * - New mandatory facility validation rules in product registration
 * - Compliance evidence document uploads & private admin notes
 *
 * Default in all environments: FALSE (disabled)
 * Activated only upon approved cutover task KSN-CMP-010 by setting:
 *   NEXT_PUBLIC_COMPLIANCE_V1_ENABLED=true
 */

let featureGateOverride: boolean | null = null;

/**
 * Checks if Compliance V1 feature suite is authoritatively enabled.
 * Server and client compatible.
 */
export function isComplianceV1Enabled(): boolean {
  if (typeof window === "undefined" && process.env.COMPLIANCE_V1_SERVER_DISABLED === "true") {
    return false;
  }
  if (process.env.NODE_ENV !== "production" && featureGateOverride !== null) {
    return featureGateOverride;
  }
  return process.env.NEXT_PUBLIC_COMPLIANCE_V1_ENABLED === "true";
}

/**
 * Test override helper for isolated QA and regression suites.
 * Ignored in production environment.
 */
export function setComplianceV1FeatureGateOverride(enabled: boolean | null): void {
  if (process.env.NODE_ENV !== "production") {
    featureGateOverride = enabled;
  }
}

/**
 * Guard for state-changing mutations in server actions and API routes.
 */
export function requireComplianceV1MutationAllowed():
  | { allowed: true }
  | { allowed: false; error: string; errorCode: "FEATURE_GATED" } {
  if (!isComplianceV1Enabled()) {
    return {
      allowed: false,
      error: "규제 및 인허가 V1 기능은 정식 릴리즈 전까지 비활성화되어 있습니다 (Release Gate Protected).",
      errorCode: "FEATURE_GATED",
    };
  }
  return { allowed: true };
}

/**
 * Determines whether the 4 regulatory attributes (FDA_STATUS, MOCRA_STATUS, OTC_STATUS, DRUG_FACTS_STATUS)
 * should be relocated away from Category & Attributes.
 * - When FALSE (pre-cutover): Legacy attributes remain visible in Category Attributes and count toward completeness.
 * - When TRUE (post-cutover): Attributes are relocated to Regulatory & Compliance tab.
 */
export function isRegulatoryAttributeRelocated(): boolean {
  return isComplianceV1Enabled();
}

/**
 * Determines whether Primary Manufacturing Facility is enforced during product registration.
 * - When FALSE (pre-cutover): Facility is optional / non-blocking.
 * - When TRUE (post-cutover): Facility is required for new final registration (unless grandfathered).
 */
export function isPrimaryFacilityEnforced(): boolean {
  return isComplianceV1Enabled();
}
