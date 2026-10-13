import { formatCanonicalCountryName } from "@/lib/constants/countries";

export interface AuthoritativeCompanyCore {
  id: string;
  name: string;
  companyCode: string | null;
  businessRegistrationNumber: string | null;
  country: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  formattedHqAddress: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: string;
  createdAt?: string | null;
}

export interface EffectiveRetailerBillingInfo {
  billingSameAsHq: boolean;
  effectiveBillingAddress: string | null;
  effectiveBillingAddress2?: string | null;
  effectiveBillingCity: string | null;
  effectiveBillingState: string | null;
  effectiveBillingZip: string | null;
  formattedBillingAddress: string | null;

  customBillingAddress: string | null;
  customBillingCity: string | null;
  customBillingState: string | null;
  customBillingZip: string | null;

  billingContactSameAsPrimary: boolean;
  effectiveBillingContactName: string | null;
  effectiveBillingContactPhone: string | null;
  billingContactEmail: string | null;

  customBillingContactName: string | null;
  customBillingContactPhone: string | null;
}

export function formatHqAddress(parts: {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}): string | null {
  const line1 = parts.address1?.trim() || "";
  const line2 = parts.address2?.trim() || "";
  const city = parts.city?.trim() || "";
  const state = parts.state?.trim() || "";
  const zip = parts.zipCode?.trim() || "";

  if (!line1 && !city && !state && !zip) {
    return null;
  }

  const street = [line1, line2].filter(Boolean).join(" ");
  const cityStateZip = [
    city,
    [state, zip].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ");

  return [street, cityStateZip].filter(Boolean).join(", ") || null;
}

export function resolveAuthoritativeCompanyCore(company: any): AuthoritativeCompanyCore {
  const address1 = company?.address_1 || null;
  const address2 = company?.address_2 || null;
  const city = company?.city || null;
  const state = company?.state || null;
  const zipCode = company?.zip_code || null;

  return {
    id: company?.id || "",
    name: company?.name || "",
    companyCode: company?.company_code || null,
    businessRegistrationNumber: company?.business_registration_number || null,
    country: formatCanonicalCountryName(company?.country) || "United States",
    address1,
    address2,
    city,
    state,
    zipCode,
    formattedHqAddress: formatHqAddress({ address1, address2, city, state, zipCode }),
    contactName: company?.contact_name || null,
    contactPhone: company?.contact_phone || null,
    status: company?.status || "active",
    createdAt: company?.created_at || null,
  };
}

export function resolveEffectiveRetailerBilling(
  profile: any,
  companyCore: AuthoritativeCompanyCore
): EffectiveRetailerBillingInfo {
  // Determine if billing address is same as HQ:
  // 1. Explicit boolean column if available
  // 2. Fallback heuristic: if billing_address is populated and differs from company HQ, assume separate override (false); otherwise true
  const hasCustomBillingData = Boolean(
    profile?.billing_address?.trim() &&
    (!companyCore.address1 || profile.billing_address.trim() !== companyCore.address1.trim())
  );

  const billingSameAsHq =
    typeof profile?.billing_same_as_hq === "boolean"
      ? profile.billing_same_as_hq
      : !hasCustomBillingData;

  const effectiveBillingAddress = billingSameAsHq
    ? companyCore.address1
    : profile?.billing_address || null;

  const effectiveBillingAddress2 = billingSameAsHq
    ? companyCore.address2
    : null;

  const effectiveBillingCity = billingSameAsHq
    ? companyCore.city
    : profile?.billing_city || null;

  const effectiveBillingState = billingSameAsHq
    ? companyCore.state
    : profile?.billing_state || null;

  const effectiveBillingZip = billingSameAsHq
    ? companyCore.zipCode
    : profile?.billing_zip || null;

  const formattedBillingAddress = formatHqAddress({
    address1: effectiveBillingAddress,
    address2: effectiveBillingAddress2,
    city: effectiveBillingCity,
    state: effectiveBillingState,
    zipCode: effectiveBillingZip,
  });

  // Determine if billing contact is same as primary contact
  const hasCustomContactData = Boolean(
    profile?.billing_contact_name?.trim() &&
    (!companyCore.contactName || profile.billing_contact_name.trim() !== companyCore.contactName.trim())
  );

  const billingContactSameAsPrimary =
    typeof profile?.billing_contact_same_as_primary === "boolean"
      ? profile.billing_contact_same_as_primary
      : !hasCustomContactData;

  const effectiveBillingContactName = billingContactSameAsPrimary
    ? companyCore.contactName
    : profile?.billing_contact_name || companyCore.contactName || null;

  const effectiveBillingContactPhone = billingContactSameAsPrimary
    ? companyCore.contactPhone
    : profile?.billing_contact_phone || companyCore.contactPhone || null;

  const billingContactEmail = profile?.billing_contact_email || null;

  return {
    billingSameAsHq,
    effectiveBillingAddress,
    effectiveBillingAddress2,
    effectiveBillingCity,
    effectiveBillingState,
    effectiveBillingZip,
    formattedBillingAddress,

    customBillingAddress: profile?.billing_address || null,
    customBillingCity: profile?.billing_city || null,
    customBillingState: profile?.billing_state || null,
    customBillingZip: profile?.billing_zip || null,

    billingContactSameAsPrimary,
    effectiveBillingContactName,
    effectiveBillingContactPhone,
    billingContactEmail,

    customBillingContactName: profile?.billing_contact_name || null,
    customBillingContactPhone: profile?.billing_contact_phone || null,
  };
}

/**
 * Synchronizes retailer_profiles billing info when Company HQ or primary contact changes,
 * strictly honoring the billingSameAsHq and billingContactSameAsPrimary rules:
 * - If billingSameAsHq is true (default), mirrors new HQ address into billing fields.
 * - If billingSameAsHq is false (separate override), leaves billing address completely untouched.
 * - If billingContactSameAsPrimary is true (default), mirrors primary contact name/phone.
 * - If billingContactSameAsPrimary is false (separate override), leaves billing contact completely untouched.
 */
export async function syncRetailerBillingIfSameAsHq(
  adminClient: any,
  companyId: string,
  hqUpdates: {
    address1?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  }
) {
  try {
    const { data: profile } = await adminClient
      .from("retailer_profiles")
      .select("billing_same_as_hq, billing_contact_same_as_primary, billing_address, billing_contact_name")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!profile) return; // Not a retailer organization, nothing to sync

    const profUpdates: any = { updated_at: new Date().toISOString() };
    const isSameAddress = profile.billing_same_as_hq !== false;
    const isSameContact = profile.billing_contact_same_as_primary !== false;

    if (isSameAddress) {
      if (hqUpdates.address1 !== undefined) profUpdates.billing_address = hqUpdates.address1?.trim() || null;
      if (hqUpdates.city !== undefined) profUpdates.billing_city = hqUpdates.city?.trim() || null;
      if (hqUpdates.state !== undefined) profUpdates.billing_state = hqUpdates.state?.trim() || null;
      if (hqUpdates.zipCode !== undefined) profUpdates.billing_zip = hqUpdates.zipCode?.trim() || null;
    }

    if (isSameContact) {
      if (hqUpdates.contactName !== undefined) profUpdates.billing_contact_name = hqUpdates.contactName?.trim() || null;
      if (hqUpdates.contactPhone !== undefined) profUpdates.billing_contact_phone = hqUpdates.contactPhone?.trim() || null;
    }

    if (Object.keys(profUpdates).length > 1) {
      const { error } = await adminClient
        .from("retailer_profiles")
        .update(profUpdates)
        .eq("company_id", companyId);

      if (error && error.message?.includes("does not exist")) {
        delete profUpdates.billing_same_as_hq;
        delete profUpdates.billing_contact_same_as_primary;
        await adminClient
          .from("retailer_profiles")
          .update(profUpdates)
          .eq("company_id", companyId);
      }
    }
  } catch (err) {
    console.warn("[syncRetailerBillingIfSameAsHq] Non-fatal sync notice:", err);
  }
}

