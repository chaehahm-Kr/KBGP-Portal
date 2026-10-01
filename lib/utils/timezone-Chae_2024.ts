/**
 * Single source of truth for Eastern Time (America/New_York) timezone formatting.
 * Ensures consistent DST-safe date and time display across Admin and Portal.
 */

const EASTERN_TIMEZONE = "America/New_York";

/**
 * Formats a Date or ISO timestamp string as `YYYY-MM-DD` in Eastern Time (America/New_York).
 * Returns "-" if date is null, undefined, or invalid.
 */
export function formatEasternDate(
  date: string | Date | null | undefined
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  // Use Intl.DateTimeFormat with en-CA which formats as YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(d);
}

/**
 * Formats a Date or ISO timestamp string as `YYYY-MM-DD HH:mm` in Eastern Time (America/New_York).
 * Returns "-" if date is null, undefined, or invalid.
 */
export function formatEasternDateTime(
  date: string | Date | null | undefined,
  includeSeconds = false
): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";

  const datePart = formatEasternDate(d);

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: EASTERN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  });

  const timePart = timeFormatter.format(d);
  return `${datePart} ${timePart}`;
}

/**
 * Returns today's date in `YYYY-MM-DD` formatted in Eastern Time (America/New_York).
 */
export function getEasternTodayString(): string {
  return formatEasternDate(new Date());
}
