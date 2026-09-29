/**
 * Authoritative Person Name Helpers
 * Task: PORT-NAME-001
 * 
 * Standardizes person-name data model, storage, display, and greetings across:
 * - Marketing Site Application
 * - Admin (Applications, Companies, Users, Responsibilities)
 * - Brand Portal (Dashboard, My Account, Team, Responsibilities)
 * - Email notifications & templates
 * 
 * Canonical 4-Component Model:
 * - korean_last_name (한글 성)
 * - korean_first_name (한글 이름)
 * - english_first_name (영문 First Name)
 * - english_last_name (영문 Last Name)
 */

export interface StructuredPersonNames {
  koreanLastName: string;
  koreanFirstName: string;
  englishFirstName: string;
  englishLastName: string;
  koreanFullName: string;
  englishFullName: string;
  canonicalEnglishName: string;
  displayName: string;
  greetingName: string;
  officialEnglishName: string;
}

export interface ResolvablePersonName {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  applicant_contact_name?: string | null;
  contact_name?: string | null;
  contactName?: string | null;

  english_name?: string | null;
  englishName?: string | null;

  korean_last_name?: string | null;
  koreanLastName?: string | null;
  korean_first_name?: string | null;
  koreanFirstName?: string | null;

  english_first_name?: string | null;
  englishFirstName?: string | null;
  first_name?: string | null;
  firstName?: string | null;

  english_last_name?: string | null;
  englishLastName?: string | null;
  last_name?: string | null;
  lastName?: string | null;

  email?: string | null;
  applicant_contact_email?: string | null;
  contact_email?: string | null;
  contactEmail?: string | null;

  phone?: string | null;
  phone_country_code?: string | null;
  phoneCountryCode?: string | null;
  phone_number?: string | null;
  phoneNumber?: string | null;

  title?: string | null;
  contact_title?: string | null;
  contactTitle?: string | null;
  position?: string | null;

  permissions?: {
    korean_last_name?: string | null;
    koreanLastName?: string | null;
    korean_first_name?: string | null;
    koreanFirstName?: string | null;
    english_first_name?: string | null;
    englishFirstName?: string | null;
    english_last_name?: string | null;
    englishLastName?: string | null;
    first_name?: string | null;
    firstName?: string | null;
    last_name?: string | null;
    lastName?: string | null;
    english_name?: string | null;
    englishName?: string | null;
    [key: string]: any;
  } | null;

  [key: string]: any;
}

const KOREAN_REGEX = /[\uac00-\ud7a3]/;
const LATIN_REGEX = /[a-zA-Z]/;

/**
 * Extracts and canonicalizes the 4 person-name components and derived displays.
 */
