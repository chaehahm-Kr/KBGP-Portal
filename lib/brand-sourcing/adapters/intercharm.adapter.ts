import { SourceAdapter } from "./base.adapter";
import {
  NormalizedCompanyDraft,
  ExtractionOptions,
  SourcingProvider,
  BusinessType,
  BusinessTypeEvidence,
  ClassificationStatus,
  SourcingDocumentItem,
  SourcingDocumentType,
  SourcingBrand,
  SourcingContact,
  SourcingWebsite,
  SourcingSocialMedia,
  SourcingAddress,
  SourcingProductItem,
} from "../types";
import { validateIntercharmUrl, sanitizeText, sanitizeParagraphs } from "../security";
import { SourceExtractionError } from "../errors";
import { enrichFromOfficialWebsite } from "../enrichment/website-enricher";
import { recommendPrimaryProductCategories } from "../category-classifier";

const DEFAULT_EVENT_EDITION_ID = "eve-183fb719-cde8-4b12-b83a-bf0e1c74384c";
const DEFAULT_CLIENT_ID = "uhQVcmxLwXAjVtVpTvoerERiZSsNz0om";
const GRAPHQL_ENDPOINT = "https://api.reedexpo.com/graphql/";

const EXHIBITOR_QUERY = `
query GetExhibitor($eventEditionId: String!, $organisationId: String!) {
  exhibitingOrganisation(eventEditionId: $eventEditionId, organisationId: $organisationId) {
    id
    companyName
    contactEmail
    website
    phone
    hideAddress
    organisationId
    socialMedia {
      name
      url
    }
    multilingual {
      locale
      displayName
      description
      showObjective
      representedBrands {
        name
      }
      addressLine1
      addressLine2
      city
      stateProvince
      countryCode
      country
      postcode
    }
    products(includeUnpublished: false) {
      id
      imageUrl
      multilingual {
        locale
        title
        description
      }
    }
    filterCategories {
      multilingual {
        locale
        name
      }
      responses {
        answerId
        multilingual {
          locale
          name
        }
      }
    }
    stands {
      name
    }
  }
}
`;

interface RawExhibitingOrg {
  id: string;
  companyName: string | null;
  contactEmail: string | null;
  website: string | null;
  phone: string | null;
  hideAddress: boolean;
  organisationId: string;
  socialMedia?: Array<{ name: string; url: string }>;
  multilingual?: Array<{
    locale: string;
    displayName: string | null;
    description: string | null;
    showObjective: string | null;
    representedBrands?: Array<{ name: string }>;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    countryCode?: string | null;
    country?: string | null;
    postcode?: string | null;
  }>;
  products?: Array<{
    id: string;
    imageUrl?: string | null;
    multilingual?: Array<{
      locale: string;
      title: string | null;
      description: string | null;
    }>;
  }>;
  filterCategories?: Array<{
    multilingual?: Array<{ locale: string; name: string }>;
    responses?: Array<{
      answerId: string;
      multilingual?: Array<{ locale: string; name: string }>;
    }>;
  }>;
  stands?: Array<{ name: string }>;
}

export class IntercharmAdapter implements SourceAdapter {
  readonly provider: SourcingProvider = "INTERCHARM";

  canHandle(url: string): boolean {
    try {
      validateIntercharmUrl(url);
      return true;
    } catch {
      return false;
    }
  }

