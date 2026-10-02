const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function publishPermFaqs() {
  console.log('====================================================');
  console.log('MAN-B-PERM-001 KNOWLEDGE CENTER FAQS PUBLISH');
  console.log('====================================================');

  const permFaqs = [
    {
      id: "faq-perm-01",
      kind: "FAQ",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 1,
      generated_by: "MANUAL",
      question_ko: "한 명의 직원이 여러 회사의 포털 계정에 동시에 소속될 수 있나요?",
      question_en: "Can a single user belong to multiple company portal accounts simultaneously?",
      answer_ko: "아니오. 1 사용자 이메일 = 1 회사 계정의 1:1 바인딩 원칙을 적용합니다. 다른 회사에 참여하려면 별도의 비즈니스 이메일로 초대받아야 합니다.",
      answer_en: "No, a strict 1 user email = 1 company binding rule applies. To join a different company, invitation to a separate business email address is required."
    },
    {
      id: "faq-perm-02",
      kind: "FAQ",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 2,
      generated_by: "MANUAL",
      question_ko: "역할 템플릿(Preset)을 선택한 뒤 특정 메뉴의 권한만 따로 바꿀 수 있나요?",
      question_en: "Can I customize individual menu permissions after selecting a Role Preset?",
      answer_ko: "네, 가능합니다. 역할 프리셋(restricted / viewer / staff / manager / admin)으로 기본 권한을 불러온 후, 매트릭스에서 원하는 9대 카테고리의 접근 레벨(none / read / write / manage) 라디오 버튼을 개별 클릭하여 커스텀 권한으로 지정할 수 있습니다.",
      answer_en: "Yes. After loading default permissions with a Role Preset, individual category levels (none / read / write / manage) can be customized via the ACL matrix."
    },
    {
      id: "faq-perm-03",
      kind: "FAQ",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 3,
      generated_by: "MANUAL",
      question_ko: "발송된 초대 링크가 만료되었다고 표시됩니다.",
      question_en: "Why does the invitation link show as expired?",
      answer_ko: "초대 링크는 보안을 위해 발송 후 7일간 1회만 유효합니다. 만료된 경우 회사 관리자에게 소속 멤버 목록에서 [재초대]를 실행해 새 초대장을 발송해 달라고 요청하세요.",
      answer_en: "Invitation links expire after 7 days for security. If expired, request a company admin to click [Re-invite] from the member list to issue a new link."
    },
    {
      id: "faq-perm-04",
      kind: "FAQ",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 4,
      generated_by: "MANUAL",
      question_ko: "주 담당자로 지정되면 포털 권한도 자동으로 부여되나요?",
      question_en: "Does being assigned as a Primary Task Owner automatically grant portal ACL permissions?",
      answer_ko: "아닙니다. 6대 담당 업무 배정(company_apply, contract, product_cert, pricing_quote, logistics_inventory, settlement_inquiry)은 K SELECT 운영팀 소통 책임자 지정 및 이메일 알림 수신 라우팅 용도입니다. 실제 포털 메뉴 접근 및 수정 권한은 오직 ACL 매트릭스에 의해서만 결정됩니다.",
      answer_en: "No. Primary task assignments serve communication and email notification routing purposes only. Actual menu access and edit rights are governed solely by the ACL matrix."
    },
    {
      id: "faq-perm-05",
      kind: "FAQ",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 5,
      generated_by: "MANUAL",
      question_ko: "최초 관리자 계정을 다른 담당자로 변경하거나 삭제할 수 있나요?",
      question_en: "Can the Initial Owner admin account be deleted or transferred?",
      answer_ko: "회사를 최초 개설한 초기 관리자(Initial Owner) 계정은 시스템 세이프티 차단 규칙에 의해 임의 삭제가 불가능합니다. 권한 이양이나 대표자 변경은 K SELECT 지원팀으로 서면 문의하시기 바랍니다.",
      answer_en: "The Initial Owner account that created the company cannot be deleted due to system safety rules. Contact Support for official ownership transfer."
    },
    {
      id: "faq-perm-06",
      kind: "FAQ",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 6,
      generated_by: "MANUAL",
      question_ko: "퇴사한 팀원의 계정을 삭제하면 등록한 제품이나 발주 내역도 삭제되나요?",
      question_en: "Will products or order records be deleted if a team member account is removed?",
      answer_ko: "아니오. 등록된 브랜드, 제품, 발주서, 인보이스 데이터는 회사(company_id) 자산으로 귀속되어 보존되므로 멤버를 제거해도 회사의 비즈니스 데이터는 유지됩니다.",
      answer_en: "No. All brands, products, purchase orders, and financial data belong to the company asset scope (company_id) and remain preserved when a member is removed."
    },
    {
      id: "faq-perm-07",
      kind: "FAQ",
      topic_id: "topic-company",
      source_knowledge_id: "kno-permissions-user-management-v10",
      source_version: "v1.0",
      source_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 7,
      generated_by: "MANUAL",
      question_ko: "이용 상태를 이용 일시정지(Deactive)로 변경하면 어떻게 되나요?",
      question_en: "What happens when a user status is changed to Suspended (Deactive)?",
      answer_ko: "해당 사용자의 활성 로그인 세션이 즉시 무효화되어 포털 접속이 차단됩니다. 추후 관리자가 Active(정상 이용) 상태로 재활성화하여 접속을 재개할 수 있습니다.",
      answer_en: "Active login sessions are immediately invalidated, blocking portal access. A company admin can reactivate the account status to Active later."
    }
  ];

  // Insert/Upsert FAQs into DB
  for (const faq of permFaqs) {
    const { error: faqErr } = await admin
      .from('knowledge_faqs')
      .upsert(faq, { onConflict: 'id' });

    if (faqErr) {
      console.error(`Error upserting ${faq.id}:`, faqErr);
      process.exit(1);
    } else {
      console.log(`✓ ${faq.id} (${faq.is_featured ? '⭐ Featured' : 'Normal'}) registered in DB`);
    }
  }

  console.log('\n====================================================');
  console.log('MAN-B-PERM-001 FAQS PUBLISH COMPLETE');
  console.log('====================================================');
}

publishPermFaqs().catch(err => {
  console.error('Publish failed:', err);
  process.exit(1);
});
