const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  envText.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "KSN_SECURE_IMPERSONATION_SECRET_2026";

function createHandoffToken(sessionData) {
  const payload = {
    sessionData,
    createdAt: Date.now(),
  };
  const base64Str = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET_KEY);
  hmac.update(base64Str);
  const sig = hmac.digest("base64url");
  return `${base64Str}.${sig}`;
}

function verifyHandoffToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [base64Str, sig] = parts;
    const hmac = crypto.createHmac("sha256", SECRET_KEY);
    hmac.update(base64Str);
    if (sig !== hmac.digest("base64url")) {
      console.warn("Invalid signature");
      return null;
    }

    const payload = JSON.parse(Buffer.from(base64Str, "base64url").toString("utf-8"));
    const age = Date.now() - payload.createdAt;
    if (age > 60000) {
      console.warn("Token expired");
      return null;
    }

    return payload.sessionData;
  } catch (err) {
    return null;
  }
}

function runTest() {
  console.log("=== Testing Impersonation Cross-Domain Handoff Token ===");

  const sampleSession = {
    sessionId: "imp_test_12345",
    adminUserId: "admin-uuid-111",
    adminEmail: "admin@letusto.com",
    targetUserId: "7c3c4899-fa85-4cf0-94c8-6d497b36f82f",
    targetUserEmail: "tammyhahm@gmail.com",
    targetUserName: "Tammy Chun",
    targetCompanyId: "dc9249be-a9e0-4975-a4c9-b602bb2baa47",
    targetCompanyName: "K SELECT Test Retailer",
    portalType: "RETAILER",
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    reason: "Customer Support",
  };

  const handoffToken = createHandoffToken(sampleSession);
  console.log("Generated Handoff Token:", handoffToken);

  const verified = verifyHandoffToken(handoffToken);
  console.log("Verified Session Data:", verified);

  if (verified && verified.targetUserName === "Tammy Chun" && verified.portalType === "RETAILER") {
    console.log("SUCCESS: Handoff token generation and verification passed!");
  } else {
    console.error("FAIL: Handoff token verification failed.");
  }
}

runTest();
