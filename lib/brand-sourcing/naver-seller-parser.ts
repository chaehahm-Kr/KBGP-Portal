/**
 * Brand Sourcing — Naver Smart Store Seller Information Parser
 * Task ID: ADM-BSRC-NAVER-001
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 *
 * Safely parses Korean seller information copied from Naver Smart Store seller
 * details popup into normalized Brand Sourcing company, contact, brand, and address fields.
 *
 * NO automated crawling, CAPTCHA solving, or bypass is performed.
 */

import {
  NormalizedCompanyDraft,
  SourcingAddress,
  SourcingBrand,
  SourcingContact,
  SourcingWebsite,
  BusinessType,
} from "./types";

export interface ParsedNaverSellerInfo {
  legalCompanyName: string;
  companyNameEn: string | null;
  representativeName: string;
  phone: string;
  phoneRaw: string;
  businessRegistrationNumber: string; // 10 digits e.g. "7118603120"
  businessRegistrationNumberFormatted: string; // e.g. "711-86-03120"
  addressRaw: string;
  address: SourcingAddress;
  email: string;
  onlineSalesRegistrationNumber: string | null;
  isCorporate: boolean;
  storeUrl: string;
  storeIdentifier: string;
  inferredBrandName: string;
  missingFields: string[];
  warnings: string[];
  rawText: string;
}

export interface NaverStoreUrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  channelSlug: string;
  inferredBrandName: string;
  error?: string;
}

/**
 * Validates and normalizes Naver Smart Store URLs.
 * e.g. https://smartstore.naver.com/wizardjoseon -> slug: "wizardjoseon", brand: "WIZARD JOSEON"
 */
export function validateNaverStoreUrl(url: string): NaverStoreUrlValidationResult {
  if (!url || typeof url !== "string") {
    return {
      isValid: false,
      normalizedUrl: "",
      channelSlug: "",
      inferredBrandName: "",
      error: "스토어 URL을 입력해 주세요.",
    };
  }

  const trimmed = url.trim();

  // Enforce HTTPS
  if (!trimmed.startsWith("https://")) {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      channelSlug: "",
      inferredBrandName: "",
      error: "스토어 URL은 보안 https:// 프로토콜이어야 합니다.",
    };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    const isSmartStore =
      host === "smartstore.naver.com" ||
      host === "brand.naver.com" ||
      host.endsWith(".smartstore.naver.com");

    if (!isSmartStore) {
      return {
        isValid: false,
        normalizedUrl: trimmed,
        channelSlug: "",
        inferredBrandName: "",
        error: "네이버 스마트스토어 도메인(smartstore.naver.com 또는 brand.naver.com) URL이어야 합니다.",
      };
    }

    // Extract path segments (e.g. /wizardjoseon or /category/...)
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const channelSlug = pathParts[0] || "";

    if (!channelSlug) {
      return {
        isValid: false,
        normalizedUrl: trimmed,
        channelSlug: "",
        inferredBrandName: "",
        error: "스토어 채널 식별자(Slug)를 URL 경로에서 찾을 수 없습니다 (예: https://smartstore.naver.com/스토어이름).",
      };
    }

    // Invert slug into a readable brand candidate e.g. "wizardjoseon" -> "WIZARD JOSEON"
    const inferredBrandName = formatSlugToBrandName(channelSlug);

    const normalizedUrl = `https://${host}/${channelSlug}`;

    return {
      isValid: true,
      normalizedUrl,
      channelSlug,
      inferredBrandName,
    };
  } catch {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      channelSlug: "",
      inferredBrandName: "",
      error: "올바른 URL 형식을 입력해 주세요 (예: https://smartstore.naver.com/wizardjoseon).",
    };
  }
}

/**
 * Converts a URL slug like "wizardjoseon" or "wizard-joseon" or "wizard_joseon"
 * into a human-readable brand name candidate.
 */
export function formatSlugToBrandName(slug: string): string {
  if (!slug) return "";
  // Split on hyphens or underscores
  const parts = slug.replace(/[-_]+/g, " ").trim().split(/\s+/);
  return parts
    .map((p) => p.toUpperCase())
    .join(" ");
}

/**
 * Normalizes Korean Business Registration Numbers (사업자등록번호).
 * Standard Korean format: 10 digits (XXX-XX-XXXXX).
 */
