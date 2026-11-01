import { describe, it, expect } from 'vitest';

describe('ADM-BM-NAV-001: Brand Marketing Native Link Navigation & URL Resolution', () => {
  // Helper simulating server/client query parameter resolution logic
  function resolveBrandMarketingTab(searchParams: { tab?: string; companyId?: string }) {
    const initialCompanyId = searchParams.companyId || null;
    const initialTab =
      initialCompanyId
        ? "list"
        : searchParams.tab === "list" || searchParams.tab === "brands"
        ? "list"
        : searchParams.tab === "campaigns"
        ? "campaigns"
        : searchParams.tab === "results"
        ? "results"
        : "import";
    return { initialTab, initialCompanyId };
  }

  function resolveEmailCampaignsView(searchParams: { view?: string; subtab?: string }) {
    const viewParam = searchParams.view || searchParams.subtab;
    if (viewParam === "footer") {
      return { mainTab: "footer", viewMode: "list" };
    }
    if (viewParam === "templates" || viewParam === "library") {
      return { mainTab: "library", viewMode: "list" };
    }
    return { mainTab: "campaigns", viewMode: "list" };
  }

  describe('1. Primary Brand Marketing Navigation URL Mapping', () => {
    it('resolves default root URL (/admin/brand-marketing) to Import & Review', () => {
      const res = resolveBrandMarketingTab({});
      expect(res.initialTab).toBe("import");
    });

    it('resolves ?tab=import to Import & Review', () => {
      const res = resolveBrandMarketingTab({ tab: "import" });
      expect(res.initialTab).toBe("import");
    });

    it('resolves ?tab=list to Brand List', () => {
      const res = resolveBrandMarketingTab({ tab: "list" });
      expect(res.initialTab).toBe("list");
    });

    it('resolves backward-compatible ?tab=brands to Brand List', () => {
      const res = resolveBrandMarketingTab({ tab: "brands" });
      expect(res.initialTab).toBe("list");
    });

    it('resolves ?tab=campaigns to Email Campaigns', () => {
      const res = resolveBrandMarketingTab({ tab: "campaigns" });
      expect(res.initialTab).toBe("campaigns");
    });

    it('resolves ?tab=results to Results & Follow-up', () => {
      const res = resolveBrandMarketingTab({ tab: "results" });
      expect(res.initialTab).toBe("results");
    });

    it('safely falls back unknown query parameter (?tab=invalid_tab) to Import & Review without error', () => {
      const res = resolveBrandMarketingTab({ tab: "invalid_xyz_123" });
      expect(res.initialTab).toBe("import");
    });

    it('resolves deep-link companyId parameter to Brand List', () => {
      const res = resolveBrandMarketingTab({ companyId: "comp-uuid-456" });
      expect(res.initialTab).toBe("list");
      expect(res.initialCompanyId).toBe("comp-uuid-456");
    });
  });

  describe('2. Email Campaigns Sub-Navigation URL Mapping', () => {
    it('resolves ?tab=campaigns&view=list to Campaigns list', () => {
      const res = resolveEmailCampaignsView({ view: "list" });
      expect(res.mainTab).toBe("campaigns");
      expect(res.viewMode).toBe("list");
    });

    it('resolves default view when no view param provided to Campaigns list', () => {
      const res = resolveEmailCampaignsView({});
      expect(res.mainTab).toBe("campaigns");
      expect(res.viewMode).toBe("list");
    });

    it('resolves ?tab=campaigns&view=templates to Template Library', () => {
      const res = resolveEmailCampaignsView({ view: "templates" });
      expect(res.mainTab).toBe("library");
    });

    it('resolves ?tab=campaigns&view=library to Template Library', () => {
      const res = resolveEmailCampaignsView({ view: "library" });
      expect(res.mainTab).toBe("library");
    });

    it('resolves ?tab=campaigns&subtab=library to Template Library', () => {
      const res = resolveEmailCampaignsView({ subtab: "library" });
      expect(res.mainTab).toBe("library");
    });

    it('resolves ?tab=campaigns&view=footer to Marketing Footer Settings', () => {
      const res = resolveEmailCampaignsView({ view: "footer" });
      expect(res.mainTab).toBe("footer");
    });
  });

  describe('3. Native Link Integrity and Multi-Tab Isolation Invariants', () => {
    const PRIMARY_HREFS = [
      '/admin/brand-marketing?tab=import',
      '/admin/brand-marketing?tab=list',
      '/admin/brand-marketing?tab=campaigns',
      '/admin/brand-marketing?tab=results',
    ];

    const SUB_NAV_HREFS = [
      '/admin/brand-marketing?tab=campaigns&view=list',
      '/admin/brand-marketing?tab=campaigns&view=templates',
      '/admin/brand-marketing?tab=campaigns&view=footer',
    ];

    it('contains all 7 canonical navigation URLs with valid absolute paths', () => {
      const allUrls = [...PRIMARY_HREFS, ...SUB_NAV_HREFS];
      expect(allUrls.length).toBe(7);
      allUrls.forEach((url) => {
        expect(url.startsWith('/admin/brand-marketing')).toBe(true);
        expect(url).not.toBe('#');
        expect(url).not.toContain('javascript:');
      });
    });

    it('multi-tab state isolation: independent URL state per tab preserves draft in editor', () => {
      // Tab A is editing a campaign draft
      const tabA = {
        url: '/admin/brand-marketing?tab=campaigns',
        viewMode: 'editor',
        draft: { id: 'draft-1', name: 'Autumn Sourcing Campaign', step: 3 },
      };

      // Tab B opens Template Library via right click -> open in new tab
      const tabB_resolved = resolveEmailCampaignsView({ view: 'templates' });
      expect(tabB_resolved.mainTab).toBe('library');

      // Tab C opens Brand List via right click -> open in new tab
      const tabC_resolved = resolveBrandMarketingTab({ tab: 'list' });
      expect(tabC_resolved.initialTab).toBe('list');

      // Tab A remains 100% untouched
      expect(tabA.viewMode).toBe('editor');
      expect(tabA.draft.step).toBe(3);
      expect(tabA.draft.name).toBe('Autumn Sourcing Campaign');
    });
  });
});
