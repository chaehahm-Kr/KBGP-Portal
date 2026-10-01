const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

const supabaseUrl = "https://shzfrppdobpmrstcjfqu.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function applyMigration() {
  console.log("Upserting email templates into email_templates table on Supabase...");

  const templates = [
    {
      key: "brand_agreement_completed",
      description: "브랜드사 담당자 — 계약 체결 완료 (Brand Agreement Completed)",
      subject_template: "[K SELECT NETWORK] {{company_name}} 계약 체결이 완료되었습니다",
      body_template: `전자 기본계약 체결이 완료되었습니다.

안녕하세요, {{signer_name}}님.

{{company_name}}의 K SELECT NETWORK 브랜드 공급 및 유통 기본계약(Version {{agreement_version}}) 체결이 완료되었습니다.

체결된 최종 계약서 사본이 본 메일에 첨부되어 있으며, 브랜드사 포털에서도 언제든지 확인 및 다운로드하실 수 있습니다.

{{infoBox}}

{{ctaButton}}

본 계약서는 양사의 전자서명 및 타임스탬프를 통해 법적 효력을 갖는 공식 문서로 안전하게 보관됩니다.`,
      updated_at: new Date().toISOString(),
    },
    {
      key: "hub_retailer_agreement_completed",
      description: "Retailer Partner — Retailer Agreement Completed",
      subject_template: "[K SELECT HUB] Your Retailer Agreement Has Been Completed",
      body_template: `Your Retailer Agreement has been successfully executed.

Hello {{signer_name}},

The K SELECT Retailer Operating Agreement (Version {{agreement_version}}) for {{company_name}} has been successfully executed.

Your official executed agreement is attached to this email and is also permanently preserved in your Retailer Portal for secure access.

{{infoBox}}

{{ctaButton}}

If you have any questions regarding your agreement or next onboarding steps, our team is here to assist you at {{supportEmail}}.`,
      updated_at: new Date().toISOString(),
    }
  ];

  for (const t of templates) {
    const { data, error } = await admin
      .from("email_templates")
      .upsert(t, { onConflict: "key" })
      .select();

    if (error) {
      console.error(`Error upserting ${t.key}:`, error);
    } else {
      console.log(`Successfully upserted template ${t.key}:`, data);
    }
  }

  // Verification Query
  const { data: rows, error: selectErr } = await admin
    .from("email_templates")
    .select("key, description, subject_template, updated_at")
    .in("key", ["brand_agreement_completed", "hub_retailer_agreement_completed"]);

  console.log("Verification from Production DB:", rows, selectErr);
}

applyMigration();