export function normalizeBusinessRegistrationNumber(raw: string): {
  normalized: string; // 10 digits e.g. "7118603120"
  formatted: string; // e.g. "711-86-03120"
  isValid: boolean;
} {
  if (!raw) return { normalized: "", formatted: "", isValid: false };

  // Remove common UI noise strings
  const cleaned = raw
    .replace(/사업자\s*정보\s*확인/gi, "")
    .replace(/사업자등록번호/gi, "")
    .replace(/조회/gi, "")
    .trim();

  // Try matching standard Korean 3-2-5 digit pattern first
  const brnPattern = /\b(\d{3})[- ]?(\d{2})[- ]?(\d{5})\b/;
  const match = cleaned.match(brnPattern);
  if (match) {
    const digits = `${match[1]}${match[2]}${match[3]}`;
    const formatted = `${match[1]}-${match[2]}-${match[3]}`;
    return {
      normalized: digits,
      formatted,
      isValid: true,
    };
  }

  // Extract all digits fallback
  const digits = cleaned.replace(/\D/g, "");

  if (digits.length === 10) {
    const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
    return {
      normalized: digits,
      formatted,
      isValid: true,
    };
  }

  return {
    normalized: digits,
    formatted: cleaned,
    isValid: digits.length === 10,
  };
}

/**
 * Normalizes telephone / mobile numbers and removes Naver UI noise.
 * e.g. "010-7979-7270 인증잘못된 번호 신고" -> "010-7979-7270"
 */
