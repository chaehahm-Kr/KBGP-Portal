import { describe, expect, it } from "vitest";
import { normalizePermissions, parseAclLevel, ROLE_PRESETS } from "@/lib/permissions/brand-portal-acl";

describe("parseAclLevel", () => {
  it("maps legacy aliases to canonical levels", () => {
    expect(parseAclLevel("edit")).toBe("write");
    expect(parseAclLevel("full")).toBe("manage");
    expect(parseAclLevel("admin")).toBe("manage");
  });

  it("falls back to none for unknown or empty values", () => {
    expect(parseAclLevel(undefined)).toBe("none");
    expect(parseAclLevel("superuser")).toBe("none");
  });
});

describe("normalizePermissions", () => {
  it("defaults to the viewer preset, which cannot see bank info", () => {
    const perms = normalizePermissions({});
    expect(perms).toEqual(ROLE_PRESETS.viewer);
    expect(perms.bank_info).toBe("none");
  });

  it("uses the membership role when no preset is stored", () => {
    expect(normalizePermissions({}, "company_admin")).toEqual(ROLE_PRESETS.admin);
  });

  it("applies per-category overrides on top of the preset", () => {
    const perms = normalizePermissions({ preset: "staff", finance: "edit", bank_info: "full" });
    expect(perms.products).toBe("write");
    expect(perms.finance).toBe("write");
    expect(perms.bank_info).toBe("manage");
  });
});
