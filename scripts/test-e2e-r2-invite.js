const { renderEmailHtml } = require('../lib/notifications/templates');

function testEmailTemplate() {
  const companyDisplayName = "Beauty Maker 33";
  const inviterName = "함사세요";
  const inviterEmail = "legal@letusto.com";
  const inviteeEmail = "support2@letusto.com";
  const canonicalName = "홍길동2";
  const roleLabel = "Staff (담당자)";
  const roleKoreanTitle = "담당자";
  const actionLink = "https://shzfrppdobpmrstcjfqu.supabase.co/auth/v1/verify?token=sample123&type=invite&redirect_to=https%3A%2F%2Fportal.kselectnetwork.com%2Fportal%2Finvite%2Faccept";

  const subjectTemplate = `[K SELECT NETWORK] ${companyDisplayName} 브랜드 포털 초대 안내`;
  const bodyTemplate = `안녕하세요, ${canonicalName}님.

K SELECT NETWORK 파트너사인 "${companyDisplayName}"의 ${roleKoreanTitle}로 초청되었습니다.

아래 버튼을 클릭하여 초대 수락 및 비밀번호 설정을 진행해 주시기 바랍니다.

* 본 초대 링크는 보안을 위해 기한 내 1회만 사용 가능합니다.

{{ctaButton}}`;

  const { subject, html, text } = renderEmailHtml(subjectTemplate, bodyTemplate, {
    link: actionLink,
    key: "portal_signup_request",
    contact_name: canonicalName,
    company_name: companyDisplayName,
    inviter_name: inviterName,
    inviter_email: inviterEmail,
    invitee_email: inviteeEmail,
    role_label: roleLabel,
    role_korean_title: roleKoreanTitle,
    isDirectInvite: "true",
    button_label: "초대 수락 및 비밀번호 설정",
  });

  console.log("=== SUBJECT ===");
  console.log(subject);
  console.log("\n=== TEXT CONTENT ===");
  console.log(text);
  console.log("\n=== CTA BUTTON URL IN HTML ===");
  const hrefMatch = html.match(/href="([^"]+)"/);
  console.log("CTA href:", hrefMatch ? hrefMatch[1] : "NOT FOUND");

  console.log("\n=== INFO BOX LABELS AND VALUES ===");
  const rows = [...html.matchAll(/<td[^>]*>(.*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  console.log(rows.filter(r => r.length > 0 && !r.includes("&nbsp;")));
}

testEmailTemplate();
