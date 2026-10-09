/**
 * Letusto SKU Standardization & Validation Utilities
 * Enforces rule: English uppercase A-Z, digits 0-9, and dash (-) only.
 */

export const LETUSTO_SKU_REGEX = /^[A-Z0-9-]+$/;

export interface SkuValidationResult {
  isValid: boolean;
  normalizedSku: string;
  error: string | null;
}

/**
 * Normalizes an input SKU by trimming and converting to uppercase.
 */
export function normalizeLetustoSku(rawSku: string | null | undefined): string {
  if (!rawSku) return "";
  return rawSku.trim().toUpperCase();
}

/**
 * Validates a Letusto SKU against the authoritative format rules.
 */
export function validateLetustoSku(rawSku: string | null | undefined): SkuValidationResult {
  const normalized = normalizeLetustoSku(rawSku);

  if (!normalized) {
    return {
      isValid: false,
      normalizedSku: "",
      error: "Letusto SKU를 입력해주세요.",
    };
  }

  if (normalized.includes(" ")) {
    return {
      isValid: false,
      normalizedSku: normalized,
      error: "Letusto SKU에는 공백을 포함할 수 없습니다.",
    };
  }

  if (!LETUSTO_SKU_REGEX.test(normalized)) {
    return {
      isValid: false,
      normalizedSku: normalized,
      error: "Letusto SKU는 영문 대문자(A-Z), 숫자(0-9), 대시(-)만 사용할 수 있습니다. 특수문자나 공백은 허용되지 않습니다.",
    };
  }

  return {
    isValid: true,
    normalizedSku: normalized,
    error: null,
  };
}

export function isValidLetustoSkuFormat(sku: string): boolean {
  return LETUSTO_SKU_REGEX.test(sku);
}


