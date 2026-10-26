import type { NormalizedCompanyDraft, ExtractionOptions, SourcingProvider } from "../types";

export interface SourceAdapter {
  readonly provider: SourcingProvider;
  canHandle(url: string): boolean;
  extract(url: string, options?: ExtractionOptions): Promise<NormalizedCompanyDraft>;
}
