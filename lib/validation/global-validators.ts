/**
 * Global Input Validation Standardization
 * Task ID: SYS-VAL-001
 * 
 * Central Authoritative Validators for:
 * 1. English Person Names (First Name, Last Name)
 * 2. Numeric Price & Cost Fields (MSRP, FOB, Supply, Wholesale, Retail, etc.)
 */

// ============================================================================
// 1. ENGLISH PERSON NAME VALIDATION
// ============================================================================
export const ENGLISH_NAME_REGEX = /^[A-Za-z\s'\-]+$/;

/**
 * Checks if a given string contains ONLY English letters, spaces, apostrophes, and hyphens.
 * Returns false for empty string, Korean characters, digits, or other symbols.
 */
export function isPureEnglishName(name?: string | null): boolean {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  return ENGLISH_NAME_REGEX.test(trimmed);
}

export type EnglishNameValidationResult = {
  valid: boolean;
  error?: string;
  sanitizedValue?: string;
};

export function validateEnglishName(
  name?: string | null,
  options: {
    required?: boolean;
    fieldNameKo?: string;
    fieldNameEn?: string;
    language?: "ko" | "en";
  } = {}
): EnglishNameValidationResult {
  const {
    required = true,
    fieldNameKo = "영문 이름",
    fieldNameEn = "English name",
    language = "ko",
  } = options;

  const trimmed = (name || "").trim();

  if (!trimmed) {
    if (required) {
      return {
        valid: false,
        error: language === "ko" ? `${fieldNameKo}을(를) 입력해 주세요.` : `Please enter the ${fieldNameEn}.`,
      };
    }
    return { valid: true, sanitizedValue: "" };
  }

  if (!ENGLISH_NAME_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 영문자로 입력해 주세요.`
        : `Please enter the ${fieldNameEn} using English letters only.`,
    };
  }

  return { valid: true, sanitizedValue: trimmed };
}

// ============================================================================
// 2. NUMERIC PRICE & COST VALIDATION
// ============================================================================
/**
 * Allowed price formats:
 * - Pure non-negative integer: 10, 1500, 25000, 0
 * - Non-negative decimal: 12.99, 7.50, 0.99, 0.00
 * - Blocks letters, currency symbols ('$', '₩', 'USD'), commas, or negative numbers.
 */
export const NUMERIC_PRICE_REGEX = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function isNumericPrice(val: unknown, allowZero = true): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (str === "") return false;

  if (!NUMERIC_PRICE_REGEX.test(str)) return false;

  const num = Number(str);
  if (isNaN(num)) return false;
  if (!allowZero && num <= 0) return false;
  if (num < 0) return false;

  return true;
}

export function normalizePrice(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === "") return null;
  if (!NUMERIC_PRICE_REGEX.test(str)) return null;
  const num = Number(str);
  return isNaN(num) || num < 0 ? null : num;
}

export type PriceValidationResult = {
  valid: boolean;
  error?: string;
  value?: number | null;
};

export function validatePrice(
  val: unknown,
  options: {
    required?: boolean;
    allowZero?: boolean;
    allowDecimal?: boolean;
    fieldNameKo?: string;
    fieldNameEn?: string;
    language?: "ko" | "en";
  } = {}
): PriceValidationResult {
  const {
    required = true,
    allowZero = true,
    allowDecimal = true,
    fieldNameKo = "가격",
    fieldNameEn = "price",
    language = "ko",
  } = options;

  if (val === null || val === undefined || String(val).trim() === "") {
    if (required) {
      return {
        valid: false,
        error: language === "ko" ? `${fieldNameKo}을(를) 입력해 주세요.` : `Please enter the ${fieldNameEn}.`,
      };
    }
    return { valid: true, value: null };
  }

  const str = String(val).trim();

  // Test numeric format
  if (!NUMERIC_PRICE_REGEX.test(str)) {
    // Check if it contains invalid letters or symbols
    if (/[a-zA-Z가-힣$₩,]/.test(str)) {
      return {
        valid: false,
        error: language === "ko"
          ? `${fieldNameKo}은(는) 숫자만 입력해 주세요.`
          : `Please enter numbers only for the ${fieldNameEn}.`,
      };
    }
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 올바른 숫자 형식으로 입력해 주세요. 예: 12.99`
        : `Please enter a valid numeric format for the ${fieldNameEn}. (e.g. 12.99)`,
    };
  }

  const num = Number(str);
  if (isNaN(num)) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 숫자만 입력해 주세요.`
        : `Please enter numbers only for the ${fieldNameEn}.`,
    };
  }

  if (num < 0) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 0 이상의 숫자만 입력해 주세요.`
        : `${fieldNameEn} must be 0 or greater.`,
    };
  }

  if (!allowZero && num === 0) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 0보다 큰 숫자를 입력해 주세요.`
        : `${fieldNameEn} must be greater than 0.`,
    };
  }

  if (!allowDecimal && str.includes(".")) {
    return {
      valid: false,
      error: language === "ko"
        ? `${fieldNameKo}은(는) 정수로만 입력해 주세요.`
        : `${fieldNameEn} must be an integer.`,
    };
  }

  return { valid: true, value: num };
}
