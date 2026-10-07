import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({ serverEnv: { SUPABASE_SECRET_KEY: "test-secret" } }));

const { issueEmailVerificationProof, verifyEmailVerificationProof } = await import(
  "@/lib/auth/email-verification-proof"
);

afterEach(() => {
  vi.useRealTimers();
});

describe("email verification proof", () => {
  it("accepts a fresh proof for the same user", () => {
    const proof = issueEmailVerificationProof("user-1");
    expect(verifyEmailVerificationProof(proof, "user-1")).toBe(true);
  });

  it("rejects a proof issued for another user", () => {
    const proof = issueEmailVerificationProof("user-1");
    expect(verifyEmailVerificationProof(proof, "user-2")).toBe(false);
  });

  it("rejects missing, malformed, or tampered proofs", () => {
    const proof = issueEmailVerificationProof("user-1");
    const [body, signature] = proof.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ purpose: "partner-email-verified", userId: "user-2", exp: Date.now() + 60_000 })
    ).toString("base64url");

    expect(verifyEmailVerificationProof("", "user-1")).toBe(false);
    expect(verifyEmailVerificationProof(undefined, "user-1")).toBe(false);
    expect(verifyEmailVerificationProof("not-a-proof", "user-1")).toBe(false);
    expect(verifyEmailVerificationProof(`${forgedBody}.${signature}`, "user-2")).toBe(false);
    expect(verifyEmailVerificationProof(`${body}.${signature.slice(0, -2)}xx`, "user-1")).toBe(false);
  });

  it("rejects an expired proof", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    const proof = issueEmailVerificationProof("user-1");
    vi.setSystemTime(new Date("2026-10-07T00:11:00Z"));
    expect(verifyEmailVerificationProof(proof, "user-1")).toBe(false);
  });
});
