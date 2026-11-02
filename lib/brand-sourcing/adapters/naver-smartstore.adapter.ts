/**
 * Brand Sourcing — Naver Smart Store Source Adapter
 * Task ID: ADM-BSRC-NAVER-001
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 *
 * Implements SourceAdapter contract for Naver Smart Store.
 * Automated crawling is prohibited; seller info is parsed from pasted text via parseNaverSellerInfo.
 */

import { SourceAdapter } from "./base.adapter";
import { NormalizedCompanyDraft, ExtractionOptions, SourcingProvider } from "../types";
import { validateNaverStoreUrl } from "../naver-seller-parser";

export class NaverSmartstoreAdapter implements SourceAdapter {
  public readonly provider: SourcingProvider = "NAVER_SMARTSTORE";

  public canHandle(url: string): boolean {
    const res = validateNaverStoreUrl(url);
    return res.isValid;
  }

  public async extract(url: string, _options?: ExtractionOptions): Promise<NormalizedCompanyDraft> {
    throw new Error(
      "네이버 스마트스토어는 자동 웹 크롤링이 허용되지 않습니다. 네이버 판매자 정보 팝업에서 복사한 텍스트를 붙여넣어 파싱을 진행해 주세요."
    );
  }
}
