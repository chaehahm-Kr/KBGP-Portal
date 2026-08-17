import { ALL_COUNTRIES, TOP_COUNTRIES } from "@/lib/constants/countries";

export interface ParsedPhone {
  callingCode: string; // e.g. "+1", "+82"
  localNumber: string; // e.g. "8565551234", "1012345678"
  fullNumber: string;  // e.g. "+1 8565551234", "+82 1012345678"
}

/**
 * Parses existing DB raw phone strings into Calling Code & Local Number.
 * Preserves original content if no calling code matched.
 */
export function parsePhoneNumber(rawPhone: string | null | undefined): ParsedPhone {
  if (!rawPhone || !rawPhone.trim()) {
    return { callingCode: "+1", localNumber: "", fullNumber: "" };
  }

  const cleaned = rawPhone.trim();

  // Try matching +XX calling codes from master list (sorted by longest calling code first)
  const sortedCountries = [...ALL_COUNTRIES].sort(
    (a, b) => b.callingCode.length - a.callingCode.length
  );

  for (const country of sortedCountries) {
    const code = country.callingCode; // e.g. "+1-268", "+82", "+1"
    const sanitizedCode = code.replace("-", ""); // e.g. "+1268", "+82", "+1"

    if (cleaned.startsWith(code) || cleaned.startsWith(sanitizedCode)) {
      let rest = cleaned.startsWith(code)
        ? cleaned.slice(code.length)
        : cleaned.slice(sanitizedCode.length);
      
      rest = rest.replace(/^[\s\-().]+/, "").trim();
      return {
        callingCode: code,
        localNumber: rest,
        fullNumber: `${code} ${rest}`.trim(),
      };
    }
  }

  // If starts with 010, 02, 031, etc. in South Korea without + prefix
  if (/^01[0-9]|^0[2-6][0-9]/.test(cleaned)) {
    // Strip leading 0 for Korean international format if needed, but preserve numbers
    const local = cleaned.replace(/^0/, "");
    return {
      callingCode: "+82",
      localNumber: local,
      fullNumber: `+82 ${local}`,
    };
  }

  // Fallback default: US (+1) or return as raw local number
  return {
    callingCode: "+1",
    localNumber: cleaned,
    fullNumber: cleaned,
  };
}

/**
 * Formats Calling Code & Local Number into E.164 inspired full international number string
 */
export function formatPhoneNumber(callingCode: string, localNumber: string): string {
  const cleanLocal = localNumber.replace(/[^\d]/g, "");
  if (!cleanLocal) return "";
  const cleanCode = callingCode.trim();
  return `${cleanCode} ${cleanLocal}`.trim();
}
