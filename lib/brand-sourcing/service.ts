import { resolveSourceAdapter } from "./adapters";
import { NormalizedCompanyDraft, ExtractionOptions } from "./types";
import { validateSafeExternalUrl } from "./security";

/**
 * Main service entrypoint for extracting and normalizing brand sourcing leads from exhibition URLs.
 *
 * @param url The exhibitor detail URL (e.g. InterCHARM Korea exhibitor detail page)
 * @param options Extraction and enrichment configurations
 * @returns Fully typed NormalizedCompanyDraft
 */
export async function extractSourcingDraft(
  url: string,
  options?: ExtractionOptions
): Promise<NormalizedCompanyDraft> {
  // 1. Validate URL against SSRF and syntax errors
  validateSafeExternalUrl(url);

  // 2. Resolve matching SourceAdapter
  const adapter = resolveSourceAdapter(url);

  // 3. Extract and normalize data
  const draft = await adapter.extract(url, options);

  return draft;
}
