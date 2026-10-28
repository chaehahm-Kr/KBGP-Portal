import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  NormalizedCompanyDraft,
  SourcingEvaluationInput,
  DuplicateMatchResult,
  DuplicateMatchItem,
  DuplicateCheckCriteria,
  AdminDuplicateExceptionInput,
  LinkSourceResult,
  DuplicateAuditReport,
  SaveSourcingOptions,
  SourceConflictInfo,
} from "./types";
import {
  normalizeSourceUrl,
  extractExhibitorIdentifier,
  normalizeKoreanCompanyName,
  normalizeEnglishCompanyName,
  normalizeBrandName,
  normalizeWebsiteDomain,
  areCompanyNamesSimilar,
} from "./duplicate-detector";

export type {
  SourcingEvaluationInput,
  DuplicateMatchResult,
  DuplicateMatchItem,
  DuplicateCheckCriteria,
  AdminDuplicateExceptionInput,
  LinkSourceResult,
  DuplicateAuditReport,
};

export interface SourcingListParams {
  search?: string;
  grade?: string;
  category?: string;
  primaryCategories?: string[];
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
  const matches: DuplicateMatchItem[] = [];

  const rawSourceUrl = criteria.sourceUrl || criteria.canonicalSourceUrl || "";
  const canonicalUrl = rawSourceUrl ? normalizeSourceUrl(rawSourceUrl) : "";
  const exhibitorId = criteria.sourceIdentifier || (rawSourceUrl ? extractExhibitorIdentifier(rawSourceUrl) : null);

  const normKr = criteria.companyNameKr ? normalizeKoreanCompanyName(criteria.companyNameKr) : "";
  const normEn = criteria.companyNameEn ? normalizeEnglishCompanyName(criteria.companyNameEn) : "";

  // -------------------------------------------------------------
  // CRITERIA 1. COMPANY NAME (Korean OR English Normalized Exact Match)
  // -------------------------------------------------------------
  if (normKr) {
    const { data: compMatches } = await supabase
      .from("sourcing_companies")
      .select("id, company_name_kr, company_name_en, normalized_name_kr, status, grade, updated_at, primary_product_categories, primary_categories_confirmed")
      .limit(300);

    if (compMatches) {
      for (const c of compMatches) {
        const existingNorm = c.normalized_name_kr || normalizeKoreanCompanyName(c.company_name_kr);
        if (existingNorm && existingNorm === normKr) {
          if (!matches.some((m) => m.entityId === c.id && m.matchedField === "회사명")) {
            matches.push({
              matchType: "COMPANY_NAME_KR",
              severity: "POSSIBLE",
              matchedField: "회사명",
              matchedValue: c.company_name_kr,
              entityType: "SOURCING_CANDIDATE",
              entityId: c.id,
              entityName: c.company_name_kr,
              entityNameEn: c.company_name_en,
              reason: `기존 등록 회사명 일치 (${c.company_name_kr})`,
              status: c.status,
              grade: c.grade,
              lastActivityDate: c.updated_at,
              primaryProductCategories: c.primary_product_categories,
              primaryCategoriesConfirmed: c.primary_categories_confirmed,
            });
          }
        }
      }
    }

    // Check core companies table for existing registered partners
    const { data: partnerNameMatches } = await supabase
      .from("companies")
      .select("id, name")
      .ilike("name", `%${(criteria.companyNameKr || "").trim()}%`)
      .limit(10);

    if (partnerNameMatches) {
      for (const pm of partnerNameMatches) {
        const pNorm = normalizeKoreanCompanyName(pm.name);
        if (pNorm === normKr) {
          if (!matches.some((m) => m.entityId === pm.id && m.matchedField === "회사명")) {
            matches.push({
              matchType: "COMPANY_NAME_KR",
              severity: "POSSIBLE",
              matchedField: "회사명",
              matchedValue: pm.name,
              entityType: "PARTNER_COMPANY",
              entityId: pm.id,
              entityName: pm.name,
              reason: `기존 파트너사 등록 회사명 일치 (${pm.name})`,
            });
          }
        }
      }
    }
  }