export function getPersonStructuredNames(
  person?: ResolvablePersonName | string | null
): StructuredPersonNames {
  if (!person) {
    return {
      koreanLastName: "",
      koreanFirstName: "",
      englishFirstName: "",
      englishLastName: "",
      koreanFullName: "",
      englishFullName: "",
      canonicalEnglishName: "",
      displayName: "",
      greetingName: "",
      officialEnglishName: "",
    };
  }

  // Handle raw string input
  if (typeof person === "string") {
    const trimmed = person.trim();
    if (!trimmed) {
      return {
        koreanLastName: "",
        koreanFirstName: "",
        englishFirstName: "",
        englishLastName: "",
        koreanFullName: "",
        englishFullName: "",
        canonicalEnglishName: "",
        displayName: "",
        greetingName: "",
        officialEnglishName: "",
      };
    }

    // Check if string is already formatted as "English (Korean)", e.g. "Eun Park (박은애)"
    const combinedMatch = trimmed.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (combinedMatch) {
      const engPart = combinedMatch[1].trim();
      const korPart = combinedMatch[2].trim();
      const engTokens = engPart.split(/\s+/);
      const engLast = engTokens.length > 1 ? engTokens[engTokens.length - 1] : "";
      const engFirst = engTokens.length > 1 ? engTokens.slice(0, -1).join(" ") : engTokens[0] || "";

      return {
        koreanLastName: korPart.length > 1 ? korPart.charAt(0) : "",
        koreanFirstName: korPart.length > 1 ? korPart.slice(1) : korPart,
        englishFirstName: engFirst,
        englishLastName: engLast,
        koreanFullName: korPart,
        englishFullName: engPart,
        canonicalEnglishName: engPart,
        displayName: `${engPart} (${korPart})`,
        greetingName: engFirst || korPart,
        officialEnglishName: engPart,
      };
    }

    // Check if purely Korean
    if (KOREAN_REGEX.test(trimmed) && !LATIN_REGEX.test(trimmed)) {
      return {
        koreanLastName: "",
        koreanFirstName: "",
        englishFirstName: "",
        englishLastName: "",
        koreanFullName: trimmed,
        englishFullName: "",
        canonicalEnglishName: "",
        displayName: trimmed,
        greetingName: trimmed,
        officialEnglishName: "",
      };
    }

    // Check if email
    if (trimmed.includes("@")) {
      return {
        koreanLastName: "",
        koreanFirstName: "",
        englishFirstName: "",
        englishLastName: "",
        koreanFullName: "",
        englishFullName: "",
        canonicalEnglishName: "",
        displayName: trimmed,
        greetingName: trimmed,
        officialEnglishName: "",
      };
    }

    // Purely Latin / English
    const engTokens = trimmed.split(/\s+/);
    const engLast = engTokens.length > 1 ? engTokens[engTokens.length - 1] : "";
    const engFirst = engTokens.length > 1 ? engTokens.slice(0, -1).join(" ") : engTokens[0] || "";

    return {
      koreanLastName: "",
      koreanFirstName: "",
      englishFirstName: engFirst,
      englishLastName: engLast,
      koreanFullName: "",
      englishFullName: trimmed,
      canonicalEnglishName: trimmed,
      displayName: trimmed,
      greetingName: engFirst || trimmed,
      officialEnglishName: trimmed,
    };
  }

  // Object Input: Extract explicit fields & permissions
  const perms = person.permissions || {};

  const rawKoreanLastName = (
    person.korean_last_name ||
    person.koreanLastName ||
    perms.korean_last_name ||
    perms.koreanLastName ||
    ""
  ).trim();

  const rawKoreanFirstName = (
    person.korean_first_name ||
    person.koreanFirstName ||
    perms.korean_first_name ||
    perms.koreanFirstName ||
    ""
  ).trim();

  const rawEnglishFirstName = (
    person.english_first_name ||
    person.englishFirstName ||
    person.first_name ||
    person.firstName ||
    perms.english_first_name ||
    perms.englishFirstName ||
    perms.first_name ||
    perms.firstName ||
    ""
  ).trim();

  const rawEnglishLastName = (
    person.english_last_name ||
    person.englishLastName ||
    person.last_name ||
    person.lastName ||
    perms.english_last_name ||
    perms.englishLastName ||
    perms.last_name ||
    perms.lastName ||
    ""
  ).trim();

  const rawLegacyName = (
    person.name ||
    person.full_name ||
    person.fullName ||
    person.displayName ||
    person.display_name ||
    person.applicant_contact_name ||
    person.contact_name ||
    person.contactName ||
    ""
  ).trim();

  const rawExplicitEnglish = (
    person.english_name ||
    person.englishName ||
    perms.english_name ||
    perms.englishName ||
    ""
  ).trim();

  const email = (
    person.email ||
    person.applicant_contact_email ||
    person.contact_email ||
    person.contactEmail ||
    ""
  ).trim();

  // Check for combined parenthesized patterns in rawLegacyName (e.g. "박은애 (Eun Park)" or "Eun Park (박은애)")
  let extractedLegacyKor = "";
  let extractedLegacyEng = "";
  if (rawLegacyName) {
    const combinedMatch = rawLegacyName.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (combinedMatch) {
      const p1 = combinedMatch[1].trim();
      const p2 = combinedMatch[2].trim();
      if (LATIN_REGEX.test(p1) && KOREAN_REGEX.test(p2)) {
        extractedLegacyEng = p1;
        extractedLegacyKor = p2;
      } else if (KOREAN_REGEX.test(p1) && LATIN_REGEX.test(p2)) {
        extractedLegacyKor = p1;
        extractedLegacyEng = p2;
      }
    }
  }

  // 1. Resolve Korean Full Name
  let koreanFullName = "";
  if (rawKoreanLastName && rawKoreanFirstName) {
    koreanFullName = `${rawKoreanLastName}${rawKoreanFirstName}`;
  } else if (rawKoreanLastName || rawKoreanFirstName) {
    koreanFullName = `${rawKoreanLastName}${rawKoreanFirstName}`.trim();
  } else if (extractedLegacyKor) {
    koreanFullName = extractedLegacyKor;
  } else if (rawLegacyName && KOREAN_REGEX.test(rawLegacyName)) {
    // If legacy name contains Korean
    koreanFullName = rawLegacyName;
  }

  // 2. Resolve English Full Name
  let englishFullName = "";
  let englishFirstName = rawEnglishFirstName;
  let englishLastName = rawEnglishLastName;

  if (rawEnglishFirstName && rawEnglishLastName) {
    englishFullName = `${rawEnglishFirstName} ${rawEnglishLastName}`.trim();
  } else if (rawExplicitEnglish) {
    englishFullName = rawExplicitEnglish;
    if (!englishFirstName && !englishLastName) {
      const parts = rawExplicitEnglish.split(/\s+/);
      if (parts.length > 1) {
        englishLastName = parts[parts.length - 1];
        englishFirstName = parts.slice(0, -1).join(" ");
      } else {
        englishFirstName = parts[0];
      }
    }
  } else if (extractedLegacyEng) {
    englishFullName = extractedLegacyEng;
    if (!englishFirstName && !englishLastName) {
      const parts = extractedLegacyEng.split(/\s+/);
      if (parts.length > 1) {
        englishLastName = parts[parts.length - 1];
        englishFirstName = parts.slice(0, -1).join(" ");
      } else {
        englishFirstName = parts[0];
      }
    }
  } else if (rawLegacyName && !KOREAN_REGEX.test(rawLegacyName) && LATIN_REGEX.test(rawLegacyName)) {
    // Legacy name is English/Latin
    englishFullName = rawLegacyName;
    if (!englishFirstName && !englishLastName) {
      const parts = rawLegacyName.split(/\s+/);
      if (parts.length > 1) {
        englishLastName = parts[parts.length - 1];
        englishFirstName = parts.slice(0, -1).join(" ");
      } else {
        englishFirstName = parts[0];
      }
    }
  }

  // 3. Resolve Display Name
  // Rule A: English + Korean available -> `English First Last (한글성명)` (e.g. `Eun Park (박은애)`)
  // Rule B: English only -> `English First Last`
  // Rule C: Korean only -> `한글성명`
  // Rule D: Existing legacy full name only -> `existing full name`
  // Rule E: No usable name -> `email address` as final fallback only
  let displayName = "";
  if (englishFullName && koreanFullName) {
    displayName = `${englishFullName} (${koreanFullName})`;
  } else if (englishFullName) {
    displayName = englishFullName;
  } else if (koreanFullName) {
    displayName = koreanFullName;
  } else if (rawLegacyName) {
    displayName = rawLegacyName;
  } else if (email) {
    displayName = email;
  }

  // 4. Resolve Greeting Name
  // If English First Name exists -> `Eun` (or Tammy)
  // Else if Korean First Name exists -> `은애`
  // Else if Korean Full Name -> `박은애`
  // Else if English Full Name -> `Eun Park`
  // Else if legacy name -> reasonable name
  // Email only last fallback
  let greetingName = "";
  if (englishFirstName) {
    greetingName = englishFirstName;
  } else if (rawKoreanFirstName) {
    greetingName = rawKoreanFirstName;
  } else if (koreanFullName) {
    greetingName = koreanFullName;
  } else if (englishFullName) {
    greetingName = englishFullName;
  } else if (rawLegacyName) {
    greetingName = rawLegacyName;
  } else if (email) {
    greetingName = email;
  }

  return {
    koreanLastName: rawKoreanLastName,
    koreanFirstName: rawKoreanFirstName,
    englishFirstName,
    englishLastName,
    koreanFullName,
    englishFullName,
    canonicalEnglishName: englishFullName,
    displayName,
    greetingName,
    officialEnglishName: englishFullName,
  };
}

