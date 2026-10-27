import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  NormalizedCompanyDraft,
  SourcingEvaluationInput,
  DuplicateMatchResult,
  DuplicateCheckCriteria,
} from "./types";

export type { SourcingEvaluationInput, DuplicateMatchResult, DuplicateCheckCriteria };

export interface SourcingListParams {
  search?: string;
  grade?: string;
  category?: string;
  status?: string;
  businessTypes?: string[];
  businessTypeMatchMode?: "ANY" | "ALL";
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Resolves the Supabase client to use.
 * In production/staging runtime, server actions pass their authorized client.
 * In isolated QA / unit tests, resolves QA service client safely via environment variables.
 */
export function getClient(client?: SupabaseClient): SupabaseClient {
  if (client) return client;

  // 1. Check QA configuration if QA is active
  if (process.env.ENABLE_QA_ENVIRONMENT === "true" && process.env.QA_SUPABASE_URL) {
    const qaKey =
      process.env.QA_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.QA_SUPABASE_ANON_KEY ||
      process.env.QA_SUPABASE_SECRET_KEY;
    if (qaKey) {
      return createClient(process.env.QA_SUPABASE_URL, qaKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  // 2. Production / Preview runtime credentials
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  return createClient(url, key);
}

/**
 * Checks for potential duplicate candidates across existing sourcing records
 * and authoritative registered partner companies.
 */
export async function findDuplicateCandidates(
  criteria: DuplicateCheckCriteria,
  customClient?: SupabaseClient
): Promise<DuplicateMatchResult> {
  const supabase = getClient(customClient);
  const matches: DuplicateMatchResult["matches"] = [];

  // 1. Check exact source identifier (e.g. org-ec0b85bc-960d-49d4-9dca-146c10ae59cb)
  if (criteria.sourceIdentifier) {
    const { data: sourceMatches } = await supabase
      .from("sourcing_sources")
      .select("company_id, source_identifier, sourcing_companies(id, company_name_kr)")
      .eq("source_identifier", criteria.sourceIdentifier)
      .limit(5);

    if (sourceMatches) {
      for (const sm of sourceMatches) {
        const comp = sm.sourcing_companies as any;
        if (!matches.some((m) => m.matchType === "SOURCE_IDENTIFIER" && m.entityId === sm.company_id)) {
          matches.push({
            matchType: "SOURCE_IDENTIFIER",
            matchedValue: criteria.sourceIdentifier,
            entityType: "SOURCING_CANDIDATE",
            entityId: sm.company_id,
            entityName: comp?.company_name_kr || "Unknown Sourcing Company",
          });
        }
      }
    }
  }

  // 2. Check Company Name (KR & EN) in sourcing_companies
  if (criteria.companyNameKr) {
    const cleanKr = criteria.companyNameKr.trim();
    const { data: nameMatches } = await supabase
      .from("sourcing_companies")
      .select("id, company_name_kr")
      .ilike("company_name_kr", cleanKr)
      .limit(5);

    if (nameMatches) {
      for (const nm of nameMatches) {
        if (!matches.some((m) => m.matchType === "COMPANY_NAME" && m.entityId === nm.id)) {
          matches.push({
            matchType: "COMPANY_NAME",
            matchedValue: cleanKr,
            entityType: "SOURCING_CANDIDATE",
            entityId: nm.id,
            entityName: nm.company_name_kr,
          });
        }
      }
    }

    // Also check authoritative core companies table
    const { data: partnerNameMatches } = await supabase
      .from("companies")
      .select("id, name")
      .ilike("name", cleanKr)
      .limit(5);

    if (partnerNameMatches) {
      for (const pm of partnerNameMatches) {
        if (!matches.some((m) => m.matchType === "COMPANY_NAME" && m.entityId === pm.id)) {
          matches.push({
            matchType: "COMPANY_NAME",
            matchedValue: cleanKr,
            entityType: "PARTNER_COMPANY",
            entityId: pm.id,
            entityName: pm.name,
          });
        }
      }
    }
  }

  // 3. Check Website Domain in sourcing_websites
  if (criteria.websiteUrl) {
    try {
      const hostname = new URL(criteria.websiteUrl).hostname.replace(/^www\./, "");
      const { data: webMatches } = await supabase
        .from("sourcing_websites")
        .select("company_id, url, sourcing_companies(id, company_name_kr)")
        .ilike("url", `%${hostname}%`)
        .limit(5);

      if (webMatches) {
        for (const wm of webMatches) {
          const comp = wm.sourcing_companies as any;
          if (!matches.some((m) => m.matchType === "DOMAIN" && m.entityId === wm.company_id)) {
            matches.push({
              matchType: "DOMAIN",
              matchedValue: hostname,
              entityType: "SOURCING_CANDIDATE",
              entityId: wm.company_id,
              entityName: comp?.company_name_kr || "Unknown Sourcing Company",
            });
          }
        }
      }
    } catch {}
  }

  // 4. Check Email in sourcing_contacts
  if (criteria.emails && criteria.emails.length > 0) {
    for (const em of criteria.emails) {
      const cleanEmail = em.toLowerCase().trim();
      const { data: contactMatches } = await supabase
        .from("sourcing_contacts")
        .select("company_id, email, sourcing_companies(id, company_name_kr)")
        .eq("email", cleanEmail)
        .limit(5);

      if (contactMatches) {
        for (const cm of contactMatches) {
          const comp = cm.sourcing_companies as any;
          if (!matches.some((m) => m.matchType === "EMAIL" && m.entityId === cm.company_id)) {
            matches.push({
              matchType: "EMAIL",
              matchedValue: cleanEmail,
              entityType: "SOURCING_CANDIDATE",
              entityId: cm.company_id,
              entityName: comp?.company_name_kr || "Unknown Sourcing Company",
            });
          }
        }
      }
    }
  }

  return {
    isDuplicate: matches.length > 0,
    isExistingPartner: matches.some((m) => m.entityType === "PARTNER_COMPANY"),
    matches,
  };
}

/**
 * Saves a NormalizedCompanyDraft into dedicated sourcing tables.
 */
export async function saveSourcingDraft(
  draft: NormalizedCompanyDraft,
  evaluation?: SourcingEvaluationInput,
  customClient?: SupabaseClient
): Promise<{ success: boolean; companyId: string }> {
  const supabase = getClient(customClient);

  // 1. Insert Sourcing Company Master
  const { data: company, error: companyErr } = await supabase
    .from("sourcing_companies")
    .insert({
      company_name_kr: draft.company.nameKr,
      company_name_en: draft.company.nameEn,
      description_kr: draft.company.descriptionKr,
      description_en: draft.company.descriptionEn,
      business_types: evaluation?.businessTypes || draft.company.businessTypes || [],
      business_type_evidence: draft.company.businessTypeEvidence,
      representative_name: draft.company.representativeName,
      business_registration_number: draft.company.businessRegistrationNumber,
      address_line1: draft.company.address.line1,
      address_line2: draft.company.address.line2,
      address_city: draft.company.address.city,
      address_state_province: draft.company.address.stateProvince,
      address_postcode: draft.company.address.postcode,
      address_country: draft.company.address.country || "한국",
      address_country_code: draft.company.address.countryCode || "KR",
      address_formatted_kr: draft.company.address.formattedKr,
      address_formatted_en: draft.company.address.formattedEn,
      grade: evaluation?.grade || "UNRATED",
      status: evaluation?.status || "DRAFT",
      assigned_to: evaluation?.assignedTo || null,
      internal_notes: evaluation?.internalNotes || null,
      marketing_consent_status: evaluation?.marketingConsentStatus || "UNCONFIRMED",
      raw_payload_snapshot: {
        ...(draft.source.rawPayloadSnapshot || {}),
        categories: draft.categories || [],
        companyProducts: draft.companyProducts || [],
        companyTypeOtherExplanation: evaluation?.companyTypeOtherExplanation || null,
      },
      audit_summary: draft.audit,
    })
    .select("id")
    .single();

  if (companyErr || !company) {
    throw new Error(`Failed to insert sourcing company: ${companyErr?.message || "Unknown error"}`);
  }

  const companyId = company.id;

  // 2. Insert Brands
  if (draft.brands.length > 0) {
    const brandRows = draft.brands.map((b, idx) => ({
      company_id: companyId,
      brand_name_kr: b.nameKr,
      brand_name_en: b.nameEn,
      description: b.description,
      categories: b.categories?.length > 0 ? b.categories : (draft.categories || []),
      key_products: b.keyProducts || [],
      source: b.source,
      display_order: idx,
    }));

    const { error: brandErr } = await supabase.from("sourcing_brands").insert(brandRows);
    if (brandErr) {
      console.warn("Failed to insert sourcing brands:", brandErr.message);
    }
  }

  // 3. Insert Contacts
  if (draft.contacts.length > 0) {
    const contactRows = draft.contacts.map((c, idx) => ({
      company_id: companyId,
      name: c.name,
      department: c.department,
      job_title: c.jobTitle,
      email: c.email,
      phone: c.phone,
      is_primary: c.isPrimary,
      source: c.source,
      source_url: c.sourceUrl,
      display_order: idx,
    }));

    const { error: contactErr } = await supabase.from("sourcing_contacts").insert(contactRows);
    if (contactErr) {
      console.warn("Failed to insert sourcing contacts:", contactErr.message);
    }
  }

  // 4. Insert Websites
  if (draft.websites.length > 0) {
    const websiteRows = draft.websites.map((w, idx) => ({
      company_id: companyId,
      url: w.url,
      label: w.label,
      is_primary: idx === 0,
      source: w.source,
    }));

    const { error: webErr } = await supabase.from("sourcing_websites").insert(websiteRows);
    if (webErr) {
      console.warn("Failed to insert sourcing websites:", webErr.message);
    }
  }

  // 5. Insert Source Provenance
  const { error: sourceErr } = await supabase.from("sourcing_sources").insert({
    company_id: companyId,
    provider: draft.source.provider,
    source_url: draft.source.sourceUrl,
    source_identifier: draft.source.sourceIdentifier,
    event_edition_id: draft.source.eventEditionId,
    stand_location: draft.source.standLocation,
    raw_payload: draft.source.rawPayloadSnapshot || null,
    collected_at: draft.source.collectedAt,
  });

  if (sourceErr) {
    console.warn("Failed to insert sourcing source provenance:", sourceErr.message);
  }

  return { success: true, companyId };
}

/**
 * Retrieves a sourcing candidate company by ID with all relational details.
 */
export async function getSourcingCompanyById(id: string, customClient?: SupabaseClient) {
  const supabase = getClient(customClient);

  const { data: company, error: compErr } = await supabase
    .from("sourcing_companies")
    .select(`
      *,
      sourcing_brands(*),
      sourcing_contacts(*),
      sourcing_websites(*),
      sourcing_sources(*)
    `)
    .eq("id", id)
    .single();

  if (compErr) {
    throw new Error(`Failed to fetch sourcing company: ${compErr.message}`);
  }

  const rawSnapshot = (company.raw_payload_snapshot as any) || {};
  const companyCategories: string[] = Array.from(
    new Set([
      ...(Array.isArray(rawSnapshot.categories) ? rawSnapshot.categories : []),
      ...(company.sourcing_brands?.flatMap((b: any) => (Array.isArray(b.categories) ? b.categories : [])) || []),
    ])
  );
  const companyProducts: any[] = Array.isArray(rawSnapshot.companyProducts) && rawSnapshot.companyProducts.length > 0
    ? rawSnapshot.companyProducts
    : company.sourcing_brands?.flatMap((b: any) => (Array.isArray(b.key_products) ? b.key_products : [])) || [];

  return {
    ...company,
    categories: companyCategories,
    companyCategories,
    companyProducts,
    companyTypeOtherExplanation: rawSnapshot.companyTypeOtherExplanation || null,
  };
}

/**
 * Fully updates an existing sourcing candidate and its related child entities.
 */
export async function updateSourcingCandidateComplete(
  id: string,
  draft: NormalizedCompanyDraft,
  evaluation?: SourcingEvaluationInput,
  customClient?: SupabaseClient
) {
  const supabase = getClient(customClient);

  // 1. Update master record
  const companyUpdates: Record<string, any> = {
    company_name_kr: draft.company.nameKr,
    company_name_en: draft.company.nameEn,
    description_kr: draft.company.descriptionKr,
    description_en: draft.company.descriptionEn,
    business_types: evaluation?.businessTypes || draft.company.businessTypes || [],
    business_type_evidence: draft.company.businessTypeEvidence,
    representative_name: draft.company.representativeName,
    business_registration_number: draft.company.businessRegistrationNumber,
    address_line1: draft.company.address.line1,
    address_line2: draft.company.address.line2,
    address_city: draft.company.address.city,
    address_state_province: draft.company.address.stateProvince,
    address_postcode: draft.company.address.postcode,
    address_country: draft.company.address.country || "한국",
    address_country_code: draft.company.address.countryCode || "KR",
    address_formatted_kr: draft.company.address.formattedKr,
    address_formatted_en: draft.company.address.formattedEn,
    raw_payload_snapshot: {
      ...(draft.source.rawPayloadSnapshot || {}),
      categories: draft.categories || [],
      companyProducts: draft.companyProducts || [],
      companyTypeOtherExplanation: evaluation?.companyTypeOtherExplanation || null,
    },
    audit_summary: draft.audit,
    updated_at: new Date().toISOString(),
  };

  if (evaluation?.grade) companyUpdates.grade = evaluation.grade;
  if (evaluation?.status) companyUpdates.status = evaluation.status;
  if (evaluation?.assignedTo !== undefined) companyUpdates.assigned_to = evaluation.assignedTo;
  if (evaluation?.internalNotes !== undefined) companyUpdates.internal_notes = evaluation.internalNotes;
  if (evaluation?.marketingConsentStatus) {
    companyUpdates.marketing_consent_status = evaluation.marketingConsentStatus;
  }

  const { error: compErr } = await supabase
    .from("sourcing_companies")
    .update(companyUpdates)
    .eq("id", id);

  if (compErr) {
    throw new Error(`Failed to update sourcing company: ${compErr.message}`);
  }

  // 2. Replace brands
  await supabase.from("sourcing_brands").delete().eq("company_id", id);
  if (draft.brands.length > 0) {
    const brandRows = draft.brands.map((b, idx) => ({
      company_id: id,
      brand_name_kr: b.nameKr,
      brand_name_en: b.nameEn,
      description: b.description,
      categories: b.categories?.length > 0 ? b.categories : (draft.categories || []),
      key_products: b.keyProducts,
      source: b.source,
      display_order: idx,
    }));
    await supabase.from("sourcing_brands").insert(brandRows);
  }

  // 3. Replace contacts
  await supabase.from("sourcing_contacts").delete().eq("company_id", id);
  if (draft.contacts.length > 0) {
    const contactRows = draft.contacts.map((c, idx) => ({
      company_id: id,
      name: c.name,
      department: c.department,
      job_title: c.jobTitle,
      email: c.email,
      phone: c.phone,
      is_primary: c.isPrimary,
      source: c.source,
      source_url: c.sourceUrl,
      display_order: idx,
    }));
    await supabase.from("sourcing_contacts").insert(contactRows);
  }

  // 4. Replace websites
  await supabase.from("sourcing_websites").delete().eq("company_id", id);
  if (draft.websites.length > 0) {
    const websiteRows = draft.websites.map((w, idx) => ({
      company_id: id,
      url: w.url,
      label: w.label,
      is_primary: idx === 0,
      source: w.source,
    }));
    await supabase.from("sourcing_websites").insert(websiteRows);
  }

  return { success: true };
}

/**
 * Deletes a sourcing candidate company by ID (cascades to child records).
 */
export async function deleteSourcingCandidate(id: string, customClient?: SupabaseClient) {
  const supabase = getClient(customClient);
  const { error } = await supabase.from("sourcing_companies").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete sourcing company: ${error.message}`);
  }
  return { success: true };
}

/**
 * Lists sourcing companies with search and filtering for the Brand List UI.
 */
export async function listSourcingCompanies(
  params?: SourcingListParams,
  customClient?: SupabaseClient
) {
  const supabase = getClient(customClient);

  let query = supabase
    .from("sourcing_companies")
    .select(
      `
      id,
      company_name_kr,
      company_name_en,
      description_kr,
      description_en,
      business_types,
      representative_name,
      business_registration_number,
      address_formatted_kr,
      address_formatted_en,
      grade,
      status,
      assigned_to,
      internal_notes,
      raw_payload_snapshot,
      created_at,
      updated_at,
      sourcing_brands(id, brand_name_kr, brand_name_en, categories, key_products),
      sourcing_contacts(id, name, department, job_title, email, phone, is_primary),
      sourcing_websites(id, url, label, is_primary),
      sourcing_sources(id, provider, source_url, source_identifier)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (params?.grade && params.grade !== "ALL") {
    query = query.eq("grade", params.grade);
  }
  if (params?.status && params.status !== "ALL") {
    query = query.eq("status", params.status);
  }
  if (params?.assignedTo && params.assignedTo !== "ALL") {
    query = query.eq("assigned_to", params.assignedTo);
  }

  // Company Type filter (multi-value)
  if (params?.businessTypes && params.businessTypes.length > 0) {
    if (params.businessTypeMatchMode === "ALL") {
      query = query.contains("business_types", params.businessTypes);
    } else {
      query = query.overlaps("business_types", params.businessTypes);
    }
  }

  // Category filter
  if (params?.category && params.category !== "ALL") {
    const { data: brandCatMatches } = await supabase
      .from("sourcing_brands")
      .select("company_id")
      .contains("categories", [params.category])
      .limit(200);

    const catCompanyIds = (brandCatMatches || []).map((r) => r.company_id);
    if (catCompanyIds.length > 0) {
      query = query.in("id", catCompanyIds);
    } else {
      return { data: [], total: 0 };
    }
  }

  // Multi-vector search across company name, brand name, email, website domain
  if (params?.search) {
    const s = params.search.trim();
    const [brandMatches, contactMatches, webMatches] = await Promise.all([
      supabase
        .from("sourcing_brands")
        .select("company_id")
        .or(`brand_name_kr.ilike.%${s}%,brand_name_en.ilike.%${s}%`)
        .limit(50),
      supabase
        .from("sourcing_contacts")
        .select("company_id")
        .ilike("email", `%${s}%`)
        .limit(50),
      supabase
        .from("sourcing_websites")
        .select("company_id")
        .ilike("url", `%${s}%`)
        .limit(50),
    ]);

    const matchingCompanyIds = new Set<string>();
    brandMatches.data?.forEach((r) => matchingCompanyIds.add(r.company_id));
    contactMatches.data?.forEach((r) => matchingCompanyIds.add(r.company_id));
    webMatches.data?.forEach((r) => matchingCompanyIds.add(r.company_id));

    if (matchingCompanyIds.size > 0) {
      const idList = Array.from(matchingCompanyIds).join(",");
      query = query.or(`company_name_kr.ilike.%${s}%,company_name_en.ilike.%${s}%,id.in.(${idList})`);
    } else {
      query = query.or(`company_name_kr.ilike.%${s}%,company_name_en.ilike.%${s}%`);
    }
  }

  const limit = params?.limit || 25;
  const offset = params?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`Failed to list sourcing companies: ${error.message}`);
  }

  return { data, total: count || 0 };
}

/**
 * Updates evaluation fields on a sourcing candidate.
 */
export async function updateSourcingEvaluation(
  id: string,
  evaluation: SourcingEvaluationInput,
  customClient?: SupabaseClient
) {
  const supabase = getClient(customClient);

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (evaluation.grade !== undefined) updates.grade = evaluation.grade;
  if (evaluation.status !== undefined) updates.status = evaluation.status;
  if (evaluation.assignedTo !== undefined) updates.assigned_to = evaluation.assignedTo;
  if (evaluation.internalNotes !== undefined) updates.internal_notes = evaluation.internalNotes;
  if (evaluation.businessTypes !== undefined) updates.business_types = evaluation.businessTypes;
  if (evaluation.marketingConsentStatus !== undefined) {
    updates.marketing_consent_status = evaluation.marketingConsentStatus;
  }

  if (evaluation.categories !== undefined || evaluation.companyTypeOtherExplanation !== undefined) {
    const { data: curr } = await supabase
      .from("sourcing_companies")
      .select("raw_payload_snapshot")
      .eq("id", id)
      .single();
    const currSnapshot = (curr?.raw_payload_snapshot as any) || {};
    updates.raw_payload_snapshot = {
      ...currSnapshot,
      ...(evaluation.categories !== undefined ? { categories: evaluation.categories } : {}),
      ...(evaluation.companyTypeOtherExplanation !== undefined ? { companyTypeOtherExplanation: evaluation.companyTypeOtherExplanation } : {}),
    };
  }

  if (evaluation.categories !== undefined) {
    await supabase.from("sourcing_brands").update({ categories: evaluation.categories }).eq("company_id", id);
  }

  const { data, error } = await supabase
    .from("sourcing_companies")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update sourcing evaluation: ${error.message}`);
  }

  return data;
}