  if (normEn) {
    const { data: compEnMatches } = await supabase
      .from("sourcing_companies")
      .select("id, company_name_kr, company_name_en, normalized_name_en, status, grade, updated_at")
      .not("company_name_en", "is", null)
      .limit(300);

    if (compEnMatches) {
      for (const c of compEnMatches) {
        if (!c.company_name_en) continue;
        const existingNormEn = c.normalized_name_en || normalizeEnglishCompanyName(c.company_name_en);
        if (existingNormEn && existingNormEn === normEn) {
          if (!matches.some((m) => m.entityId === c.id && m.matchedField === "회사명")) {
            matches.push({
              matchType: "COMPANY_NAME_EN",
              severity: "POSSIBLE",
              matchedField: "회사명",
              matchedValue: c.company_name_en,
              entityType: "SOURCING_CANDIDATE",
              entityId: c.id,
              entityName: c.company_name_kr,
              entityNameEn: c.company_name_en,
              reason: `기존 등록 영문 회사명 일치 (${c.company_name_en})`,
              status: c.status,
              grade: c.grade,
              lastActivityDate: c.updated_at,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // CRITERIA 2. BRAND NAME (Normalized Brand Name Exact Match)
  // -------------------------------------------------------------
  if (criteria.brands && criteria.brands.length > 0) {
    for (const b of criteria.brands) {
      const draftBrandKr = b.nameKr ? normalizeBrandName(b.nameKr) : "";
      const draftBrandEn = b.nameEn ? normalizeBrandName(b.nameEn) : "";

      if (!draftBrandKr && !draftBrandEn) continue;

      const { data: brandMatches } = await supabase
        .from("sourcing_brands")
        .select("company_id, brand_name_kr, brand_name_en, sourcing_companies(id, company_name_kr, company_name_en, status, grade, updated_at)")
        .limit(300);

      if (brandMatches) {
        for (const bm of brandMatches) {
          const comp = bm.sourcing_companies as any;
          if (!comp) continue;

          const exBrandKr = bm.brand_name_kr ? normalizeBrandName(bm.brand_name_kr) : "";
          const exBrandEn = bm.brand_name_en ? normalizeBrandName(bm.brand_name_en) : "";

          const isKrMatch = draftBrandKr && exBrandKr && draftBrandKr === exBrandKr;
          const isEnMatch = draftBrandEn && exBrandEn && draftBrandEn === exBrandEn;

          if (isKrMatch || isEnMatch) {
            const matchedBrandVal = isKrMatch ? bm.brand_name_kr : bm.brand_name_en;
            if (!matches.some((m) => m.entityId === bm.company_id && m.matchedField === "브랜드명" && m.matchedValue === matchedBrandVal)) {
              matches.push({
                matchType: "BRAND_NAME",
                severity: "POSSIBLE",
                matchedField: "브랜드명",
                matchedValue: matchedBrandVal || "",
                entityType: "SOURCING_CANDIDATE",
                entityId: bm.company_id,
                entityName: comp.company_name_kr,
                entityNameEn: comp.company_name_en,
                reason: `기존 등록 브랜드명 일치 (${matchedBrandVal})`,
                status: comp.status,
                grade: comp.grade,
                lastActivityDate: comp.updated_at,
              });
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // CRITERIA 3. CONTACT EMAIL (Case-insensitive trimmed exact match)
  // Ignore blank, invalid and placeholder emails
  // -------------------------------------------------------------
  if (criteria.emails && criteria.emails.length > 0) {
    const validEmails = criteria.emails
      .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter((e) => e.length > 3 && e.includes("@") && !["none", "n/a", "null", "undefined"].includes(e));

    for (const cleanEmail of validEmails) {
      const { data: contactMatches } = await supabase
        .from("sourcing_contacts")
        .select("company_id, email, sourcing_companies(id, company_name_kr, company_name_en, status, grade, updated_at)")
        .ilike("email", cleanEmail)
        .limit(10);

      if (contactMatches) {
        for (const cm of contactMatches) {
          const comp = cm.sourcing_companies as any;
          if (!comp) continue;
          if (!matches.some((m) => m.entityId === cm.company_id && m.matchedField === "담당자 이메일" && m.matchedValue === cleanEmail)) {
            matches.push({
              matchType: "EMAIL",
              severity: "POSSIBLE",
              matchedField: "담당자 이메일",
              matchedValue: cleanEmail,
              entityType: "SOURCING_CANDIDATE",
              entityId: cm.company_id,
              entityName: comp.company_name_kr,
              entityNameEn: comp.company_name_en,
              reason: `기존 등록 담당자 이메일 일치 (${cleanEmail})`,
              status: comp.status,
              grade: comp.grade,
              lastActivityDate: comp.updated_at,
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // SOURCE URL COLLISION (Handled independently as data-integrity check)
  // NOT a company duplicate match!
  // -------------------------------------------------------------
  let sourceConflict: SourceConflictInfo | null = null;
  if (canonicalUrl || exhibitorId) {
    let query = supabase
      .from("sourcing_sources")
      .select("company_id, source_url, canonical_source_url, source_identifier, sourcing_companies(id, company_name_kr, company_name_en)");

    if (canonicalUrl && exhibitorId) {
      query = query.or(`canonical_source_url.eq.${canonicalUrl},source_identifier.eq.${exhibitorId}`);
    } else if (canonicalUrl) {
      query = query.or(`canonical_source_url.eq.${canonicalUrl},source_url.ilike.%${canonicalUrl.replace(/^https?:\/\//, "")}%`);
    } else if (exhibitorId) {
      query = query.eq("source_identifier", exhibitorId);
    }

    const { data: sourceMatches } = await query.limit(1);
    if (sourceMatches && sourceMatches.length > 0) {
      const sm = sourceMatches[0];
      const comp = sm.sourcing_companies as any;
      sourceConflict = {
        hasConflict: true,
        existingCompanyId: sm.company_id,
        existingCompanyName: comp?.company_name_kr || "기존 등록 회사",
        sourceUrl: sm.source_url,
        canonicalSourceUrl: sm.canonical_source_url || canonicalUrl,
        reason: "동일한 전시회/소스 URL이 이미 기존 회사에 등록되어 있습니다.",
      };
    }
  }

  // Enrich matched candidate records with counts
  for (const m of matches) {
    if (m.entityType === "SOURCING_CANDIDATE") {
      const [contactsRes, brandsRes] = await Promise.all([
        supabase.from("sourcing_contacts").select("id", { count: "exact", head: true }).eq("company_id", m.entityId),
        supabase.from("sourcing_brands").select("id", { count: "exact", head: true }).eq("company_id", m.entityId),
      ]);
      m.contactsCount = contactsRes.count || 0;
      m.brandsCount = brandsRes.count || 0;
    }
  }

  return {
    isDuplicate: matches.length > 0,
    hasStrongDuplicate: false,
    hasPossibleDuplicate: matches.length > 0,
    isExistingPartner: matches.some((m) => m.entityType === "PARTNER_COMPANY"),
    matches,
    sourceConflict,
  };
}

/**
 * Saves a NormalizedCompanyDraft into dedicated sourcing tables with
 * server-side duplicate detection, non-blocking admin confirmation auditing,
 * and safe source collision handling without violating unique constraints.
 */
export async function saveSourcingDraft(
  draft: NormalizedCompanyDraft,
  evaluation?: SourcingEvaluationInput,
  options?: SaveSourcingOptions,
  customClient?: SupabaseClient
): Promise<{ success: boolean; companyId: string }> {
  const supabase = getClient(customClient);

  const canonicalSourceUrl = normalizeSourceUrl(draft.source.sourceUrl);
  const normalizedNameKr = normalizeKoreanCompanyName(draft.company.nameKr);
  const normalizedNameEn = draft.company.nameEn ? normalizeEnglishCompanyName(draft.company.nameEn) : null;

  // 1. Source URL Collision Check (Data Integrity Check)
  let hasSourceConflict = false;
  let conflictingSourceCompanyId: string | null = null;
  let conflictingSourceCompanyName: string | null = null;

  const sourceIdentifier = draft.source.sourceIdentifier?.trim() || null;

  if (canonicalSourceUrl || sourceIdentifier) {
    let query = supabase
      .from("sourcing_sources")
      .select("company_id, source_url, canonical_source_url, source_identifier, sourcing_companies(id, company_name_kr)");

    if (canonicalSourceUrl && sourceIdentifier) {
      query = query.or(`canonical_source_url.eq.${canonicalSourceUrl},source_identifier.eq.${sourceIdentifier}`);
    } else if (canonicalSourceUrl) {
      query = query.eq("canonical_source_url", canonicalSourceUrl);
    } else if (sourceIdentifier) {
      query = query.eq("source_identifier", sourceIdentifier);
    }

    const { data: existingSources } = await query.limit(1);

    if (existingSources && existingSources.length > 0) {
      hasSourceConflict = true;
      conflictingSourceCompanyId = existingSources[0].company_id;
      conflictingSourceCompanyName = (existingSources[0].sourcing_companies as any)?.company_name_kr || "기존 회사";
    }
  }

  // 2. Company Duplicate Pre-Save Guard (Strict 3 criteria: Name, Brand, Email)
  // If not explicitly confirmed and duplicate exists, block and require confirmation.
  if (!options?.allowDuplicateConfirmed && !options?.exception) {
    const dupCheck = await findDuplicateCandidates(
      {
        companyNameKr: draft.company.nameKr,
        companyNameEn: draft.company.nameEn,
        brands: draft.brands.map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn })),
        emails: draft.contacts.map((c) => c.email),
      },
      supabase
    );

    if (dupCheck.isDuplicate) {
      const matchedNames = Array.from(new Set(dupCheck.matches.map((m) => m.entityName))).join(", ");
      const matchedFields = Array.from(new Set(dupCheck.matches.map((m) => m.matchedField || "일치 정보"))).join(", ");
      throw new Error(
        `[DUPLICATE_COMPANY_CONFIRMATION_REQUIRED] 중복 가능성이 있는 회사입니다. (일치 회사: "${matchedNames}", 일치 항목: ${matchedFields}). 신규 회사로 등록하려면 확인을 진행해 주세요.`
      );
    }
  }

  // 3. Prepare notes and disputed source metadata if source URL collision occurred
  const baseNotes = evaluation?.internalNotes || draft.company.descriptionKr || "";
  const sourceCollisionNote = hasSourceConflict
    ? `\n\n[SOURCE_URL_COLLISION]: 전시회 소스 URL/식별자(${canonicalSourceUrl || sourceIdentifier})가 기존 회사 "${conflictingSourceCompanyName}"(ID: ${conflictingSourceCompanyId})에 이미 등록되어 있어, 독립된 신규 법인으로 등록하고 소스 원천은 unlinked reference로 안전하게 보존되었습니다.`
    : "";
  const combinedInternalNotes = (baseNotes + sourceCollisionNote).trim() || null;

  // 4. Insert Sourcing Company Master
  const { data: company, error: companyErr } = await supabase
    .from("sourcing_companies")
    .insert({
      company_name_kr: draft.company.nameKr,
      company_name_en: draft.company.nameEn,
      normalized_name_kr: normalizedNameKr,
      normalized_name_en: normalizedNameEn,
      description_kr: draft.company.descriptionKr,
      description_en: draft.company.descriptionEn,
      business_types: evaluation?.businessTypes || draft.company.businessTypes || [],
      business_type_evidence: evaluation?.businessTypeEvidence || draft.company.businessTypeEvidence || [],
      primary_product_categories: evaluation?.primaryProductCategories || draft.company.primaryProductCategories || [],
      primary_categories_confirmed: evaluation?.primaryCategoriesConfirmed ?? draft.company.primaryCategoriesConfirmed ?? false,
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
      internal_notes: combinedInternalNotes,
      marketing_consent_status: evaluation?.marketingConsentStatus || "UNCONFIRMED",
      raw_payload_snapshot: {
        ...(draft.source.rawPayloadSnapshot || {}),
        categories: draft.categories || [],
        companyProducts: draft.companyProducts || [],
        documents: evaluation?.documents || draft.companyDocuments || [],
        companyTypeOtherExplanation: evaluation?.companyTypeOtherExplanation || null,
        disputedSource: hasSourceConflict
          ? {
              provider: draft.source.provider,
              sourceUrl: draft.source.sourceUrl,
              canonicalSourceUrl: canonicalSourceUrl,
              sourceIdentifier: draft.source.sourceIdentifier,
              eventEditionId: draft.source.eventEditionId,
              standLocation: draft.source.standLocation,
              conflictingCompanyId: conflictingSourceCompanyId,
              conflictingCompanyName: conflictingSourceCompanyName,
              notedAt: new Date().toISOString(),
            }
          : null,
      },
      audit_summary: draft.audit,
    })
    .select("id")
    .single();

  if (companyErr || !company) {
    throw new Error(`Failed to insert sourcing company: ${companyErr?.message || "Unknown error"}`);
  }

  const companyId = company.id;

  // 5. Record Admin Duplicate Exception Audit
  const matchedCompId = options?.matchedCompanyIds?.[0] || options?.exception?.matchedCompanyId;
  if ((options?.allowDuplicateConfirmed || options?.exception) && matchedCompId) {
    let matchedRule: "SAME_NAME_KR" | "SAME_NAME_EN" | "SAME_DOMAIN" | "SIMILAR_NAME" | "OTHER" = "OTHER";
    if (options?.exception?.matchedRule) {
      matchedRule = options.exception.matchedRule;
    } else if (options?.matchedFields?.includes("회사명")) {
      matchedRule = normalizedNameKr ? "SAME_NAME_KR" : "SAME_NAME_EN";
    }

    const excReason =
      options?.exception?.reason ||
      `Admin confirmed duplicate registration despite matching fields: ${(options?.matchedFields || ["확인 완료"]).join(", ")}`;

    const { error: excErr } = await supabase
      .from("sourcing_duplicate_exceptions")
      .insert({
        company_id: companyId,
        matched_company_id: matchedCompId,
        matched_rule: matchedRule,
        reason: excReason,
        evidence: {
          matchedCompanyIds: options?.matchedCompanyIds || [matchedCompId],
          matchedFields: options?.matchedFields || [],
          ...(options?.exception?.evidence || {}),
        },
        approved_by: options?.adminUserId || null,
      });

    if (excErr) {
      if (excErr.code === "23503" && excErr.message.includes("approved_by")) {
        const { error: retryErr } = await supabase
          .from("sourcing_duplicate_exceptions")
          .insert({
            company_id: companyId,
            matched_company_id: matchedCompId,
            matched_rule: matchedRule,
            reason: excReason,
            evidence: {
              matchedCompanyIds: options?.matchedCompanyIds || [matchedCompId],
              matchedFields: options?.matchedFields || [],
              ...(options?.exception?.evidence || {}),
            },
            approved_by: null,
          });
        if (retryErr) {
          console.warn("Failed to insert duplicate exception record after null approved_by fallback:", retryErr.message);
        }
      } else {
        console.warn("Failed to insert duplicate exception record:", excErr.message);
      }
    }
  }

  // 6. Insert Brands
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

  // 7. Insert Contacts
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

  // 8. Insert Websites
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

  // 9. Insert Source Provenance (ONLY if no conflict on canonical source URL)
  // If source conflict exists, provenance is safely recorded in raw_payload_snapshot.disputedSource
  // and internal_notes without violating uq_sourcing_sources_canonical_url.
  if (!hasSourceConflict) {
    const { error: sourceErr } = await supabase.from("sourcing_sources").insert({
      company_id: companyId,
      provider: draft.source.provider,
      source_url: draft.source.sourceUrl,
      canonical_source_url: canonicalSourceUrl,
      source_identifier: draft.source.sourceIdentifier,
      event_edition_id: draft.source.eventEditionId,
      stand_location: draft.source.standLocation,
      raw_payload: draft.source.rawPayloadSnapshot || null,
      collected_at: draft.source.collectedAt,
    });

    if (sourceErr) {
      await supabase.from("sourcing_companies").delete().eq("id", companyId);
      if (sourceErr.code === "23505" || sourceErr.message.includes("unique")) {
        throw new Error(
          `[DUPLICATE_SOURCE_URL] 이미 등록된 동일한 소스 URL 또는 식별자가 존재합니다. (${sourceErr.message})`
        );
      }
      throw new Error(`Failed to insert sourcing source provenance: ${sourceErr.message}`);
    }
  }

  return { success: true, companyId };
}

export async function linkSourcingSource(
  input: {
    targetCompanyId: string;
    draft: NormalizedCompanyDraft;
    overrideReason?: string;
    adminUserId?: string | null;
    adminUserEmail?: string | null;
  },
  customClient?: SupabaseClient
): Promise<LinkSourceResult> {
  const supabase = getClient(customClient);
  const { targetCompanyId, draft, overrideReason, adminUserId, adminUserEmail } = input;

  // 1. Fetch existing company to verify existence and preserve verified fields
  const { data: existingCompany, error: compErr } = await supabase
    .from("sourcing_companies")
    .select(`
      id, company_name_kr, company_name_en, status, grade, internal_notes,
      sourcing_sources(id, canonical_source_url, source_identifier),
      sourcing_contacts(id, email),
      sourcing_websites(id, url),
      sourcing_brands(id, brand_name_kr)
    `)
    .eq("id", targetCompanyId)
    .single();

  if (compErr || !existingCompany) {
    throw new Error(`Target company not found: ${targetCompanyId}`);
  }

  const canonicalUrl = normalizeSourceUrl(draft.source.sourceUrl);

  // 2. Insert new source into sourcing_sources
  const alreadyHasSource = (existingCompany.sourcing_sources || []).some(
    (s: any) =>
      (canonicalUrl && s.canonical_source_url === canonicalUrl) ||
      (draft.source.sourceIdentifier && s.source_identifier === draft.source.sourceIdentifier)
  );

  let sourcesAdded = 0;
  if (!alreadyHasSource) {
    const { error: srcErr } = await supabase.from("sourcing_sources").insert({
      company_id: targetCompanyId,
      provider: draft.source.provider,
      source_url: draft.source.sourceUrl,
      canonical_source_url: canonicalUrl,
      source_identifier: draft.source.sourceIdentifier,
      event_edition_id: draft.source.eventEditionId,
      stand_location: draft.source.standLocation,
      raw_payload: draft.source.rawPayloadSnapshot || null,
      collected_at: draft.source.collectedAt,
    });
    if (srcErr) {
      console.warn("Failed to link sourcing source:", srcErr.message);
    } else {
      sourcesAdded++;
    }
  }

  // 3. Additive contacts (deduplicate by lowercase email)
  const existingEmails = new Set(
    (existingCompany.sourcing_contacts || []).map((c: any) => c.email.toLowerCase().trim())
  );
  let contactsAdded = 0;
  for (const c of draft.contacts || []) {
    const cleanEmail = c.email?.toLowerCase().trim();
    if (cleanEmail && !existingEmails.has(cleanEmail)) {
      const { error: cErr } = await supabase.from("sourcing_contacts").insert({
        company_id: targetCompanyId,
        name: c.name,
        department: c.department,
        job_title: c.jobTitle,
        email: cleanEmail,
        phone: c.phone,
        is_primary: false, // Never overwrite existing primary contact
        source: c.source,
        source_url: c.sourceUrl,
      });
      if (!cErr) {
        contactsAdded++;
        existingEmails.add(cleanEmail);
      }
    }
  }

  // 4. Additive websites (deduplicate by normalized domain)
  const existingDomains = new Set(
    (existingCompany.sourcing_websites || []).map((w: any) => normalizeWebsiteDomain(w.url))
  );
  let websitesAdded = 0;
  for (const w of draft.websites || []) {
    const normDom = normalizeWebsiteDomain(w.url);
    if (normDom && !existingDomains.has(normDom)) {
      const { error: wErr } = await supabase.from("sourcing_websites").insert({
        company_id: targetCompanyId,
        url: w.url,
        label: w.label,
        is_primary: false, // Never overwrite existing primary website
        source: w.source,
      });
      if (!wErr) {
        websitesAdded++;
        existingDomains.add(normDom);
      }
    }
  }

  // 5. Additive brands (deduplicate by normalized brand name)
  const existingBrandNames = new Set(
    (existingCompany.sourcing_brands || []).map((b: any) => normalizeKoreanCompanyName(b.brand_name_kr))
  );
  let brandsAdded = 0;
  for (const b of draft.brands || []) {
    const normBrand = normalizeKoreanCompanyName(b.nameKr);
    if (normBrand && !existingBrandNames.has(normBrand)) {
      const { error: bErr } = await supabase.from("sourcing_brands").insert({
        company_id: targetCompanyId,
        brand_name_kr: b.nameKr,
        brand_name_en: b.nameEn,
        description: b.description,
        categories: b.categories || [],
        key_products: b.keyProducts || [],
        source: b.source,
      });
      if (!bErr) {
        brandsAdded++;
        existingBrandNames.add(normBrand);
      }
    }
  }

  // 6. Record audit trail in internal_notes without overwriting verified fields
  const linkNote =
    `[SOURCE LINKED - ${new Date().toISOString()} by ${adminUserEmail || adminUserId || "Admin"}]: ` +
    `Linked source ${draft.source.sourceUrl} (${draft.source.provider}). ` +
    `Added: ${sourcesAdded} source(s), ${brandsAdded} brand(s), ${contactsAdded} contact(s), ${websitesAdded} website(s).` +
    (overrideReason ? ` Reason: ${overrideReason}` : "");

  const updatedNotes = existingCompany.internal_notes
    ? `${existingCompany.internal_notes}\n\n${linkNote}`
    : linkNote;

  await supabase
    .from("sourcing_companies")
    .update({
      internal_notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetCompanyId);

  return {
    success: true,
    companyId: targetCompanyId,
    companyNameKr: existingCompany.company_name_kr,
    sourcesAdded,
    brandsAdded,
    contactsAdded,
    websitesAdded,
    message: `기존 회사 "${existingCompany.company_name_kr}"에 새 소스가 성공적으로 연결되었습니다.`,
  };
}

/**
 * Generates a comprehensive read-only audit report of existing sourcing duplicates.
 * Scans canonical source URLs, normalized company names, and domains across the entire database.
 */
export async function getSourcingDuplicateAuditReport(
  customClient?: SupabaseClient
): Promise<DuplicateAuditReport> {
  const supabase = getClient(customClient);

  // 1. Fetch all companies with related counts
  const { data: companies } = await supabase
    .from("sourcing_companies")
    .select(`
      id, company_name_kr, company_name_en, status, grade, created_at,
      sourcing_sources(id, source_url, canonical_source_url),
      sourcing_contacts(id),
      sourcing_brands(id),
      marketing_campaign_recipients(id),
      sourcing_company_activities(id)
    `);

  // 2. Fetch all sources
  const { data: sources } = await supabase
    .from("sourcing_sources")
    .select("id, company_id, source_url, canonical_source_url, sourcing_companies(id, company_name_kr)");

  // 3. Fetch all websites
  const { data: websites } = await supabase
    .from("sourcing_websites")
    .select("id, company_id, url, sourcing_companies(id, company_name_kr)");

  // Audit A: Duplicate Canonical Source URLs
  const urlMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const s of sources || []) {
    const rawUrl = s.canonical_source_url || normalizeSourceUrl(s.source_url);
    if (rawUrl) {
      const list = urlMap.get(rawUrl) || [];
      const comp = s.sourcing_companies as any;
      list.push({ id: s.company_id, name: comp?.company_name_kr || "Unknown" });
      urlMap.set(rawUrl, list);
    }
  }

  const confirmedDuplicateUrlGroups = Array.from(urlMap.entries())
    .filter(([_, comps]) => comps.length > 1)
    .map(([url, comps]) => ({
      canonicalUrl: url,
      companyIds: comps.map((c) => c.id),
      companyNames: comps.map((c) => c.name),
    }));

  // Audit B: Potential Duplicate Company Name Groups
  const nameMap = new Map<string, Array<any>>();
  for (const c of companies || []) {
    const norm = normalizeKoreanCompanyName(c.company_name_kr);
    if (norm) {
      const list = nameMap.get(norm) || [];
      list.push({
        id: c.id,
        nameKr: c.company_name_kr,
        nameEn: c.company_name_en,
        status: c.status,
        grade: c.grade,
        createdAt: c.created_at,
        sourcesCount: (c.sourcing_sources as any[])?.length || 0,
        contactsCount: (c.sourcing_contacts as any[])?.length || 0,
        brandsCount: (c.sourcing_brands as any[])?.length || 0,
        campaignsCount: (c.marketing_campaign_recipients as any[])?.length || 0,
        activitiesCount: (c.sourcing_company_activities as any[])?.length || 0,
      });
      nameMap.set(norm, list);
    }
  }

  const potentialDuplicateCompanyGroups = Array.from(nameMap.entries())
    .filter(([_, comps]) => comps.length > 1)
    .map(([norm, comps]) => ({
      normalizedName: norm,
      companies: comps,
    }));

  // Audit C: Duplicate Domain Groups
  const domainMap = new Map<string, Array<{ id: string; nameKr: string }>>();
  for (const w of websites || []) {
    const dom = normalizeWebsiteDomain(w.url);
    if (dom) {
      const list = domainMap.get(dom) || [];
      const comp = w.sourcing_companies as any;
      if (!list.some((item) => item.id === w.company_id)) {
        list.push({ id: w.company_id, nameKr: comp?.company_name_kr || "Unknown" });
      }
      domainMap.set(dom, list);
    }
  }

  const duplicateDomainGroups = Array.from(domainMap.entries())
    .filter(([_, comps]) => comps.length > 1)
    .map(([domain, comps]) => ({
      domain,
      companies: comps,
    }));

  return {
    generatedAt: new Date().toISOString(),
    totalCompanies: companies?.length || 0,
    totalSources: sources?.length || 0,
    totalWebsites: websites?.length || 0,
    confirmedDuplicateUrlGroups,
    potentialDuplicateCompanyGroups,
    duplicateDomainGroups,
    remediationRecommendation:
      potentialDuplicateCompanyGroups.length > 0
        ? `감사 결과 ${potentialDuplicateCompanyGroups.length}개의 잠재적 중복 법인 그룹이 발견되었습니다. ` +
          `기존 데이터 무결성을 보호하기 위해 자동 삭제/병합하지 마시고, 관리자 검토 후 필요시 소스 연결(Link New Source) 또는 레코드 정리를 안전하게 진행하세요.`
        : "감사 결과 확인된 중복 URL 및 중복 법인이 없습니다.",
  };
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

  const companyDocuments: any[] = Array.isArray(rawSnapshot.documents) ? rawSnapshot.documents : [];

  return {
    ...company,
    categories: companyCategories,
    companyCategories,
    companyProducts,
    companyDocuments,
    documents: companyDocuments,
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
    business_type_evidence: evaluation?.businessTypeEvidence || draft.company.businessTypeEvidence,
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
      documents: evaluation?.documents || draft.companyDocuments || [],
      companyTypeOtherExplanation: evaluation?.companyTypeOtherExplanation || null,
    },
    audit_summary: draft.audit,
    updated_at: new Date().toISOString(),
  };

  if (evaluation?.grade) companyUpdates.grade = evaluation.grade;
  if (evaluation?.status) companyUpdates.status = evaluation.status;
  if (evaluation?.assignedTo !== undefined) companyUpdates.assigned_to = evaluation.assignedTo;
  if (evaluation?.internalNotes !== undefined) companyUpdates.internal_notes = evaluation.internalNotes;
  if (evaluation?.primaryProductCategories !== undefined) {
    companyUpdates.primary_product_categories = evaluation.primaryProductCategories;
    companyUpdates.primary_categories_confirmed = evaluation.primaryCategoriesConfirmed ?? true;
  }
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
      business_type_evidence,
      primary_product_categories,
      primary_categories_confirmed,
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

  // Primary Product Category filter (multi-value, ADM-BSRC-011)
  if (params?.primaryCategories && params.primaryCategories.length > 0) {
    const hasUnclassified = params.primaryCategories.includes("UNCLASSIFIED");
    const realCats = params.primaryCategories.filter((c) => c !== "UNCLASSIFIED");

    if (hasUnclassified && realCats.length > 0) {
      query = query.or(
        `primary_product_categories.ov.{${realCats.join(",")}},primary_product_categories.eq.{}`
      );
    } else if (hasUnclassified) {
      query = query.eq("primary_product_categories", "{}");
    } else {
      query = query.overlaps("primary_product_categories", realCats);
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
  if (evaluation.businessTypeEvidence !== undefined) updates.business_type_evidence = evaluation.businessTypeEvidence;
  if (evaluation.primaryProductCategories !== undefined) {
    updates.primary_product_categories = evaluation.primaryProductCategories;
    updates.primary_categories_confirmed = evaluation.primaryCategoriesConfirmed ?? true;
  }
  if (evaluation.marketingConsentStatus !== undefined) {
    updates.marketing_consent_status = evaluation.marketingConsentStatus;
  }

  if (
    evaluation.categories !== undefined ||
    evaluation.companyTypeOtherExplanation !== undefined ||
    evaluation.documents !== undefined
  ) {
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
      ...(evaluation.documents !== undefined ? { documents: evaluation.documents } : {}),
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
