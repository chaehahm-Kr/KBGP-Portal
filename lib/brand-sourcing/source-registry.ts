import { SourcingProvider } from "./types";
import { SourceAdapter } from "./adapters/base.adapter";
import { IntercharmAdapter } from "./adapters/intercharm.adapter";
import { IndieBeautyShowAdapter } from "./adapters/indie-beauty-show.adapter";
import { AdapterNotFoundError } from "./errors";

export interface SourcingSourceSampleUrl {
  name: string;
  url: string;
}

export interface SourcingSourceDefinition {
  id: SourcingProvider;
  displayName: string;
  shortName: string;
  exhibitionYear?: string;
  baseWebsiteUrl?: string;
  exhibitorListUrl?: string;
  urlPlaceholder: string;
  supportedUrlPatterns: RegExp[];
  sampleUrls: SourcingSourceSampleUrl[];
  canHandle: (url: string) => boolean;
  getAdapter: () => SourceAdapter;
}

/**
 * Centralized registry of all supported Brand Sourcing exhibition adapters.
 * Designed for dynamic multi-source expansion without UI redesign.
 */
class SourcingRegistry {
  private sources: Map<SourcingProvider, SourcingSourceDefinition> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // 1. InterCHARM Korea
    this.register({
      id: "INTERCHARM",
      displayName: "InterCHARM Korea (인터참 코리아)",
      shortName: "InterCHARM",
      exhibitionYear: "2024",
      baseWebsiteUrl: "https://www.intercharmkorea.com",
      exhibitorListUrl: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory.html",
      urlPlaceholder: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.3일애.org-b4fa5886-....html",
      supportedUrlPatterns: [
        /intercharmkorea\.com/i,
        /org-[0-9a-f-]{36}/i,
      ],
      sampleUrls: [
        {
          name: "3일애 (Three Days Love)",
          url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.3%EC%9D%BC%EC%95%A0.org-b4fa5886-d5fd-490e-92bf-0c0b65d0a79e.html",
        },
        {
          name: "MIJIN COSMETICS (미진화장품)",
          url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.%EC%A3%BC%EB%AF%B8%EC%A7%84%ED%99%94%EC%9E%A5%ED%92%88.org-1121b56a-b02c-4552-bbee-db642b958546.html#/",
        },
        {
          name: "JCOMO (제이코모)",
          url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/",
        },
        {
          name: "JD BIO (제이디바이오)",
          url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.제이디바이오.org-a2d35424-a9e1-41c1-b77a-88e839ae0b0f.html#/",
        },
        {
          name: "LEBELAGE (르베라쥬)",
          url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.르베라쥬.org-18c803be-34f2-4461-bc72-fa5ec798209b.html#/",
        },
        {
          name: "BEAUGANIC (보가닉)",
          url: "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.뷰가닉.org-d14d1a34-e041-400d-9488-88121361b460.html#/",
        },
      ],
      canHandle: (url: string) => {
        try {
          const parsed = new URL(url);
          return (
            parsed.hostname.includes("intercharmkorea.com") &&
            /org-[0-9a-f-]{36}/i.test(parsed.pathname)
          );
        } catch {
          return false;
        }
      },
      getAdapter: () => new IntercharmAdapter(),
    });

    // 2. Indie Beauty Show 2026
    this.register({
      id: "INDIE_BEAUTY_SHOW",
      displayName: "Indie Beauty Show 2026 (인디뷰티쇼)",
      shortName: "Indie Beauty Show",
      exhibitionYear: "2026",
      baseWebsiteUrl: "https://indiebeautyshow.com/",
      exhibitorListUrl: "https://indiebeautyshow.com/exhibitor-list2026/",
      urlPlaceholder: "https://indiebeautyshow.com/exhibitor-list2026/?...idx=170410507&t=board",
      supportedUrlPatterns: [
        /indiebeautyshow\.com/i,
        /idx=\d+/i,
      ],
      sampleUrls: [
        {
          name: "SAMPLE 1: 언리시아 (Unleashia)",
          url: "https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410507&t=board",
        },
        {
          name: "SAMPLE 2: 에필로우 (Efilow)",
          url: "https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410597&t=board",
        },
        {
          name: "SAMPLE 3: 허스텔러 (Hersteller)",
          url: "https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410669&t=board",
        },
      ],
      canHandle: (url: string) => {
        try {
          const parsed = new URL(url);
          return (
            (parsed.hostname.includes("indiebeautyshow.com") || parsed.hostname.includes("www.indiebeautyshow.com")) &&
            parsed.searchParams.has("idx") &&
            /^\d+$/.test(parsed.searchParams.get("idx") || "")
          );
        } catch {
          return false;
        }
      },
      getAdapter: () => new IndieBeautyShowAdapter(),
    });
  }

  /**
   * Registers a new or custom sourcing provider.
   */
  public register(source: SourcingSourceDefinition): void {
    this.sources.set(source.id, source);
  }

  /**
   * Returns all registered sourcing sources.
   */
  public getAllSources(): SourcingSourceDefinition[] {
    return Array.from(this.sources.values());
  }

  /**
   * Retrieves a specific source definition by ID.
   */
  public getSourceById(id: SourcingProvider): SourcingSourceDefinition | undefined {
    return this.sources.get(id);
  }

  /**
   * Automatically detects which registered source matches the provided URL.
   */
  public detectSourceByUrl(url: string): SourcingSourceDefinition | undefined {
    if (!url || typeof url !== "string") return undefined;
    for (const source of this.sources.values()) {
      if (source.canHandle(url)) {
        return source;
      }
    }
    return undefined;
  }

  /**
   * Resolves the proper SourceAdapter instance for a given URL.
   */
  public resolveAdapter(url: string): SourceAdapter {
    const detected = this.detectSourceByUrl(url);
    if (!detected) {
      throw new AdapterNotFoundError(url);
    }
    return detected.getAdapter();
  }
}

export const sourceRegistry = new SourcingRegistry();