/**
 * Formats Korean Last Name and First Name into standard Korean full name (e.g. "박" + "은애" -> "박은애").
 */
export function formatKoreanFullName(lastName?: string | null, firstName?: string | null): string {
  const l = (lastName || "").trim();
  const f = (firstName || "").trim();
  return `${l}${f}`.trim();
}

/**
 * Formats English First Name and Last Name into standard English full name (e.g. "Eun" + "Park" -> "Eun Park").
 */
export function formatEnglishFullName(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  return [f, l].filter(Boolean).join(" ");
}

/**
 * Resolves the unified display name according to DEPLOY-STD-001 / PORT-NAME-001 standard:
 * 
 * Rules:
 * A. English + Korean available: `English First Last (한글성명)` (e.g. `Eun Park (박은애)`)
 * B. English only: `English First Last`
 * C. Korean only: `한글성명`
 * D. Existing legacy full name only: `existing full name`
 * E. No usable name: `email address` as final fallback only
 */
export function getPersonDisplayName(person?: ResolvablePersonName | string | null): string {
  if (!person) return "";
  const structured = getPersonStructuredNames(person);
  return structured.displayName;
}

/**
 * Resolves the conversational greeting name:
 * 
 * Preferred:
 * - If English First Name exists: `Eun` -> `안녕하세요, Eun님.`
 * - Else if Korean First Name exists: `은애` -> `안녕하세요, 은애님.`
 * - Else if legacy name exists: use existing name
 * - Email address as last fallback only
 */
export function getPersonGreetingName(person?: ResolvablePersonName | string | null): string {
  if (!person) return "";
  const structured = getPersonStructuredNames(person);
  return structured.greetingName;
}

/**
 * Resolves the official English legal/business name (e.g. "Eun Park").
 * Used across POs, Invoices, English Agreements, and official export/shipping documents.
 */
export function getOfficialEnglishName(person?: ResolvablePersonName | string | null): string {
  if (!person) return "";
  const structured = getPersonStructuredNames(person);
  return structured.officialEnglishName;
}

/**
 * Resolves native/local Korean display name (e.g. "박은애").
 */
export function getNativeDisplayName(person?: ResolvablePersonName | string | null): string {
  if (!person) return "";
  const structured = getPersonStructuredNames(person);
  return structured.koreanFullName || structured.displayName;
}
