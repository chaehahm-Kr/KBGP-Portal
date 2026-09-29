/**
 * Authoritative Person Name Helpers
 * 
 * Provides official English legal/business name and native display name resolution.
 * Used across POs, Invoices, English Agreements, and official export/shipping documents.
 */

export interface ResolvablePersonName {
  name?: string | null;
  english_name?: string | null;
  englishName?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  permissions?: { english_name?: string | null; englishName?: string | null } | null;
}

/**
 * Resolves the official English legal/business name.
 * 
 * Priority:
 * 1. Explicit English Name (`english_name` / `englishName` / `permissions.english_name`)
 * 2. If missing, returns empty string ("") — strictly NO auto-romanization guessing.
 */
export function getOfficialEnglishName(user?: ResolvablePersonName | null): string {
  if (!user) return "";
  const explicit = (
    user.english_name ||
    user.englishName ||
    user.permissions?.english_name ||
    user.permissions?.englishName ||
    ""
  ).trim();

  return explicit;
}

/**
 * Resolves native/local display name (e.g. "박은애").
 */
export function getNativeDisplayName(user?: ResolvablePersonName | null): string {
  if (!user) return "";
  return (user.name || user.displayName || user.display_name || "").trim();
}
