import { describe, expect, it } from "vitest";
import { companyMetaFromRow, parseCompanyIntroJson } from "@/lib/company/profile-columns";

const intro = (obj: Record<string, unknown>) => `__COMPANY_METADATA__:${JSON.stringify(obj)}`;

describe("parseCompanyIntroJson", () => {
  it("returns {} for plain text or broken JSON", () => {
    expect(parseCompanyIntroJson("hello")).toEqual({});
    expect(parseCompanyIntroJson("__COMPANY_METADATA__:{bad")).toEqual({});
    expect(parseCompanyIntroJson(null)).toEqual({});
  });
});

describe("companyMetaFromRow", () => {
  it("uses intro JSON when the row is not migrated", () => {
    const meta = companyMetaFromRow({ intro: intro({ website: "a.com", type: "Brand Owner" }) });
    expect(meta).toEqual({ website: "a.com", type: "Brand Owner" });
  });

  it("prefers profile columns and keeps non-profile JSON keys (type/status/notifications)", () => {
    const meta = companyMetaFromRow({
      intro: intro({ type: "Manufacturer", status: "Active", notifications: [1], website: "stale.com" }),
      profile_migrated_at: "2026-10-07T00:00:00Z",
      website: "new.com",
      description: "desc",
      address_1: "225 Road",
      address_2: "2F",
      city: "Seoul",
      state: "",
      zip_code: "06000",
      logo_path: null,
      team_onboarding_skipped: true,
      company_onboarding_confirmed_at: "2026-09-29T04:07:08Z",
    });
    expect(meta.website).toBe("new.com");
    expect(meta.type).toBe("Manufacturer");
    expect(meta.status).toBe("Active");
    expect(meta.notifications).toEqual([1]);
    expect(meta.address).toBe("225 Road 2F, Seoul (06000)");
    expect(meta.team_onboarding_skipped).toBe(true);
    expect(meta.company_onboarding_confirmed_at).toBe("2026-09-29T04:07:08Z");
  });

  it("maps company_contacts rows to the legacy contact shape in sort order", () => {
    const meta = companyMetaFromRow({
      intro: intro({}),
      profile_migrated_at: "2026-10-07T00:00:00Z",
      company_contacts: [
        { id: "b", name: "Second", is_primary: false, sort_order: 1 },
        { id: "a", name: "First", english_name: "First EN", is_primary: true, sort_order: 0 },
      ],
    });
    expect(meta.contacts.map((c: any) => c.id)).toEqual(["a", "b"]);
    expect(meta.contacts[0]).toMatchObject({ name: "First", englishName: "First EN", isPrimary: true });
  });

  it("falls back to JSON contacts when company_contacts was not selected", () => {
    const meta = companyMetaFromRow({
      intro: intro({ contacts: [{ id: "x", name: "From JSON" }] }),
      profile_migrated_at: "2026-10-07T00:00:00Z",
    });
    expect(meta.contacts).toEqual([{ id: "x", name: "From JSON" }]);
  });
});
