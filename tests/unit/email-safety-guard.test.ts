import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock server-only before importing email module
vi.mock("server-only", () => ({}));

// Mock serverEnv
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    RESEND_API_KEY: "re_mock_test_key_12345",
    EMAIL_FROM_ADDRESS: "K SELECT NETWORK <support@kselectnetwork.com>",
    SUPABASE_SECRET_KEY: "mock_secret",
  },
}));

import {
  isProductionEnvironment,
  maskEmailAddress,
  isRecipientAllowlisted,
  sendEmail,
} from "@/lib/notifications/email";

describe("Email Safety Guard (DEV-ENV-GUARD-001)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    // Default to mock non-production local setup
    delete process.env.VERCEL_ENV;
    delete process.env.ENABLE_QA_ENVIRONMENT;
    delete process.env.ENABLE_TEST_EMAIL_DISPATCH;
    delete process.env.EMAIL_TEST_ALLOWLIST;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://elkgizqgksshukxgcndy.supabase.co";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. isProductionEnvironment", () => {
    it("should return false for local development", () => {
      expect(isProductionEnvironment()).toBe(false);
    });

    it("should return false when ENABLE_QA_ENVIRONMENT is true (fail closed)", () => {
      process.env.ENABLE_QA_ENVIRONMENT = "true";
      process.env.VERCEL_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shzfrppdobpmrstcjfqu.supabase.co";
      expect(isProductionEnvironment()).toBe(false);
    });

    it("should return false for Vercel Preview environment", () => {
      process.env.VERCEL_ENV = "preview";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shzfrppdobpmrstcjfqu.supabase.co";
      expect(isProductionEnvironment()).toBe(false);
    });

    it("should return false if Supabase URL points to QA project ref", () => {
      process.env.VERCEL_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://elkgizqgksshukxgcndy.supabase.co";
      expect(isProductionEnvironment()).toBe(false);
    });

    it("should return true only when VERCEL_ENV is production and Supabase ref matches shzfrppdobpmrstcjfqu", () => {
      process.env.VERCEL_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shzfrppdobpmrstcjfqu.supabase.co";
      process.env.NEXT_PUBLIC_SITE_URL = "https://portal.kselectnetwork.com";
      expect(isProductionEnvironment()).toBe(true);
    });

    it("should return true in production Node environment with verified custom domain and prod Supabase", () => {
      delete process.env.VERCEL_ENV;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shzfrppdobpmrstcjfqu.supabase.co";
      process.env.NEXT_PUBLIC_SITE_URL = "https://admin.kselectnetwork.com";
      expect(isProductionEnvironment()).toBe(true);
    });
  });

  describe("2. maskEmailAddress", () => {
    it("should safely mask standard email addresses without leaking full local-part", () => {
      expect(maskEmailAddress("admin@letusto.com")).toBe("ad***@letusto.com");
      expect(maskEmailAddress("customer.service@kselectnetwork.com")).toBe("cu***@kselectnetwork.com");
    });

    it("should handle short local parts safely", () => {
      expect(maskEmailAddress("ab@letusto.com")).toBe("a***@letusto.com");
    });

    it("should return fallback for invalid inputs", () => {
      expect(maskEmailAddress("")).toBe("***@***.***");
      expect(maskEmailAddress("invalid-no-at")).toBe("***@***.***");
    });
  });

  describe("3. isRecipientAllowlisted", () => {
    it("should allow internal default test domains letusto.com and kselectnetwork.com", () => {
      expect(isRecipientAllowlisted("engineer@letusto.com")).toBe(true);
      expect(isRecipientAllowlisted("support@kselectnetwork.com")).toBe(true);
    });

    it("should reject external domains by default", () => {
      expect(isRecipientAllowlisted("buyer@retailer-partner.com")).toBe(false);
      expect(isRecipientAllowlisted("test@gmail.com")).toBe(false);
    });

    it("should honor custom EMAIL_TEST_ALLOWLIST environment configuration", () => {
      process.env.EMAIL_TEST_ALLOWLIST = "trusted-vendor.com, special-tester@partner.org";
      expect(isRecipientAllowlisted("anyone@trusted-vendor.com")).toBe(true);
      expect(isRecipientAllowlisted("special-tester@partner.org")).toBe(true);
      expect(isRecipientAllowlisted("other@partner.org")).toBe(false);
    });
  });

  describe("4. sendEmail Protection in Non-Production", () => {
    it("should intercept and simulate external email delivery in non-production", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");

      const result = await sendEmail({
        to: "external-customer@gmail.com",
        subject: "Welcome to K SELECT",
        text: "Sensitive onboarding instructions",
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.messageId).toContain("sandbox-simulated-");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should intercept internal allowlisted email if ENABLE_TEST_EMAIL_DISPATCH is not explicitly true", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");

      const result = await sendEmail({
        to: "qa-lead@letusto.com",
        subject: "Internal QA Alert",
        text: "Test email payload",
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("should dispatch real email in non-production only when allowlisted AND ENABLE_TEST_EMAIL_DISPATCH is true", async () => {
      process.env.ENABLE_TEST_EMAIL_DISPATCH = "true";

      const mockResponse = {
        ok: true,
        json: async () => ({ id: "msg_real_resend_123" }),
      };
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse as any);

      const result = await sendEmail({
        to: "qa-lead@letusto.com",
        subject: "Approved Test Email",
        text: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg_real_resend_123");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should dispatch real email in authentic Production environment", async () => {
      process.env.VERCEL_ENV = "production";
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://shzfrppdobpmrstcjfqu.supabase.co";
      process.env.NEXT_PUBLIC_SITE_URL = "https://portal.kselectnetwork.com";

      const mockResponse = {
        ok: true,
        json: async () => ({ id: "msg_prod_resend_999" }),
      };
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse as any);

      const result = await sendEmail({
        to: "real-retailer@company.com",
        subject: "Order Confirmation #1001",
        text: "Your order has been confirmed.",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg_prod_resend_999");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
