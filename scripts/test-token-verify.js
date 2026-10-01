const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
const crypto = require('crypto');

async function verifyBrandInvitationTokenAction(rawToken) {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
    return {
      success: false,
      case: "INVALID",
      message: "유효하지 않은 초청 토큰입니다. 이메일 내 초청 버튼을 통해 접속해 주세요.",
    };
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

  let user = null;

  const { data: matchedByHash, error: hashErr } = await admin
    .from("company_users")
    .select("id, company_id, name, email, status, invited_at, invitation_token_hash, invitation_expires_at, companies!company_users_company_id_fkey(name)")
    .eq("invitation_token_hash", tokenHash)
    .maybeSingle();

  if (matchedByHash) {
    user = matchedByHash;
  } else if (hashErr) {
    console.warn("[verifyBrandInvitationTokenAction] Error querying by invitation_token_hash:", hashErr);
  }

  if (!user && rawToken.trim().length >= 32) {
    const { data: matchedById } = await admin
      .from("company_users")
      .select("id, company_id, name, email, status, invited_at, invitation_token_hash, invitation_expires_at, companies!company_users_company_id_fkey(name)")
      .eq("id", rawToken.trim())
      .maybeSingle();

    if (matchedById) {
      user = matchedById;
    }
  }

  if (!user) {
    return {
      success: false,
      case: "INVALID",
      message: "유효하지 않거나 취소된 초청 링크입니다. 어드민 관리자에게 문의해 주세요.",
    };
  }

  const compName = user?.companies?.name || "파트너사";

  if (user.status === "active") {
    return {
      success: false,
      case: "USED",
      message: "이미 사용된 초청 링크입니다. 파트너 포털에 로그인하여 온보딩을 진행해 주세요.",
      email: user.email,
    };
  }

  if (user.status !== "invited") {
    return {
      success: false,
      case: "INVALID",
      message: "취소된 초청입니다. 어드민 관리자에게 문의해 주세요.",
    };
  }

  if (user.invitation_expires_at) {
    const exp = new Date(user.invitation_expires_at);
    if (!isNaN(exp.getTime()) && exp < new Date()) {
      return {
        success: false,
        case: "EXPIRED",
        message: "초청 링크 유효 기간(7일)이 만료되었습니다. 관리자에게 재초대를 요청해 주세요.",
      };
    }
  }

  return {
    success: true,
    case: "D",
    userId: user.id,
    companyName: compName,
    contactName: user.name || "담당자",
    email: user.email,
  };
}

async function main() {
  const result = await verifyBrandInvitationTokenAction('81c9d88ffeba908771ff210bf1974d34a99afdbf0431003405217e530296743c');
  console.log("Verification Action Test Result:", result);
}

main().catch(console.error);