export function normalizePhoneNumber(raw: string): {
  normalized: string;
  isValid: boolean;
} {
  if (!raw) return { normalized: "", isValid: false };

  // Remove common UI noise strings and convert Korean international prefix (+82) to 0
  let text = raw
    .replace(/^\+?82[- ]?/, "0")
    .replace(/\./g, "-")
    .replace(/인증\s*잘못된\s*번호\s*신고/gi, "")
    .replace(/잘못된\s*번호\s*신고/gi, "")
    .replace(/인증/gi, "")
    .replace(/신고/gi, "")
    .replace(/고객센터/gi, "")
    .trim();

  // Regex for Korean standard phone numbers:
  // Mobile: 010-XXXX-XXXX, 011/016/017/018/019
  // Landline: 02-XXX-XXXX, 02-XXXX-XXXX, 031/032/033/041/042/043/044/051/052/053/054/055/061/062/063/064
  // VoIP: 070-XXXX-XXXX
  // National toll-free / representative: 1588-XXXX, 1544-XXXX, 1566-XXXX, 1600-XXXX, 1670-XXXX, 1688-XXXX, 1800-XXXX
  const phoneRegex = /(01[016789]-?\d{3,4}-?\d{4}|02-?\d{3,4}-?\d{4}|0[3-6]\d-?\d{3,4}-?\d{4}|070-?\d{4}-?\d{4}|1[568]\d{2}-?\d{4})/;
  const match = text.match(phoneRegex);

  if (match) {
    let digits = match[0].replace(/\D/g, "");
    let formatted = match[0];

    // Format with standard hyphens if missing
    if (!formatted.includes("-")) {
      if (digits.startsWith("02")) {
        if (digits.length === 9) {
          formatted = `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
        } else if (digits.length === 10) {
          formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
        }
      } else if (digits.startsWith("1") && digits.length === 8) {
        formatted = `${digits.slice(0, 4)}-${digits.slice(4)}`;
      } else if (digits.length === 11) {
        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
      } else if (digits.length === 10) {
        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
    }

    return {
      normalized: formatted,
      isValid: true,
    };
  }

  // Fallback: extract any digits-and-hyphens sequence of length >= 8
  const generalMatch = text.match(/[\d-]{8,14}/);
  if (generalMatch) {
    return {
      normalized: generalMatch[0],
      isValid: generalMatch[0].replace(/\D/g, "").length >= 8,
    };
  }

  return {
    normalized: text,
    isValid: false,
  };
}

/**
 * Extracts and validates an email address from raw text.
 */
export function extractEmail(raw: string): { email: string; isValid: boolean } {
  if (!raw) return { email: "", isValid: false };

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const match = raw.match(emailRegex);

  if (match) {
    return {
      email: match[1].toLowerCase().trim(),
      isValid: true,
    };
  }

  return {
    email: "",
    isValid: false,
  };
}

/**
 * Parses full Korean address string and extracts postal code if present.
 * e.g. "부산광역시 부산진구 전포대로 170 (유성해네스타워) 401호 (우 : 47306)"
 */
export function parseKoreanAddress(raw: string): SourcingAddress {
  const cleaned = raw.replace(/\s+/g, " ").trim();

  // Extract postal code e.g. (우 : 47306) or (우: 47306) or (47306) or 우편번호: 47306
  let postcode: string | null = null;
  const postMatch = cleaned.match(/(?:\(?우\s*[:：]?\s*|\(?우편번호\s*[:：]?\s*)(\d{5})\)?/i);
  if (postMatch) {
    postcode = postMatch[1];
  } else {
    // 5-digit at end in parenthesis e.g. (47306)
    const endPostMatch = cleaned.match(/\((\d{5})\)$/);
    if (endPostMatch) {
      postcode = endPostMatch[1];
    }
  }

  // Detect city/province
  let city: string | null = null;
  let stateProvince: string | null = null;

  const cityMatches = cleaned.match(/^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|제주도|서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s+([가-힣]+(?:시|군|구))/);

  if (cityMatches) {
    stateProvince = cityMatches[1];
    city = cityMatches[2];
  } else {
    const firstWord = cleaned.split(" ")[0];
    if (firstWord) stateProvince = firstWord;
  }

  return {
    line1: cleaned || null,
    line2: null,
    city,
    stateProvince,
    postcode,
    country: "한국",
    countryCode: "KR",
    formattedKr: cleaned || null,
    formattedEn: null,
  };
}

/**
 * Core parsing function for copied Naver Smart Store seller information.
 *
 * Supported formats:
 * 1. Multiline text where label and value are on alternating lines:
 *    상호명
 *    주식회사 앨리스루움(ALice Ruum Co.,Ltd)
 *    (법인 사업자)
 * 2. Key-value lines with colons or tabs:
 *    상호명: 주식회사 앨리스루움
 *    대표자	서희경
 * 3. Copied table blocks with UI noise:
 *    고객센터 010-7979-7270 인증잘못된 번호 신고
 */
export function parseNaverSellerInfo(
  rawText: string,
  storeUrl?: string
): ParsedNaverSellerInfo {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return {
      legalCompanyName: "",
      companyNameEn: null,
      representativeName: "",
      phone: "",
      phoneRaw: "",
      businessRegistrationNumber: "",
      businessRegistrationNumberFormatted: "",
      addressRaw: "",
      address: {
        line1: null,
        line2: null,
        city: null,
        stateProvince: null,
        postcode: null,
        country: "한국",
        countryCode: "KR",
        formattedKr: null,
        formattedEn: null,
      },
      email: "",
      onlineSalesRegistrationNumber: null,
      isCorporate: false,
      storeUrl: storeUrl || "",
      storeIdentifier: "",
      inferredBrandName: "",
      missingFields: [
        "상호명 (Company Name)",
        "대표자 (Representative)",
        "고객센터 (Phone)",
        "사업자등록번호 (Business Reg No)",
        "사업장 소재지 (Address)",
        "이메일 (Email)",
      ],
      warnings: ["복사된 판매자 정보 텍스트가 비어 있습니다."],
      rawText: rawText || "",
    };
  }

  // Pre-process text lines
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Storage for extracted raw blocks
  const fieldBlocks: Record<string, string[]> = {
    company: [],
    representative: [],
    phone: [],
    businessRegNo: [],
    address: [],
    onlineSalesNo: [],
    email: [],
    other: [],
  };

  let currentField: keyof typeof fieldBlocks | null = null;

  // Header detection patterns
  const headerPatterns: Array<{ key: keyof typeof fieldBlocks; regex: RegExp }> = [
    { key: "company", regex: /^(?:상호명|상호|상호\s*\/\s*대표자)/i },
    { key: "representative", regex: /^(?:대표자명|대표자|대표|성명)/i },
    { key: "phone", regex: /^(?:고객센터|전화번호|고객센터\s*전화번호|연락처|유선전화)/i },
    { key: "businessRegNo", regex: /^(?:사업자등록번호|사업자\s*등록번호|사업자번호)/i },
    { key: "address", regex: /^(?:사업장\s*소재지|사업장소재지|소재지|사업장\s*주소|주소)/i },
    { key: "onlineSalesNo", regex: /^(?:통신판매업번호|통신판매업신고번호|통신판매업\s*신고번호|통신판매신고번호|통신판매신고|통신판매업)/i },
    { key: "email", regex: /^(?:e-mail|email|이메일|전자우편)/i },
    { key: "other", regex: /^(?:호스팅서비스|호스팅서비스\s*제공자|부가세)/i },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line starts with or is a recognized header
    let matchedHeaderKey: keyof typeof fieldBlocks | null = null;
    let restOfLine = "";

    for (const hp of headerPatterns) {
      // Check exact label or label with colon / tab / space
      const prefixMatch = line.match(new RegExp(`^${hp.regex.source}\\s*[:：\\t]?\\s*(.*)$`, "i"));
      if (prefixMatch) {
        matchedHeaderKey = hp.key;
        restOfLine = prefixMatch[1] ? prefixMatch[1].trim() : "";
        break;
      }
    }

    if (matchedHeaderKey) {
      currentField = matchedHeaderKey;
      if (restOfLine) {
        fieldBlocks[currentField].push(restOfLine);
      }
    } else if (currentField) {
      // Continuation of current field
      fieldBlocks[currentField].push(line);
    } else {
      // No header yet; line might be loose information
      // Check if line contains email or phone directly
      if (line.includes("@") && !fieldBlocks.email.length) {
        fieldBlocks.email.push(line);
      } else if (/\d{3}-\d{3,4}-\d{4}/.test(line) && !fieldBlocks.phone.length) {
        fieldBlocks.phone.push(line);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 1. Legal Company Name Extraction & Corporate Flag
  // --------------------------------------------------------------------------
  let rawCompanyBlock = fieldBlocks.company.join(" ").trim();
  let isCorporate = false;

  if (rawCompanyBlock.includes("법인 사업자") || rawCompanyBlock.includes("법인사업자") || rawCompanyBlock.includes("주식회사") || rawCompanyBlock.includes("㈜")) {
    isCorporate = true;
  }

  // Remove corporate annotations from company name
  let cleanCompanyName = rawCompanyBlock
    .replace(/\(법인\s*사업자\)/gi, "")
    .replace(/\(개인\s*사업자\)/gi, "")
    .replace(/법인\s*사업자/gi, "")
    .replace(/개인\s*사업자/gi, "")
    .trim();

  // If company name was not caught under header, check lines near the top
  if (!cleanCompanyName && lines.length > 1) {
    if (lines[0].includes("상호") && lines[1]) {
      cleanCompanyName = lines[1].replace(/\(법인\s*사업자\)/gi, "").trim();
    }
  }

  // Extract English name if present in parentheses e.g. "주식회사 앨리스루움(ALice Ruum Co.,Ltd)"
  let companyNameEn: string | null = null;
  const enMatch = cleanCompanyName.match(/\(([A-Za-z0-9\s.,&'-]+)\)/);
  if (enMatch && /[A-Za-z]{3,}/.test(enMatch[1])) {
    companyNameEn = enMatch[1].trim();
  }

  if (!cleanCompanyName) {
    missingFields.push("상호명 (Company Name)");
  }

  // --------------------------------------------------------------------------
  // 2. Representative Name Extraction
  // --------------------------------------------------------------------------
  let rawRepBlock = fieldBlocks.representative.join(" ").trim();
  let cleanRepresentative = rawRepBlock
    .replace(/대표자명\s*[:：]?/gi, "")
    .replace(/대표자\s*[:：]?/gi, "")
    .replace(/대표\s*[:：]?/gi, "")
    .trim();

  // Remove trailing phone numbers or noise if accidentally concatenated
  cleanRepresentative = cleanRepresentative.replace(/[\d-]{7,}/g, "").trim();

  if (!cleanRepresentative) {
    missingFields.push("대표자 (Representative)");
  }

  // --------------------------------------------------------------------------
  // 3. Phone / Telephone Extraction
  // --------------------------------------------------------------------------
  let rawPhoneBlock = fieldBlocks.phone.join(" ").trim();
  const phoneResult = normalizePhoneNumber(rawPhoneBlock);
  const cleanPhone = phoneResult.normalized;

  if (!cleanPhone || !phoneResult.isValid) {
    missingFields.push("고객센터 전화번호 (Company Telephone)");
    if (rawPhoneBlock) {
      warnings.push(`전화번호 형식이 표준적이지 않습니다: "${rawPhoneBlock}"`);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Business Registration Number (10 Digits)
  // --------------------------------------------------------------------------
  let rawBrnBlock = fieldBlocks.businessRegNo.join(" ").trim();
  const brnResult = normalizeBusinessRegistrationNumber(rawBrnBlock);
  const cleanBrn = brnResult.normalized;
  const formattedBrn = brnResult.formatted;

  if (!cleanBrn || !brnResult.isValid) {
    missingFields.push("사업자등록번호 (Business Registration Number)");
    if (rawBrnBlock) {
      warnings.push(`사업자등록번호가 10자리가 아닙니다: "${rawBrnBlock}"`);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Business Address Extraction
  // --------------------------------------------------------------------------
  let rawAddressBlock = fieldBlocks.address.join(" ").trim();
  const addressParsed = parseKoreanAddress(rawAddressBlock);

  if (!rawAddressBlock || !addressParsed.line1) {
    missingFields.push("사업장 소재지 (Business Address)");
  }

  // --------------------------------------------------------------------------
  // 6. Contact Email Extraction
  // --------------------------------------------------------------------------
  let rawEmailBlock = fieldBlocks.email.join(" ").trim();
  let emailResult = extractEmail(rawEmailBlock);

  // If email was not found under 'email' header, scan entire text
  if (!emailResult.email) {
    emailResult = extractEmail(rawText);
  }

  const cleanEmail = emailResult.email;
  if (!cleanEmail || !emailResult.isValid) {
    missingFields.push("이메일 (Contact Email)");
  }

  // --------------------------------------------------------------------------
  // 7. Online Sales Registration Number (Optional)
  // --------------------------------------------------------------------------
  let rawOnlineSalesBlock = fieldBlocks.onlineSalesNo.join(" ").trim();
  let onlineSalesRegistrationNumber: string | null = null;
  if (rawOnlineSalesBlock) {
    const cleaned = rawOnlineSalesBlock
      .replace(/통신판매업번호\s*[:：]?/gi, "")
      .replace(/통신판매업신고번호\s*[:：]?/gi, "")
      .replace(/조회/gi, "")
      .trim();
    if (cleaned) {
      onlineSalesRegistrationNumber = cleaned;
    }
  }

  // --------------------------------------------------------------------------
  // 8. Store URL & Inferred Brand Name (Decoupled from Company Name)
  // --------------------------------------------------------------------------
  let cleanStoreUrl = "";
  let storeIdentifier = "";
  let inferredBrandName = "";

  if (storeUrl && storeUrl.trim()) {
    const urlValidation = validateNaverStoreUrl(storeUrl.trim());
    if (urlValidation.isValid) {
      cleanStoreUrl = urlValidation.normalizedUrl;
      storeIdentifier = `naver-${urlValidation.channelSlug}`;
      inferredBrandName = urlValidation.inferredBrandName;
    } else {
      cleanStoreUrl = storeUrl.trim();
      storeIdentifier = `naver-${Date.now()}`;
      warnings.push(urlValidation.error || "스토어 URL 검증에 실패했습니다.");
    }
  } else {
    warnings.push("스토어 URL이 입력되지 않았습니다. 상호명을 기반으로 브랜드를 생성합니다.");
  }

  // If inferred brand name is still empty, derive a default from company name
  if (!inferredBrandName && cleanCompanyName) {
    inferredBrandName = cleanCompanyName
      .replace(/주식회사|\(주\)|\㈜/g, "")
      .replace(/\(.*\)/g, "")
      .trim();
  }

  return {
    legalCompanyName: cleanCompanyName,
    companyNameEn,
    representativeName: cleanRepresentative,
    phone: cleanPhone,
    phoneRaw: rawPhoneBlock,
    businessRegistrationNumber: cleanBrn,
    businessRegistrationNumberFormatted: formattedBrn,
    addressRaw: rawAddressBlock,
    address: addressParsed,
    email: cleanEmail,
    onlineSalesRegistrationNumber,
    isCorporate,
    storeUrl: cleanStoreUrl,
    storeIdentifier,
    inferredBrandName,
    missingFields,
    warnings,
    rawText,
  };
}

/**
 * Converts a ParsedNaverSellerInfo into a NormalizedCompanyDraft ready for
 * loading into the Brand Sourcing Review Workspace.
 *
 * Enforces:
 * - Legal entity and brand name strict decoupling
 * - Source provider recorded as "NAVER_SMARTSTORE"
 * - Marketing consent strictly set to "UNCONFIRMED"
 * - Original raw text preserved in payload snapshot
 */
export function convertNaverSellerInfoToDraft(
  parsed: ParsedNaverSellerInfo
): NormalizedCompanyDraft {
  const now = new Date().toISOString();

  const businessTypes: BusinessType[] = parsed.isCorporate
    ? ["BRAND_OWNER", "MANUFACTURER"]
    : ["BRAND_OWNER"];

  const draftBrand: SourcingBrand = {
    nameKr: parsed.inferredBrandName || parsed.legalCompanyName || "스토어 브랜드",
    nameEn: parsed.companyNameEn || null,
    description: parsed.storeUrl ? `네이버 스마트스토어 판매 브랜드: ${parsed.storeUrl}` : null,
    categories: [],
    keyProducts: [],
    source: "SOURCE_EXHIBITION",
  };

  const draftContact: SourcingContact = {
    name: parsed.representativeName || "대표자",
    department: "대표",
    jobTitle: "대표자",
    email: parsed.email || "",
    phone: parsed.phone || null,
    isPrimary: true,
    source: "SOURCE_EXHIBITION",
    sourceUrl: parsed.storeUrl || null,
  };

  const websites: SourcingWebsite[] = [];
  if (parsed.storeUrl) {
    websites.push({
      url: parsed.storeUrl,
      label: "SHOP",
      source: "SOURCE_EXHIBITION",
    });
  }

  const auditNotes: string[] = [
    "네이버 스마트스토어 판매자 정보 파싱 완료.",
  ];
  if (parsed.onlineSalesRegistrationNumber) {
    auditNotes.push(`통신판매업번호: ${parsed.onlineSalesRegistrationNumber}`);
  }
  if (parsed.warnings.length > 0) {
    auditNotes.push(...parsed.warnings);
  }

  return {
    company: {
      nameKr: parsed.legalCompanyName || "",
      nameEn: parsed.companyNameEn || null,
      descriptionKr: `네이버 스마트스토어 판매자 등록 기업 (${parsed.storeUrl || "Smart Store"})`,
      descriptionEn: null,
      address: parsed.address,
      businessTypes,
      businessTypeEvidence: [
        {
          type: "BRAND_OWNER",
          text: `네이버 스마트스토어 판매자 정보 파싱 (상호: ${parsed.legalCompanyName}, 사업자등록번호: ${parsed.businessRegistrationNumberFormatted})`,
          source: "SOURCE_EXHIBITION",
          sourceUrl: parsed.storeUrl || null,
          status: "ADMIN_EDIT",
        },
      ],
      primaryProductCategories: [],
      primaryCategoriesConfirmed: false,
      representativeName: parsed.representativeName || null,
      businessRegistrationNumber: parsed.businessRegistrationNumberFormatted || parsed.businessRegistrationNumber || null,
      telephone: parsed.phone || null,
      companyPhone: parsed.phone || null,
    },
    brands: [draftBrand],
    contacts: [draftContact],
    websites,
    socialMedia: [],
    categories: [],
    companyProducts: [],
    companyDocuments: [],
    source: {
      provider: "NAVER_SMARTSTORE",
      sourceUrl: parsed.storeUrl || "",
      sourceIdentifier: parsed.storeIdentifier || `naver-${parsed.businessRegistrationNumber || Date.now()}`,
      collectedAt: now,
      eventEditionId: null,
      standLocation: null,
      rawPayloadSnapshot: {
        provenance: "NAVER_SMARTSTORE_SELLER_INFO",
        rawCopiedText: parsed.rawText,
        onlineSalesRegistrationNumber: parsed.onlineSalesRegistrationNumber,
        isCorporate: parsed.isCorporate,
        parsedAt: now,
      },
    },
    enrichment: {
      attempted: false,
      success: false,
      enrichedUrl: null,
      enrichedPages: [],
    },
    audit: {
      status: parsed.missingFields.length === 0 ? "SUCCESS" : "PARTIAL",
      missingKeyFields: parsed.missingFields,
      notes: auditNotes,
    },
  };
}
