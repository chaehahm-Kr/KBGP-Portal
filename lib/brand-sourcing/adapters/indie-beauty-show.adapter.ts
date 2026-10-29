import { SourceAdapter } from "./base.adapter";
import {
  NormalizedCompanyDraft,
  ExtractionOptions,
  SourcingProvider,
  SourcingProductItem,
  SourcingBrand,
  SourcingContact,
  SourcingWebsite,
  FieldOrigin,
} from "../types";
import { validateIndieBeautyShowUrl, sanitizeText, sanitizeParagraphs } from "../security";
import { SourceExtractionError } from "../errors";
import { enrichFromOfficialWebsite } from "../enrichment/website-enricher";
import { recommendPrimaryProductCategories } from "../category-classifier";

/**
 * ADM-BSRC-014: Dedicated Source Adapter for Indie Beauty Show (인디뷰티쇼) 2026.
 * Base Website: https://indiebeautyshow.com/
 * Exhibitor List: https://indiebeautyshow.com/exhibitor-list2026/
 */
export class IndieBeautyShowAdapter implements SourceAdapter {
  readonly provider: SourcingProvider = "INDIE_BEAUTY_SHOW";
  readonly exhibitionYear = "2026";
  readonly eventEditionId = "ibs-2026";

  /**
   * Identifies whether this adapter can parse the provided URL.
   * Matches indiebeautyshow.com domain with an exhibitor post idx parameter.
   */
  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.toLowerCase();
      const isIndieHost = host === "indiebeautyshow.com" || host === "www.indiebeautyshow.com";
      const hasIdx = parsed.searchParams.has("idx") && /^\d+$/.test(parsed.searchParams.get("idx") || "");
      return isIndieHost && hasIdx;
    } catch {
      return false;
    }
  }

  /**
   * Extracts and normalizes company, brand, contact, and product details from an exhibitor page.
   */
  async extract(url: string, options?: ExtractionOptions): Promise<NormalizedCompanyDraft> {
    const { idx } = validateIndieBeautyShowUrl(url);

    // 1. Fetch exhibitor detail page
    const fetchFn = options?.customFetch || fetch;
    const timeoutMs = options?.timeoutMs || 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let html: string;
    try {
      const response = await fetchFn(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      if (!response.ok) {
        throw new SourceExtractionError(
          `Indie Beauty Show server returned status ${response.status}: ${response.statusText}`,
          this.provider,
          url
        );
      }

      html = await response.text();
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new SourceExtractionError(
          `Connection timed out (${timeoutMs}ms) while fetching Indie Beauty Show exhibitor page.`,
          this.provider,
          url
        );
      }
      throw new SourceExtractionError(
        `Failed to fetch Indie Beauty Show page: ${err.message}`,
        this.provider,
        url
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // 2. Parse HTML content
    return await this.parseHtml(html, url, idx, options);
  }

  /**
   * Internal parser decomposing Indie Beauty Show Imweb-based exhibitor markup.
   */
  private async parseHtml(
    html: string,
    sourceUrl: string,
    idx: string,
    options?: ExtractionOptions
  ): Promise<NormalizedCompanyDraft> {
    const decodeHtml = (str: string): string => {
      return str
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&bull;/g, "•")
        .replace(/&middot;/g, "·")
        .replace(/&lsquo;/g, "‘")
        .replace(/&rsquo;/g, "’")
        .replace(/&ldquo;/g, "“")
        .replace(/&rdquo;/g, "”")
        .replace(/\u00a0/g, " ")
        .trim();
    };

    // Extract OG tags as fallback
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i)?.[1] || "";
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i)?.[1] || "";

    // Parse tables
    const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];

    let exhibitorName = "";
    let logoUrl = "";
    let representative = "";
    let rawAddress = "";
    let phone = "";
    let email = "";
    let website = "";

    if (tables.length > 0) {
      const table1 = tables[0];

      // Logo image in first cell
      const logoMatch = table1.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (logoMatch) logoUrl = logoMatch[1];

      // Exhibitor name in TR 1
      const trs = table1.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      if (trs.length >= 1) {
        const nameMatch =
          trs[0].match(/<span[^>]*font-size:\s*22px[^>]*>\s*([\s\S]*?)<\/span>/i) ||
          trs[0].match(/<strong>\s*([\s\S]*?)<\/strong>/i);
        if (nameMatch) {
          exhibitorName = decodeHtml(nameMatch[1].replace(/<[^>]+>/g, "").trim());
        }
      }

      // Identity fields in TR 2
      if (trs.length >= 2) {
        const tds = trs[1].match(/<td[\s\S]*?<\/td>/gi) || [];
        if (tds.length >= 2) {
          const labelItems = tds[0]
            .split(/<\/li>/i)
            .map((s) => decodeHtml(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, "").trim())
            .filter(Boolean);

          const valueItems = tds[1]
            .replace(/<p[\s\S]*?<\/p>/gi, "")
            .split(/<br\s*\/?>/i)
            .map((s) => decodeHtml(s.replace(/<[^>]+>/g, "")).trim())
            .filter(Boolean);

          for (let i = 0; i < labelItems.length && i < valueItems.length; i++) {
            const lbl = labelItems[i];
            const val = valueItems[i];
            if (lbl.includes("대표")) representative = val;
            else if (lbl.includes("주소")) rawAddress = val;
            else if (lbl.includes("전화")) phone = val;
            else if (lbl.includes("이메일") || lbl.toLowerCase().includes("email")) email = val;
            else if (lbl.includes("웹사이트") || lbl.includes("홈페이지") || lbl.toLowerCase().includes("web"))
              website = val;
          }
        }
      }
    }

    // Name fallback
    if (!exhibitorName && ogTitle) {
      exhibitorName = ogTitle.split(":")[0].trim();
    }
    if (!logoUrl && ogImage) {
      logoUrl = ogImage;
    }

    // Email fallback if missed in table
    if (!email) {
      const emMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emMatch) email = emMatch[1];
    }

    // Clean website URL
    if (website && !website.startsWith("http://") && !website.startsWith("https://")) {
      website = `https://${website}`;
    }

    // Parse Company Description (■ 회사소개)
    let descriptionKr = "";
    const descHeaderIdx = html.indexOf("■ 회사소개");
    const prodHeaderIdx = html.indexOf("■ 브랜드 및 제품/서비스 소개");

    if (descHeaderIdx !== -1) {
      const endIdx = prodHeaderIdx !== -1 ? prodHeaderIdx : descHeaderIdx + 2000;
      const descSection = html.slice(descHeaderIdx, endIdx);
      descriptionKr = decodeHtml(
        descSection
          .replace(/■\s*회사소개/g, "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim()
      );
    }

    // Parse Products (Tables 4+ or product section)
    const companyProducts: SourcingProductItem[] = [];
    if (tables.length > 3) {
      for (let t = 3; t < tables.length; t++) {
        const pTable = tables[t];
        const pImgMatch = pTable.match(/<img[^>]+src=["']([^"']+)["']/i);
        const pImg = pImgMatch ? pImgMatch[1] : null;

        const pTitleMatch = pTable.match(/<strong>([\s\S]*?)<\/strong>/i);
        const pTitle = pTitleMatch ? decodeHtml(pTitleMatch[1].replace(/<[^>]+>/g, "")).trim() : "";

        const pTds = pTable.match(/<td[\s\S]*?<\/td>/gi) || [];
        let pDesc = "";
        if (pTds.length >= 3) {
          pDesc = decodeHtml(pTds[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        } else {
          const pTrs = pTable.match(/<tr[\s\S]*?<\/tr>/gi) || [];
          if (pTrs.length >= 3) {
            pDesc = decodeHtml(pTrs[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
          }
        }

        if (pTitle || pImg) {
          companyProducts.push({
            titleKr: sanitizeText(pTitle) || null,
            titleEn: null,
            description: sanitizeText(pDesc) || null,
            imageUrl: pImg || null,
          });
        }
      }
    }

    // Parse Address structure
    const formattedAddress = sanitizeText(rawAddress) || null;
    let city: string | null = null;
    if (formattedAddress) {
      const parts = formattedAddress.split(" ");
      if (parts.length > 0) city = parts[0];
    }

    // Deduce categories from classifier (ADM-BSRC-011)
    const primaryCategories = recommendPrimaryProductCategories({
      categories: [],
      products: companyProducts,
      descriptions: [descriptionKr],
      brandNames: [exhibitorName],
    });

    // Build Brand entity
    const brandName = exhibitorName;
    const brands: SourcingBrand[] = [
      {
        nameKr: brandName,
        nameEn: null,
        description: sanitizeParagraphs(descriptionKr) || null,
        categories: primaryCategories.map((c) => c),
        keyProducts: companyProducts,
        source: "SOURCE_EXHIBITION" as FieldOrigin,
      },
    ];

    // Build Contacts
    const contacts: SourcingContact[] = [];
    if (email) {
      contacts.push({
        name: representative ? `${representative} (대표)` : null,
        department: null,
        jobTitle: representative ? "대표" : null,
        email: email.trim().toLowerCase(),
        phone: sanitizeText(phone) || null,
        isPrimary: true,
        source: "SOURCE_EXHIBITION" as FieldOrigin,
        sourceUrl,
      });
    }

    // Build Websites
    const websites: SourcingWebsite[] = [];
    if (website) {
      websites.push({
        url: website,
        label: "OFFICIAL",
        source: "SOURCE_EXHIBITION" as FieldOrigin,
      });
    }

    // Missing key fields audit
    const missingKeyFields: string[] = [];
    if (!email) missingKeyFields.push("contactEmail");
    if (!website) missingKeyFields.push("website");
    if (!phone) missingKeyFields.push("phone");
    if (!representative) missingKeyFields.push("representativeName");

    // Unverified legal entity note per ADM-BSRC-014 instructions
    const notes: string[] = [
      `Indie Beauty Show 2026 exhibitor page parsed (idx: ${idx}).`,
      `NOTICE: Profile is brand-oriented. Exhibitor name "${exhibitorName}" preserved as primary brand. Legal corporate entity is unverified and subject to Admin confirmation.`,
    ];

    let draft: NormalizedCompanyDraft = {
      company: {
        nameKr: exhibitorName,
        nameEn: null,
        descriptionKr: sanitizeParagraphs(descriptionKr) || null,
        descriptionEn: null,
        address: {
          line1: formattedAddress,
          line2: null,
          city,
          stateProvince: null,
          postcode: null,
          country: "한국",
          countryCode: "KR",
          formattedKr: formattedAddress,
          formattedEn: null,
        },
        businessTypes: ["BRAND_OWNER"],
        businessTypeEvidence: [
          {
            type: "BRAND_OWNER",
            text: `Exhibitor in Indie Beauty Show 2026. Represented brand: ${brandName}. Legal entity unverified.`,
            sourceUrl,
            source: "SOURCE_EXHIBITION",
            status: "DEFAULT_UNVERIFIED",
          },
        ],
        primaryProductCategories: primaryCategories,
        primaryCategoriesConfirmed: false,
        representativeName: sanitizeText(representative) || null,
        businessRegistrationNumber: null,
      },
      brands,
      contacts,
      websites,
      socialMedia: [],
      categories: primaryCategories.map((c) => c),
      companyProducts,
      companyDocuments: [],
      source: {
        provider: this.provider,
        sourceUrl,
        sourceIdentifier: `ibs-${this.exhibitionYear}-${idx}`,
        collectedAt: new Date().toISOString(),
        eventEditionId: this.eventEditionId,
        standLocation: null,
        rawPayloadSnapshot: {
          idx,
          exhibitorName,
          logoUrl,
          representative,
          rawAddress,
          phone,
          email,
          website,
          productsCount: companyProducts.length,
          exhibitionYear: this.exhibitionYear,
        },
      },
      enrichment: {
        attempted: false,
        success: false,
        enrichedUrl: null,
        enrichedPages: [],
      },
      audit: {
        status: missingKeyFields.length === 0 ? "SUCCESS" : "PARTIAL",
        missingKeyFields,
        notes,
      },
    };

    // 3. Optional Official Website Enrichment
    if (options?.enrichWebsite !== false && website) {
      draft.enrichment.attempted = true;
      try {
        const enriched = await enrichFromOfficialWebsite(website, {
          timeoutMs: 10000,
          customFetch: options?.customFetch,
        });
        draft.enrichment.enrichedUrl = website;
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

        for (const extraEmail of enriched.additionalEmails) {
          const lower = extraEmail.toLowerCase();
          const alreadyExists = draft.contacts.some((c) => c.email.toLowerCase() === lower);
          if (!alreadyExists) {
            draft.contacts.push({
              name: null,
              department: null,
              jobTitle: null,
              email: extraEmail,
              phone: null,
              isPrimary: false,
              source: "OFFICIAL_WEBSITE",
              sourceUrl: website,
            });
            draft.audit.notes.push(`Enriched secondary email from website: ${extraEmail}`);
          }
        }
      } catch (err: any) {
        draft.enrichment.error = err.message || "Website enrichment failed";
      }
    }

    return draft;
  }
}
