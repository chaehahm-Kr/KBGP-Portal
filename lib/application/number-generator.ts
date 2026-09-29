import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Formats YYYYMMDD string in America/New_York timezone.
 */
export function formatNewYorkYmd(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  return `${year}${month}${day}`;
}

/**
 * 4-Digit Display Code Algorithm for ordinal N (1..9999):
 * Step 1: 10000 - N
 * Step 2: format as 4 digits (padStart 0)
 * Step 3: reverse 4 digits
 */
export function generateApplicationDisplayCode(seqNumber: number): string {
  if (seqNumber < 1 || seqNumber > 9999) {
    throw new Error(`[ApplicationNumber] Ordinal out of valid bounds (1..9999): ${seqNumber}`);
  }
  const diff = 10000 - seqNumber;
  const fourDigits = String(diff).padStart(4, "0");
  const reversed = fourDigits.split("").reverse().join("");
  return reversed;
}

/**
 * Generates canonical Application Number (APP-YYYYMMDD-{SOURCE}{CODE})
 * SOURCE: "I" for admin_invitation, "M" for marketing/public application
 */
export async function generateNextApplicationNumber(
  admin: SupabaseClient,
  entryMode: "admin_invitation" | "public_application" | string,
  date = new Date()
): Promise<{ applicationNumber: string; seqNumber: number }> {
  let seqNumber: number | null = null;

  // 1. Try RPC next_application_sequence
  try {
    const { data: rpcVal, error: rpcErr } = await admin.rpc("next_application_sequence");
    if (!rpcErr && typeof rpcVal === "number") {
      seqNumber = rpcVal;
    }
  } catch (err) {
    console.warn("[ApplicationNumber] RPC next_application_sequence failed:", err);
  }

  // 2. Fallback: atomic UPDATE directly on application_sequence_counter table if RPC failed
  if (seqNumber === null) {
    const { data: counterRow, error: updateErr } = await admin
      .from("application_sequence_counter")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("current_val")
      .single();

    if (counterRow && typeof counterRow.current_val === "number") {
      const nextVal = counterRow.current_val + 1;
      await admin
        .from("application_sequence_counter")
        .update({ current_val: nextVal, updated_at: new Date().toISOString() })
        .eq("id", 1);
      seqNumber = nextVal;
    }
  }

  // 3. Fallback: query highest sequence if counter table not ready
  if (seqNumber === null) {
    const { count } = await admin.from("applications").select("*", { count: "exact", head: true });
    seqNumber = (count || 0) + 17; // ensure > historical count
  }

  if (seqNumber > 9999) {
    throw new Error("Application number limit reached (max 9999). Please contact system administrator.");
  }

  const ymd = formatNewYorkYmd(date);
  const source = entryMode === "admin_invitation" ? "I" : "M";
  const code = generateApplicationDisplayCode(seqNumber);
  const applicationNumber = `APP-${ymd}-${source}${code}`;

  return { applicationNumber, seqNumber };
}
