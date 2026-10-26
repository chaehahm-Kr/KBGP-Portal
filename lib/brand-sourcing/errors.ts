/**
 * Brand Sourcing Error Classes
 * Standard error definitions for source adapters, SSRF guards, and enrichment.
 */

export class BrandSourcingError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: unknown) {
    super(message);
    this.name = "BrandSourcingError";
  }
}

export class InvalidSourceUrlError extends BrandSourcingError {
  constructor(message: string, url: string) {
    super(message, "INVALID_SOURCE_URL", { url });
    this.name = "InvalidSourceUrlError";
  }
}

export class SsrFProtectionError extends BrandSourcingError {
  constructor(message: string, targetHost: string) {
    super(message, "SSRF_PROTECTION_BLOCKED", { targetHost });
    this.name = "SsrFProtectionError";
  }
}

export class AdapterNotFoundError extends BrandSourcingError {
  constructor(url: string) {
    super(`No active source adapter registered for URL: ${url}`, "ADAPTER_NOT_FOUND", { url });
    this.name = "AdapterNotFoundError";
  }
}

export class SourceExtractionError extends BrandSourcingError {
  constructor(message: string, public readonly provider: string, details?: unknown) {
    super(message, "SOURCE_EXTRACTION_FAILED", details);
    this.name = "SourceExtractionError";
  }
}

export class WebsiteEnrichmentError extends BrandSourcingError {
  constructor(message: string, public readonly websiteUrl: string, details?: unknown) {
    super(message, "WEBSITE_ENRICHMENT_FAILED", { websiteUrl, details });
    this.name = "WebsiteEnrichmentError";
  }
}
