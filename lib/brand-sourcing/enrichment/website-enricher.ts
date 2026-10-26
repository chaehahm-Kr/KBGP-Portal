import { validateSafeExternalUrl, sanitizeText } from "../security";
import type { ExtractionOptions } from "../types";

export interface EnrichedWebsiteData {
  representativeName: string | null;
  businessRegistrationNumber: string | null;
  additionalEmails: string[];
  additionalWebsites: string[];
  enrichedPages: string[];
}

/**
 * Extracts business metadata from official company website.
 * Scrapes strictly public business disclosures (대표자, 사업자등록번호, 고객센터 이메일).
 */
export async function enrichFromOfficialWebsite(
  rawUrl: string,
  options?: ExtractionOptions
): Promise<EnrichedWebsiteData> {
  const result: EnrichedWebsiteData = {
    representativeName: null,
    businessRegistrationNumber: null,
    additionalEmails: [],
    additionalWebsites: [],
    enrichedPages: [],
  };

  if (!rawUrl || typeof rawUrl !== "string") {
    return result;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = validateSafeExternalUrl(rawUrl);
  } catch (err) {
    // Malformed or unsafe URL - fail silently without throwing
    return result;
  }

  const fetchImpl = options?.customFetch || fetch;
  const timeoutMs = options?.timeoutMs || 8000;

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = parsedUrl;
    let response: Response | null = null;
    let redirectCount = 0;
    const maxRedirects = 3;

    while (redirectCount <= maxRedirects) {
      response = await fetchImpl(currentUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        response.headers.get("location")
      ) {
        redirectCount++;
        const location = response.headers.get("location")!;
        const nextUrl = new URL(location, currentUrl);
        // CRITICAL: Validate redirected destination against SSRF!
        currentUrl = validateSafeExternalUrl(nextUrl.toString());
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      return result;
    }

    result.enrichedPages.push(currentUrl.toString());
    const html = await response.text();

    // 1. Extract Representative / CEO name (대표, 대표자, 대표이사)
    // Common patterns in Korean footers:
    // 대표: 홍길동 | 대표자: 홍길동 | 대표이사 홍길동 | CEO : John Doe
    const ceoMatch = html.match(
      /(?:대표(?:자|이사)?|CEO)[\s:：]+([가-힣]{2,4}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i
    );
    if (ceoMatch && ceoMatch[1]) {
      const candidate = sanitizeText(ceoMatch[1]);
      // Avoid generic false positives like "대표 브랜드", "대표 상품", "대표 전화"
      const falsePositives = ["브랜드", "상품", "전화", "번호", "메뉴", "제품", "뷰티", "기업", "화장품"];
      if (candidate && !falsePositives.some((w) => candidate.includes(w))) {
        result.representativeName = candidate;
      }
    }

    // 2. Extract Business Registration Number (사업자등록번호: XXX-XX-XXXXX)
    const bizNumMatch = html.match(
      /(?:사업자\s*(?:등록)?\s*(?:번호)?|Registration\s*(?:No\.?)?)[\s:：]+([0-9]{3}[-\s]?[0-9]{2}[-\s]?[0-9]{5})/i
    );
    if (bizNumMatch && bizNumMatch[1]) {
      const normalizedBizNum = bizNumMatch[1].replace(/[\s-]/g, "");
      if (normalizedBizNum.length === 10) {
        result.businessRegistrationNumber = `${normalizedBizNum.slice(0, 3)}-${normalizedBizNum.slice(
          3,
          5
        )}-${normalizedBizNum.slice(5)}`;
      }
    }

    // 3. Extract Secondary Contact Emails (info@, ceo@, contact@, support@)
    const emailMatches = html.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,6})/g) || [];
    const ignoredExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"];
    const uniqueEmails = new Set<string>();

    for (const em of emailMatches) {
      const lower = em.toLowerCase();
      const hasIgnoredExt = ignoredExtensions.some((ext) => lower.endsWith(ext));
      if (!hasIgnoredExt && !uniqueEmails.has(lower)) {
        uniqueEmails.add(lower);
      }
    }

    result.additionalEmails = Array.from(uniqueEmails).slice(0, 5);
  } catch (err) {
    // Gracefully catch timeout or network errors
  } finally {
    clearTimeout(timeoutTimer);
  }

  return result;
}
