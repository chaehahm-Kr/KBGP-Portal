import { SourceAdapter } from "./base.adapter";
import {
  NormalizedCompanyDraft,
  ExtractionOptions,
  SourcingProvider,
  BusinessType,
  BusinessTypeEvidence,
  SourcingBrand,
  SourcingContact,
  SourcingWebsite,
  SourcingSocialMedia,
  SourcingAddress,
  SourcingProductItem,
} from "../types";
import { validateIntercharmUrl, sanitizeText } from "../security";
import { SourceExtractionError } from "../errors";
import { enrichFromOfficialWebsite } from "../enrichment/website-enricher";

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

    return this.mapToNormalizedDraft(rawOrg, rawUrl, orgId, rawPayloadSnapshot, options);
  }

  private async mapToNormalizedDraft(
    rawOrg: RawExhibitingOrg,
    sourceUrl: string,
    orgId: string,
    rawPayloadSnapshot: unknown,
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

    // 2. Descriptions
    const descriptionKr = sanitizeText(koEntry?.description) || null;
    const descriptionEn = sanitizeText(enEntry?.description) || null;

    // 3. Address Mapping
    const address = this.buildAddress(koEntry, enEntry, rawOrg.hideAddress);

    // 4. Business Type & Evidence Extraction
    const { businessTypes, evidence } = this.classifyBusinessTypes(
      descriptionKr,
      descriptionEn,
      rawOrg.filterCategories
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

    // 9. Brands & Key Products
    const brands = this.buildBrands(rawOrg, koEntry, enEntry, categories);

    // 10. Stands
    const standLocation = rawOrg.stands && rawOrg.stands.length > 0 ? rawOrg.stands[0].name : null;

    // 11. Initial Audit Notes
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

  private classifyBusinessTypes(
    descKr: string | null,
    descEn: string | null,
    filterCategories: any
  ): { businessTypes: BusinessType[]; evidence: BusinessTypeEvidence[] } {
    const text = `${descKr || ""} ${descEn || ""}`.toLowerCase();
    const types = new Set<BusinessType>();
    const evidence: BusinessTypeEvidence[] = [];

    // 1. Brand Owner:
    if (
      text.includes("자사 브랜드") ||
      text.includes("브랜드 ‘") ||
      text.includes("브랜드 '") ||
      text.includes("operates the skincare brand") ||
      text.includes("exporting its cosmetic brands") ||
      text.includes("brand owner") ||
      text.includes("화장품 브랜드")
    ) {
      types.add("BRAND_OWNER");
      evidence.push({
        type: "BRAND_OWNER",
        text: "Exhibition description explicitly references brand ownership and brand operations.",
        source: "SOURCE_EXHIBITION",
      });
    }

    // 2. Manufacturer:
    if (
      text.includes("자체 제조") ||
      text.includes("자체 생산") ||
      text.includes("제조기업") ||
      text.includes("제조에 전념") ||
      text.includes("manufacturer") ||
      text.includes("manufacturing") ||
      text.includes("공장")
    ) {
      types.add("MANUFACTURER");
      evidence.push({
        type: "MANUFACTURER",
        text: "Exhibition description explicitly references manufacturing facilities and production operations.",
        source: "SOURCE_EXHIBITION",
      });
    }

    // 3. OEM / ODM:
    if (
      text.includes("oem") ||
      text.includes("odm") ||
      text.includes("주문자상표부착") ||
      text.includes("위탁제조")
    ) {
      types.add("OEM_ODM");
      evidence.push({
        type: "OEM_ODM",
        text: "Exhibition description explicitly references OEM/ODM production services.",
        source: "SOURCE_EXHIBITION",
      });
    }

    // 4. Distributor:
    if (
      text.includes("유통사") ||
      text.includes("총판") ||
      text.includes("도매업") ||
      text.includes("distributor") ||
      text.includes("wholesaler")
    ) {
      types.add("DISTRIBUTOR");
      evidence.push({
        type: "DISTRIBUTOR",
        text: "Exhibition description explicitly references distribution/wholesale operations.",
        source: "SOURCE_EXHIBITION",
      });
    }

    // Default to BRAND_OWNER if exhibitor is showcasing beauty products but no specific manufacturer phrase
    if (types.size === 0) {
      types.add("BRAND_OWNER");
      evidence.push({
        type: "BRAND_OWNER",
        text: "Exhibiting cosmetics under dedicated brand display; inferred as brand owner.",
        source: "INFERRED",
      });
    }

    return {
      businessTypes: Array.from(types),
      evidence,
    };
  }

  private buildBrands(
    rawOrg: RawExhibitingOrg,
    koEntry: any,
    enEntry: any,
    categories: string[]
  ): SourcingBrand[] {
    const brandsMap = new Map<string, SourcingBrand>();

    // Format products
    const keyProducts: SourcingProductItem[] = [];
    if (rawOrg.products) {
      for (const p of rawOrg.products) {
        const pKo = p.multilingual?.find((m) => m.locale.startsWith("ko"));
        const pEn = p.multilingual?.find((m) => m.locale.startsWith("en"));
        keyProducts.push({
          id: p.id,
          titleKr: sanitizeText(pKo?.title || pEn?.title),
          titleEn: sanitizeText(pEn?.title || pKo?.title),
          description: sanitizeText(pKo?.description || pEn?.description),
          imageUrl: p.imageUrl ? sanitizeText(p.imageUrl) : null,
        });
      }
    }

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
        const key = kName.toLowerCase();
        brandsMap.set(key, {
          nameKr: kName,
          nameEn: eName !== kName ? eName : null,
          description: null,
          categories: [...categories],
          keyProducts,
          source: "SOURCE_EXHIBITION",
        });
      }
    } else {
      // Add all KO brands
      for (const kName of koRep) {
        const clean = kName as string;
        brandsMap.set(clean.toLowerCase(), {
          nameKr: clean,
          nameEn: null,
          description: null,
          categories: [...categories],
          keyProducts,
          source: "SOURCE_EXHIBITION",
        });
      }
      // Add EN brands if not matched
      for (const eName of enRep) {
        const clean = eName as string;
        const key = clean.toLowerCase();
        if (!brandsMap.has(key)) {
          brandsMap.set(key, {
            nameKr: clean,
            nameEn: clean,
            description: null,
            categories: [...categories],
            keyProducts,
            source: "SOURCE_EXHIBITION",
          });
        }
      }
    }

    // If no represented brands explicitly found, use displayName or infer from products/description
    if (brandsMap.size === 0) {
      const fallbackKr =
        sanitizeText(koEntry?.displayName) ||
        sanitizeText(enEntry?.displayName) ||
        sanitizeText(rawOrg.companyName) ||
        "Primary Brand";
      const fallbackEn = sanitizeText(enEntry?.displayName) || null;

      brandsMap.set(fallbackKr.toLowerCase(), {
        nameKr: fallbackKr,
        nameEn: fallbackEn !== fallbackKr ? fallbackEn : null,
        description: null,
        categories: [...categories],
        keyProducts,
        source: "SOURCE_EXHIBITION",
      });
    }

    return Array.from(brandsMap.values());
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