  async extract(rawUrl: string, options?: ExtractionOptions): Promise<NormalizedCompanyDraft> {
    const { url, orgId } = validateIntercharmUrl(rawUrl);

    const fetchImpl = options?.customFetch || fetch;
    const timeoutMs = options?.timeoutMs || 10000;

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    let rawOrg: RawExhibitingOrg | null = null;
    let rawPayloadSnapshot: unknown = null;

    try {
      const response = await fetchImpl(GRAPHQL_ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-clientid": DEFAULT_CLIENT_ID,
          Referer: "https://www.intercharmkorea.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          query: EXHIBITOR_QUERY,
          variables: {
            eventEditionId: DEFAULT_EVENT_EDITION_ID,
            organisationId: orgId,
          },
        }),
      });

      if (!response.ok) {
        throw new SourceExtractionError(
          `GraphQL request failed with HTTP status ${response.status} ${response.statusText}`,
          this.provider,
          { orgId, status: response.status }
        );
      }

      const json = await response.json();
      rawPayloadSnapshot = json;

      if (json.errors && json.errors.length > 0) {
        throw new SourceExtractionError(
          `GraphQL returned errors: ${json.errors.map((e: any) => e.message).join("; ")}`,
          this.provider,
          json.errors
        );
      }

      rawOrg = json.data?.exhibitingOrganisation || null;
      if (!rawOrg) {
        throw new SourceExtractionError(
          `No exhibitingOrganisation found for organization ID '${orgId}'`,
          this.provider,
          { orgId }
        );
      }
    } catch (err: any) {
      if (err instanceof SourceExtractionError) throw err;
      throw new SourceExtractionError(
        `Failed to fetch InterCHARM data: ${err.message || String(err)}`,
        this.provider,
        err
      );
    } finally {
      clearTimeout(timeoutTimer);
    }

    // Fetch official exhibitor documents if available (Public Reed Exhibitions REST API)
    let companyDocuments: SourcingDocumentItem[] = [];
    try {
      const docEndpoint = `https://api.reedexpo.com/v1/documents/public?organisationGuid=${orgId}&eventEditionId=${DEFAULT_EVENT_EDITION_ID}`;
      const docRes = await fetchImpl(docEndpoint, {
        headers: {
          "x-clientid": DEFAULT_CLIENT_ID,
          Referer: "https://www.intercharmkorea.com/",
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (docRes.ok) {
        const docJson = await docRes.json();
        if (Array.isArray(docJson)) {
          for (const d of docJson) {
            if (d.url && d.displayName) {
              let fType: SourcingDocumentType = "OTHER";
              const lower = d.displayName.toLowerCase();
              if (lower.includes("catalog") || lower.includes("카탈로그") || lower.includes("카달로그")) {
                fType = "CATALOG";
              } else if (
                lower.includes("brochure") ||
                lower.includes("브로슈어") ||
                lower.includes("리플렛") ||
                lower.includes("leaflet")
              ) {
                fType = "BROCHURE";
              } else if (lower.includes("cert") || lower.includes("인증")) {
                fType = "CERTIFICATE";
              } else if (lower.includes("profile") || lower.includes("소개서")) {
                fType = "COMPANY_PROFILE";
              }
              companyDocuments.push({
                id: String(d.id || crypto.randomUUID()),
                title: sanitizeText(d.displayName) || "Exhibitor Document",
                fileUrl: d.url,
                fileType: fType,
                fileSize: typeof d.size === "number" ? d.size : null,
                thumbnailUrl: d.thumbnailUrl || null,
                source: "SOURCE_EXHIBITION",
                sourceUrl: rawUrl,
                uploadedAt: d.createdAt || new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (docErr) {
      console.warn("Failed to fetch InterCHARM documents (non-blocking):", docErr);
    }

    return this.mapToNormalizedDraft(
      rawOrg,
      rawUrl,
      orgId,
      rawPayloadSnapshot,
      companyDocuments,
      options
    );
  }

  private async mapToNormalizedDraft(
    rawOrg: RawExhibitingOrg,
    sourceUrl: string,
    orgId: string,
    rawPayloadSnapshot: unknown,
    companyDocuments: SourcingDocumentItem[],
    options?: ExtractionOptions
  ): Promise<NormalizedCompanyDraft> {
    const multi = rawOrg.multilingual || [];
    const koEntry = multi.find((m) => m.locale.toLowerCase().startsWith("ko"));
    const enEntry = multi.find((m) => m.locale.toLowerCase().startsWith("en"));
    const defaultEntry = koEntry || enEntry || multi[0] || null;

    // 1. Company Name Mapping
    // Raw companyName from InterCHARM is typically the legal Korean name e.g. "(주)제이코모" or "주식회사 동동구리무"
    const rawCompanyName = sanitizeText(rawOrg.companyName) || "";
    const koDisplayName = sanitizeText(koEntry?.displayName);
    const enDisplayName = sanitizeText(enEntry?.displayName);

    const nameKr = rawCompanyName || koDisplayName || "Unknown Company";
    const nameEn = enDisplayName && enDisplayName !== nameKr ? enDisplayName : null;

    // 2. Descriptions (Preserve multi-line paragraph structure from exhibitor details)
    const descriptionKr = sanitizeParagraphs(koEntry?.description) || null;
    const descriptionEn = sanitizeParagraphs(enEntry?.description) || null;

    // 3. Address Mapping
    const address = this.buildAddress(koEntry, enEntry, rawOrg.hideAddress);

    // 4. Business Type & Evidence Extraction
    const { businessTypes, evidence } = this.classifyBusinessTypes(
      rawOrg,
      descriptionKr,
      descriptionEn,
      sourceUrl
    );

    // 5. Contacts (Strictly ignore organizer footer emails)
    const contacts: SourcingContact[] = [];
    const contactEmail = sanitizeText(rawOrg.contactEmail);
    const phone = sanitizeText(rawOrg.phone);

    if (contactEmail && !this.isOrganizerContact(contactEmail)) {
      contacts.push({
        name: null,
        department: null,
        jobTitle: null,
        email: contactEmail,
        phone: phone || null,
        isPrimary: true,
        source: "SOURCE_EXHIBITION",
        sourceUrl,
      });
    }

    // 6. Websites
    const websites: SourcingWebsite[] = [];
    const rawWebsite = sanitizeText(rawOrg.website);
    if (rawWebsite) {
      const normalizedWeb = this.normalizeUrl(rawWebsite);
      if (normalizedWeb) {
        websites.push({
          url: normalizedWeb,
          label: "OFFICIAL",
          source: "SOURCE_EXHIBITION",
        });
      }
    }

    // 7. Social Media
    const socialMedia: SourcingSocialMedia[] = [];
    if (rawOrg.socialMedia) {
      for (const sm of rawOrg.socialMedia) {
        const platform = this.normalizeSocialPlatform(sm.name);
        const url = sanitizeText(sm.url);
        if (url) {
          socialMedia.push({ platform, url });
        }
      }
    }

    // 8. Categories
    const categoriesSet = new Set<string>();
    if (rawOrg.filterCategories) {
      for (const fc of rawOrg.filterCategories) {
        if (fc.responses) {
          for (const resp of fc.responses) {
            const koName = resp.multilingual?.find((m) => m.locale.startsWith("ko"))?.name;
            const enName = resp.multilingual?.find((m) => m.locale.startsWith("en"))?.name;
            const catName = sanitizeText(koName || enName);
            if (catName) {
              categoriesSet.add(catName);
            }
          }
        }
      }
    }
    const categories = Array.from(categoriesSet);

    // 9. Company-Level Extracted Products
    const companyProducts: SourcingProductItem[] = [];
    if (rawOrg.products) {
      for (const p of rawOrg.products) {
        const pKo = p.multilingual?.find((m) => m.locale.startsWith("ko"));
        const pEn = p.multilingual?.find((m) => m.locale.startsWith("en"));
        companyProducts.push({
          id: p.id,
          titleKr: sanitizeText(pKo?.title || pEn?.title),
          titleEn: sanitizeText(pEn?.title || pKo?.title),
          description: sanitizeParagraphs(pKo?.description || pEn?.description),
          imageUrl: p.imageUrl ? sanitizeText(p.imageUrl) : null,
        });
      }
    }

    // 10. Brands & Brand-Specific Product Attribution
    const brands = this.buildBrands(rawOrg, koEntry, enEntry, categories, companyProducts);

    // 11. Stands
    const standLocation = rawOrg.stands && rawOrg.stands.length > 0 ? rawOrg.stands[0].name : null;

    // 12. Initial Audit Notes
    const missingKeyFields: string[] = [];
    if (!contacts.length) missingKeyFields.push("contactEmail");
    if (!websites.length) missingKeyFields.push("website");
    if (!descriptionKr && !descriptionEn) missingKeyFields.push("description");

    const auditStatus =
      missingKeyFields.length === 0
        ? "SUCCESS"
        : missingKeyFields.includes("contactEmail")
        ? "PARTIAL"
        : "PARTIAL";

    const draft: NormalizedCompanyDraft = {
      company: {
        nameKr,
        nameEn,
        descriptionKr,
        descriptionEn,
        address,
        businessTypes,
        businessTypeEvidence: evidence,
        representativeName: null,
        businessRegistrationNumber: null,
      },
      brands,
      contacts,
      websites,
      socialMedia,
      categories,
      companyProducts,
      companyDocuments,
      source: {
        provider: this.provider,
        sourceUrl,
        sourceIdentifier: orgId,
        collectedAt: new Date().toISOString(),
        eventEditionId: DEFAULT_EVENT_EDITION_ID,
        standLocation,
        rawPayloadSnapshot,
      },
      enrichment: {
        attempted: false,
        success: false,
        enrichedUrl: null,
        enrichedPages: [],
      },
      audit: {
        status: auditStatus,
        missingKeyFields,
        notes: [],
      },
    };

    // 12. Optional Website Enrichment (Default: ON)
    if (options?.enrichWebsite !== false && websites.length > 0) {
      draft.enrichment.attempted = true;
      const targetSite = websites[0].url;
      try {
        const enriched = await enrichFromOfficialWebsite(targetSite, options);
        draft.enrichment.enrichedUrl = targetSite;
        draft.enrichment.enrichedPages = enriched.enrichedPages;
        draft.enrichment.success = enriched.enrichedPages.length > 0;

        if (enriched.representativeName) {
          draft.company.representativeName = enriched.representativeName;
          draft.audit.notes.push(`Enriched representative name: ${enriched.representativeName}`);
        }
        if (enriched.businessRegistrationNumber) {
          draft.company.businessRegistrationNumber = enriched.businessRegistrationNumber;
          draft.audit.notes.push(
            `Enriched business registration number: ${enriched.businessRegistrationNumber}`
          );
        }

        // Add additional emails from official site without duplicate
        for (const extraEmail of enriched.additionalEmails) {
          const lower = extraEmail.toLowerCase();
          const alreadyExists = draft.contacts.some((c) => c.email.toLowerCase() === lower);
          if (!alreadyExists && !this.isOrganizerContact(lower)) {
            draft.contacts.push({
              name: null,
              department: null,
              jobTitle: null,
              email: extraEmail,
              phone: null,
              isPrimary: false,
              source: "OFFICIAL_WEBSITE",
              sourceUrl: targetSite,
            });
            draft.audit.notes.push(`Enriched secondary email from website: ${extraEmail}`);
          }
        }
      } catch (enrichErr: any) {
        draft.enrichment.error = enrichErr.message || String(enrichErr);
        draft.audit.notes.push(`Website enrichment failed: ${draft.enrichment.error}`);
      }
    }

    // 13. Automatic Primary Product Category Recommendation (ADM-BSRC-011)
    draft.company.primaryProductCategories = recommendPrimaryProductCategories({
      categories: draft.categories,
      products: draft.companyProducts,
      descriptions: [draft.company.descriptionKr, draft.company.descriptionEn],
      brandNames: draft.brands.map((b) => b.nameKr),
    });
    draft.company.primaryCategoriesConfirmed = false;

    return draft;
  }

  private buildAddress(
    koEntry: any,
    enEntry: any,
    hideAddress: boolean
  ): SourcingAddress {
    if (hideAddress) {
      return {
        line1: null,
        line2: null,
        city: null,
        stateProvince: null,
        postcode: null,
        country: null,
        countryCode: null,
        formattedKr: null,
        formattedEn: null,
      };
    }

    const koParts = [
      koEntry?.stateProvince,
      koEntry?.city,
      koEntry?.addressLine1,
      koEntry?.addressLine2,
      koEntry?.postcode ? `(${koEntry.postcode})` : null,
    ]
      .filter(Boolean)
      .map(sanitizeText);

    const enParts = [
      enEntry?.addressLine1,
      enEntry?.addressLine2,
      enEntry?.city,
      enEntry?.stateProvince,
      enEntry?.postcode,
      enEntry?.country,
    ]
      .filter(Boolean)
      .map(sanitizeText);

    return {
      line1: sanitizeText(koEntry?.addressLine1 || enEntry?.addressLine1) || null,
      line2: sanitizeText(koEntry?.addressLine2 || enEntry?.addressLine2) || null,
      city: sanitizeText(koEntry?.city || enEntry?.city) || null,
      stateProvince: sanitizeText(koEntry?.stateProvince || enEntry?.stateProvince) || null,
      postcode: sanitizeText(koEntry?.postcode || enEntry?.postcode) || null,
      country: sanitizeText(koEntry?.country || enEntry?.country) || "한국",
      countryCode: sanitizeText(koEntry?.countryCode || enEntry?.countryCode) || "KR",
      formattedKr: koParts.length > 0 ? koParts.join(" ") : null,
      formattedEn: enParts.length > 0 ? enParts.join(", ") : null,
    };
  }

  private extractSupportingSentence(text: string | null | undefined, keywords: string[]): string | null {
    if (!text) return null;
    const normalized = text.replace(/\r\n/g, "\n");
    const sentences = normalized.split(/(?<=[.!?\n])\s+/);
    for (const s of sentences) {
      const sLower = s.toLowerCase();
      for (const kw of keywords) {
        if (sLower.includes(kw.toLowerCase())) {
          const clean = s.trim().replace(/\s+/g, " ");
          if (clean.length >= 6) return clean;
        }
      }
    }
    return null;
  }

  private classifyBusinessTypes(
    rawOrg: RawExhibitingOrg,
    descKr: string | null,
    descEn: string | null,
    sourceUrl: string
  ): { businessTypes: BusinessType[]; evidence: BusinessTypeEvidence[] } {
    const types = new Set<BusinessType>();
    const evidence: BusinessTypeEvidence[] = [];

    // 1. Gather all text blocks (descriptions & showObjectives across all locales)
    const textBlocks: string[] = [];
    if (descKr) textBlocks.push(descKr);
    if (descEn) textBlocks.push(descEn);
    if (rawOrg.multilingual) {
      for (const m of rawOrg.multilingual) {
        if (m.description) textBlocks.push(m.description);
        if (m.showObjective) textBlocks.push(m.showObjective);
      }
    }
    const combinedText = textBlocks.join("\n\n");

    // 2. Gather all categories
    const allCategories: string[] = [];
    if (rawOrg.filterCategories) {
      for (const fc of rawOrg.filterCategories) {
        if (fc.responses) {
          for (const resp of fc.responses) {
            if (resp.multilingual) {
              for (const m of resp.multilingual) {
                if (m.name && !allCategories.includes(m.name)) {
                  allCategories.push(m.name);
                }
              }
            }
          }
        }
      }
    }

    // 3. Gather registered represented brands
    const representedBrandNames: string[] = [];
    if (rawOrg.multilingual) {
      for (const m of rawOrg.multilingual) {
        if (m.representedBrands) {
          for (const rb of m.representedBrands) {
            if (rb.name && !representedBrandNames.includes(rb.name.trim())) {
              representedBrandNames.push(rb.name.trim());
            }
          }
        }
      }
    }

    // A. BRAND_OWNER
    if (representedBrandNames.length > 0) {
      types.add("BRAND_OWNER");
      evidence.push({
        type: "BRAND_OWNER",
        text: `자사 브랜드 등록 확인: ${representedBrandNames.join(", ")}`,
        sourceUrl,
        sourceMethod: "INTERCHARM_REPRESENTED_BRANDS",
        source: "SOURCE_EXHIBITION",
        status: "VERIFIED",
      });
    } else {
      const brandCat = allCategories.find((c) =>
        c.toLowerCase().includes("brand")
      );
      if (brandCat) {
        types.add("BRAND_OWNER");
        evidence.push({
          type: "BRAND_OWNER",
          text: `전시회 카테고리 등록: ${brandCat}`,
          sourceUrl,
          sourceMethod: "INTERCHARM_CATEGORY",
          source: "SOURCE_EXHIBITION",
          status: "VERIFIED",
        });
      } else {
        const brandSentence = this.extractSupportingSentence(combinedText, [
          "자사 브랜드",
          "브랜드 ‘",
          "브랜드 '",
          "화장품 브랜드",
          "스킨케어 브랜드",
          "brand owner",
          "operates the skincare brand",
        ]);
        if (brandSentence) {
          types.add("BRAND_OWNER");
          evidence.push({
            type: "BRAND_OWNER",
            text: brandSentence,
            sourceUrl,
            sourceMethod: "INTERCHARM_DESCRIPTION",
            source: "SOURCE_EXHIBITION",
            status: "VERIFIED",
          });
        }
      }
    }

    // B. OEM / ODM
    const oemCat = allCategories.find(
      (c) =>
        c.toLowerCase().includes("oem") ||
        c.toLowerCase().includes("odm") ||
        c.toLowerCase().includes("contract manufacturing")
    );
    if (oemCat) {
      types.add("OEM_ODM");
      evidence.push({
        type: "OEM_ODM",
        text: `전시회 공식 카테고리: ${oemCat}`,
        sourceUrl,
        sourceMethod: "INTERCHARM_CATEGORY",
        source: "SOURCE_EXHIBITION",
        status: "VERIFIED",
      });
    }
    const oemSentence = this.extractSupportingSentence(combinedText, [
      "oem",
      "odm",
      "주문자상표부착",
      "위탁제조",
      "위탁생산",
    ]);
    if (oemSentence && !types.has("OEM_ODM")) {
      types.add("OEM_ODM");
      evidence.push({
        type: "OEM_ODM",
        text: oemSentence,
        sourceUrl,
        sourceMethod: "INTERCHARM_DESCRIPTION",
        source: "SOURCE_EXHIBITION",
        status: "VERIFIED",
      });
    }

    // C. MANUFACTURER
    const mfgSentence = this.extractSupportingSentence(combinedText, [
      "자체 제조",
      "자체 생산",
      "제조기업",
      "제조에 전념",
      "개발·생산",
      "개발-생산",
      "개발 생산",
      "공장",
      "manufacturer",
      "manufacturing",
    ]);
    if (mfgSentence) {
      types.add("MANUFACTURER");
      evidence.push({
        type: "MANUFACTURER",
        text: mfgSentence,
        sourceUrl,
        sourceMethod: "INTERCHARM_DESCRIPTION",
        source: "SOURCE_EXHIBITION",
        status: "VERIFIED",
      });
    } else {
      const mfgCat = allCategories.find((c) =>
        c.toLowerCase().includes("manufacturer")
      );
      if (mfgCat) {
        types.add("MANUFACTURER");
        evidence.push({
          type: "MANUFACTURER",
          text: `전시회 공식 카테고리: ${mfgCat}`,
          sourceUrl,
          sourceMethod: "INTERCHARM_CATEGORY",
          source: "SOURCE_EXHIBITION",
          status: "VERIFIED",
        });
      }
    }

    // D. DISTRIBUTOR
    const distSentence = this.extractSupportingSentence(combinedText, [
      "유통사",
      "유통망",
      "총판",
      "도매업",
      "도소매",
      "distributor",
      "distribution network",
      "distribution diversification",
      "wholesaler",
    ]);
    if (distSentence) {
      types.add("DISTRIBUTOR");
      evidence.push({
        type: "DISTRIBUTOR",
        text: distSentence,
        sourceUrl,
        sourceMethod: "INTERCHARM_DESCRIPTION",
        source: "SOURCE_EXHIBITION",
        status: "VERIFIED",
      });
    }

    // E. IMPORTER_EXPORTER
    const impExpSentence = this.extractSupportingSentence(combinedText, [
      "수출입",
      "무역",
      "import/export",
      "importer",
      "exporter",
      "수출입업체",
    ]);
    if (impExpSentence) {
      types.add("IMPORTER_EXPORTER");
      evidence.push({
        type: "IMPORTER_EXPORTER",
        text: impExpSentence,
        sourceUrl,
        sourceMethod: "INTERCHARM_DESCRIPTION",
        source: "SOURCE_EXHIBITION",
        status: "VERIFIED",
      });
    }

    // F. DEFAULT / PROVISIONAL FALLBACK (If NO evidence matches any role)
    if (types.size === 0) {
      types.add("BRAND_OWNER");
      evidence.push({
        type: "BRAND_OWNER",
        text: "전시 참가사 기본 제안 (No direct evidence in exhibition profile — provisional default)",
        sourceUrl,
        sourceMethod: "DEFAULT_FALLBACK",
        source: "INFERRED",
        status: "DEFAULT_UNVERIFIED",
      });
    }

    return {
      businessTypes: Array.from(types),
      evidence,
    };
  }

  private doesProductMatchBrand(
    prod: SourcingProductItem,
    brandNameKr: string,
    brandNameEn: string | null
  ): boolean {
    const clean = (s: string) => s.replace(/[™®©]/g, "").trim().toLowerCase();
    const bKr = clean(brandNameKr);
    const bEn = brandNameEn ? clean(brandNameEn) : "";

    const tKr = prod.titleKr ? clean(prod.titleKr) : "";
    const tEn = prod.titleEn ? clean(prod.titleEn) : "";

    const matches = (title: string, brand: string) => {
      if (!title || !brand || brand.length < 2) return false;
      return title.includes(brand) || brand.includes(title);
    };

    return Boolean(
      (bKr && (matches(tKr, bKr) || matches(tEn, bKr))) ||
      (bEn && (matches(tKr, bEn) || matches(tEn, bEn)))
    );
  }

  private buildBrands(
    rawOrg: RawExhibitingOrg,
    koEntry: any,
    enEntry: any,
    categories: string[],
    companyProducts: SourcingProductItem[]
  ): SourcingBrand[] {
    const rawBrandList: Array<{ nameKr: string; nameEn: string | null; key: string }> = [];

    const koRep = (koEntry?.representedBrands || []).flatMap((b: any) =>
      b.name.split(/[,/]/).map((s: string) => sanitizeText(s)).filter(Boolean)
    );
    const enRep = (enEntry?.representedBrands || []).flatMap((b: any) =>
      b.name.split(/[,/]/).map((s: string) => sanitizeText(s)).filter(Boolean)
    );

    // If both KO and EN have equal brand counts (e.g. 1 KO "베네투스" and 1 EN "benetus")
    if (koRep.length > 0 && koRep.length === enRep.length) {
      for (let i = 0; i < koRep.length; i++) {
        const kName = koRep[i] as string;
        const eName = enRep[i] as string;
        rawBrandList.push({
          nameKr: kName,
          nameEn: eName !== kName ? eName : null,
          key: kName.toLowerCase(),
        });
      }
    } else {
      // Add all KO brands
      for (const kName of koRep) {
        const clean = kName as string;
        rawBrandList.push({
          nameKr: clean,
          nameEn: null,
          key: clean.toLowerCase(),
        });
      }
      // Add EN brands if not matched
      for (const eName of enRep) {
        const clean = eName as string;
        const key = clean.toLowerCase();
        if (!rawBrandList.some((b) => b.key === key)) {
          rawBrandList.push({
            nameKr: clean,
            nameEn: clean,
            key,
          });
        }
      }
    }

    // If no represented brands explicitly found, use displayName or infer from products/description
    if (rawBrandList.length === 0) {
      const fallbackKr =
        sanitizeText(koEntry?.displayName) ||
        sanitizeText(enEntry?.displayName) ||
        sanitizeText(rawOrg.companyName) ||
        "Primary Brand";
      const fallbackEn = sanitizeText(enEntry?.displayName) || null;

      rawBrandList.push({
        nameKr: fallbackKr,
        nameEn: fallbackEn !== fallbackKr ? fallbackEn : null,
        key: fallbackKr.toLowerCase(),
      });
    }

    const isSingleBrand = rawBrandList.length === 1;

    // Deduplicate by key and map to SourcingBrand
    const seen = new Set<string>();
    const brands: SourcingBrand[] = [];

    for (const b of rawBrandList) {
      if (seen.has(b.key)) continue;
      seen.add(b.key);

      if (isSingleBrand) {
        // Single brand: all company products and categories belong to this brand
        brands.push({
          nameKr: b.nameKr,
          nameEn: b.nameEn,
          description: null,
          categories: [...categories],
          keyProducts: [...companyProducts],
          source: "SOURCE_EXHIBITION",
        });
      } else {
        // Multi-brand (e.g. JD BIO with 5 brands):
        // Categories belong to the company level; only attribute products that specifically match this brand
        const attributedProducts = companyProducts.filter((p) =>
          this.doesProductMatchBrand(p, b.nameKr, b.nameEn)
        );

        brands.push({
          nameKr: b.nameKr,
          nameEn: b.nameEn,
          description: null,
          categories: [],
          keyProducts: attributedProducts,
          source: "SOURCE_EXHIBITION",
        });
      }
    }

    return brands;
  }

  private isOrganizerContact(email: string): boolean {
    const lower = email.toLowerCase().trim();
    return (
      lower.includes("intercharmkorea.com") ||
      lower.includes("reedexpo.com") ||
      lower.includes("rxglobal.com")
    );
  }

  private normalizeUrl(url: string): string | null {
    try {
      const trimmed = url.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      return `https://${trimmed}`;
    } catch {
      return null;
    }
  }

  private normalizeSocialPlatform(
    name: string
  ): SourcingSocialMedia["platform"] {
    const upper = (name || "").toUpperCase().trim();
    if (upper.includes("INSTA")) return "INSTAGRAM";
    if (upper.includes("YOUTUBE")) return "YOUTUBE";
    if (upper.includes("FACEBOOK")) return "FACEBOOK";
    if (upper.includes("TWITTER") || upper.includes(" X")) return "TWITTER";
    if (upper.includes("LINKEDIN")) return "LINKEDIN";
    return "OTHER";
  }
}
