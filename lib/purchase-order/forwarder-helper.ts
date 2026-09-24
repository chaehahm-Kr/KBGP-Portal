export interface ForwarderDetails {
  forwarderName: string;
  forwarderContact: string;
  forwarderEmail: string;
  forwarderPhone: string;
  notes: string;
}

/**
 * Parse forwarder & note information from goods_readiness.special_instructions
 */
export function parseSpecialInstructions(raw?: string | null): ForwarderDetails {
  if (!raw) {
    return {
      forwarderName: "",
      forwarderContact: "",
      forwarderEmail: "",
      forwarderPhone: "",
      notes: "",
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        forwarderName: parsed.forwarderName || "",
        forwarderContact: parsed.forwarderContact || "",
        forwarderEmail: parsed.forwarderEmail || "",
        forwarderPhone: parsed.forwarderPhone || "",
        notes: parsed.notes || "",
      };
    }
  } catch {
    // If raw string is not JSON, treat it as plain text notes
  }
  return {
    forwarderName: "",
    forwarderContact: "",
    forwarderEmail: "",
    forwarderPhone: "",
    notes: raw,
  };
}

/**
 * Serialize forwarder & note information into goods_readiness.special_instructions JSON string
 */
export function serializeSpecialInstructions(details: Partial<ForwarderDetails>): string {
  return JSON.stringify({
    forwarderName: details.forwarderName?.trim() || "",
    forwarderContact: details.forwarderContact?.trim() || "",
    forwarderEmail: details.forwarderEmail?.trim() || "",
    forwarderPhone: details.forwarderPhone?.trim() || "",
    notes: details.notes?.trim() || "",
  });
}
