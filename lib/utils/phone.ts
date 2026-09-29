import { ALL_COUNTRIES } from "@/lib/constants/countries";

export interface ParsedPhone {
  callingCode: string; // e.g. "+82", "+1"
  localNumber: string; // e.g. "33-3333-3333", "10-1234-5678"
  fullNumber: string;  // e.g. "+82 33-3333-3333", "+1 856-555-1234"
}

/**
 * Parses existing DB raw phone strings into Calling Code & Local Number.
 * Defaults to South Korea (+82) for empty/unspecified inputs while preserving existing country codes.
 * Preserves user-entered hyphens and local number formatting exactly.
 */
export function parsePhoneNumber(
  rawPhone: string | null | undefined,
  defaultCallingCode: string = "+82"
): ParsedPhone {
  if (!rawPhone || !rawPhone.trim()) {
    return { callingCode: defaultCallingCode, localNumber: "", fullNumber: "" };
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
      
      rest = rest.replace(/^[\s]+/, "").trim();
      return {
        callingCode: code,
        localNumber: rest,
        fullNumber: `${code} ${rest}`.trim(),
      };
    }
  }

  // If starts with 010, 02, 031, etc. in South Korea without + prefix
  if (/^01[0-9]|^0[2-6][0-9]/.test(cleaned)) {
    const local = cleaned.replace(/^0/, "");
    return {
      callingCode: "+82",
      localNumber: local,
      fullNumber: `+82 ${local}`,
    };
  }

  // Fallback default: South Korea (+82) or defaultCallingCode, preserving raw local number
  return {
    callingCode: defaultCallingCode,
    localNumber: cleaned,
    fullNumber: `${defaultCallingCode} ${cleaned}`.trim(),
  };
}

/**
 * Formats Calling Code & Local Number into full international phone number string.
 * Preserves user-typed hyphens and spacing exactly without destructive digit-only stripping.
 */
export function formatPhoneNumber(callingCode: string, localNumber: string): string {
  const cleanLocal = (localNumber || "").trim();
  if (!cleanLocal) return "";
  const cleanCode = (callingCode || "+82").trim();
  return `${cleanCode} ${cleanLocal}`.trim();
}

