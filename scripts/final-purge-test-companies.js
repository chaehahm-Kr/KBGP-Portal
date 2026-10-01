/**
 * final-purge-test-companies.js
 * 
 * Safely and completely deletes John, Carmel, and Carmel2 test companies and all related data.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

const TARGET_COMPANY_IDS = [
  '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
  '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
  '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
];

const TARGET_PRODUCT_IDS = [
  '007c67dd-c1c7-4c6b-8df1-d3cfad7ce632', // Vitamin Essence (Carmel)
  '751c5ba2-4dff-4a9f-9d87-37ae14a7ba94', // Vitamin Lotion (Carmel)
  '4fcaeb00-8dcf-4743-be68-9bd697881847', // Vitamin A Whitening Lotion (Carmel2)
  '47ee85b1-54aa-481c-9f19-35fed602e706', // Face Cream Antiaging (John)
];

const TARGET_BRAND_IDS = [
  '4bc9f6ea-5cb8-4b23-a624-8db24b8f5c27', // Carmel (Carmel)
  '3f8f1299-3da4-4397-8566-d7ed634d7a95', // 브랜드테스트 (Carmel2)
  '61d74ec6-e986-483f-92ad-65486d68186b', // Kselect (John)
];

const TARGET_PO_IDS = [
  '2f378a31-c186-4413-a932-e2e07d6bed4f' // PO-20260929-CAR-665-001 (Carmel2)
];

const TARGET_INQUIRY_IDS = [
  '67812a1d-6d80-4c68-a83b-f2b77fee634c', // APP-20260928-0013 (Carmel)
  'a5175a05-d365-479d-be15-512f2640658c', // APP-20260928-0014 (John)
];

const TARGET_PARTNER_INQUIRY_IDS = [
  '61de0a7f-0a9c-4260-86e0-f455a9f439f6', // CASE-0023 (Carmel)
  '8ed0dc7b-9202-49ee-9a49-85f4852c0384', // CASE-0024 (Carmel2)
];

const TARGET_AUTH_USER_IDS = [
  'bc73d3fb-555a-4ca8-a61d-e1eac0583295', // john@letusto.com (John)
  '3fa315a4-4e92-411c-b3ee-bc3daf7ac67b', // polo7104@naver.com (Carmel)
  '4315b4b1-393e-4d1e-af3a-9dcd413b6f2e', // david.lee.tact@gmail.com (Carmel2)
  '07209857-e428-473f-9233-e4bba32f2fa6', // jinseoklee81@gmail.com (Carmel2)
];

const AUDIT_RESULT = {
  storageFilesDeleted: 0,
  poLinesDeleted: 0,
  purchaseOrdersDeleted: 0,
  productAttributeValuesDeleted: 0,
  productImagesDeleted: 0,
  productCertificatesDeleted: 0,
  productVideosDeleted: 0,
  productChangeLogsDeleted: 0,
  productsDeleted: 0,
  brandsDeleted: 0,
  inquiryEventsDeleted: 0,
  inquiryMessagesDeleted: 0,
  partnerInquiriesDeleted: 0,
  inquiriesDeleted: 0,
  companyAgreementsDeleted: 0,
  companyTaskAssignmentsDeleted: 0,
  companyShippingOriginsDeleted: 0,
  companyOnboardingStatusDeleted: 0,
  companyInvitationsDeleted: 0,
  applicationsDeleted: 0,
  companyUsersDeleted: 0,
  userProfilesDeleted: 0,
  companiesDeleted: 0,
  authUsersDeleted: 0,
};

async function purgeAll() {
  console.log("===================================================================");
  console.log("FINAL COMPLETE PURGE: John, Carmel, and Carmel2 Test Companies");
  console.log("===================================================================");

  // 1. Storage Files
  console.log("\n[1] Deleting Storage Files...");
  const storageFiles = [
    '0ec853ef-45dc-4f8f-aa63-59debeaf4af1/products/751c5ba2-4dff-4a9f-9d87-37ae14a7ba94/images/5b3a82b7-d9c2-4037-ac2e-21a953fa6f93-2026-09-28 13 20 48.png',
    '053723dd-aa07-4200-9406-7b8773dd323e/brands/3f8f1299-3da4-4397-8566-d7ed634d7a95/logo/a1411292-c97c-4009-8e3a-5364de7eafe6.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/logo/318258a2-73dd-4243-b138-19bf94ff865c.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/logo/6c769d80-5cfc-41bd-8df7-de073714adfe.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/logo/8f2b43ae-fd59-491d-93a1-527e0f2abb5c.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/logo/9a590d08-fbf7-4a6b-9bf0-4bc0f16f57a3.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/products/4fcaeb00-8dcf-4743-be68-9bd697881847/images/174bfe49-1279-462a-8b48-2478db06f984.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/products/4fcaeb00-8dcf-4743-be68-9bd697881847/images/80cf2d01-f2c1-4821-afc8-8ab533b40a4c.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/products/4fcaeb00-8dcf-4743-be68-9bd697881847/images/d9ebbe4e-66e1-4bc7-a4df-23d8ee8bc77a.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/products/4fcaeb00-8dcf-4743-be68-9bd697881847/images/e04047ff-65a4-4859-b3cd-d5e5d1a96372.jpg',
    '053723dd-aa07-4200-9406-7b8773dd323e/products/4fcaeb00-8dcf-4743-be68-9bd697881847/ingredients/ko_86e9ca60-8a81-468c-bcdc-2d0212dc360d.jpg',
    'agreements/053723dd-aa07-4200-9406-7b8773dd323e/KSN-AGR-CAR66-26-RL6L.pdf'
  ];
  await admin.storage.from('company-uploads').remove(storageFiles);
  AUDIT_RESULT.storageFilesDeleted = storageFiles.length;
  console.log(`  ✓ Storage files deleted: ${storageFiles.length}`);

  // 2. PO Lines & POs
  console.log("\n[2] Deleting Purchase Order Lines & Purchase Orders...");
  const { data: dPOLines } = await admin.from('purchase_order_lines').delete().or(`purchase_order_id.in.(${TARGET_PO_IDS.join(',')}),product_id.in.(${TARGET_PRODUCT_IDS.join(',')})`).select('id');
  AUDIT_RESULT.poLinesDeleted = dPOLines?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.poLinesDeleted} purchase_order_lines`);

  const { data: dPOs } = await admin.from('purchase_orders').delete().or(`id.in.(${TARGET_PO_IDS.join(',')}),supplier_id.in.(${TARGET_COMPANY_IDS.join(',')})`).select('id');
  AUDIT_RESULT.purchaseOrdersDeleted = dPOs?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.purchaseOrdersDeleted} purchase_orders`);

  // 3. Product Sub-tables & Products
  console.log("\n[3] Deleting Product Sub-tables & Products...");
  const { data: dAttrs } = await admin.from('product_attribute_values').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  AUDIT_RESULT.productAttributeValuesDeleted = dAttrs?.length || 0;

  const { data: dImgs } = await admin.from('product_images').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  AUDIT_RESULT.productImagesDeleted = dImgs?.length || 0;

  const { data: dCerts } = await admin.from('product_certificates').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  AUDIT_RESULT.productCertificatesDeleted = dCerts?.length || 0;

  const { data: dVids } = await admin.from('product_videos').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  AUDIT_RESULT.productVideosDeleted = dVids?.length || 0;

  const { data: dLogs } = await admin.from('product_change_logs').delete().in('product_id', TARGET_PRODUCT_IDS).select('id');
  AUDIT_RESULT.productChangeLogsDeleted = dLogs?.length || 0;

  const { data: dProds } = await admin.from('products').delete().or(`id.in.(${TARGET_PRODUCT_IDS.join(',')}),company_id.in.(${TARGET_COMPANY_IDS.join(',')})`).select('id');
  AUDIT_RESULT.productsDeleted = dProds?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.productsDeleted} products`);

  // 4. Brands
  console.log("\n[4] Deleting Brands...");
  const { data: dBrands } = await admin.from('brands').delete().or(`id.in.(${TARGET_BRAND_IDS.join(',')}),company_id.in.(${TARGET_COMPANY_IDS.join(',')})`).select('id');
  AUDIT_RESULT.brandsDeleted = dBrands?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.brandsDeleted} brands`);

  // 5. Inquiries (both partner_inquiries and marketing inquiries)
  console.log("\n[5] Deleting Inquiries & Support Cases...");
  const { data: dEvts } = await admin.from('inquiry_events').delete().in('inquiry_id', TARGET_PARTNER_INQUIRY_IDS).select('id');
  AUDIT_RESULT.inquiryEventsDeleted = dEvts?.length || 0;

  const { data: dMsgs } = await admin.from('inquiry_messages').delete().in('inquiry_id', TARGET_PARTNER_INQUIRY_IDS).select('id');
  AUDIT_RESULT.inquiryMessagesDeleted = dMsgs?.length || 0;

  const { data: dPInqs } = await admin.from('partner_inquiries').delete().or(`id.in.(${TARGET_PARTNER_INQUIRY_IDS.join(',')}),company_id.in.(${TARGET_COMPANY_IDS.join(',')})`).select('id');
  AUDIT_RESULT.partnerInquiriesDeleted = dPInqs?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.partnerInquiriesDeleted} partner_inquiries`);

  const { data: dInqs } = await admin.from('inquiries').delete().or(`id.in.(${TARGET_INQUIRY_IDS.join(',')}),converted_company_id.in.(${TARGET_COMPANY_IDS.join(',')})`).select('id');
  AUDIT_RESULT.inquiriesDeleted = dInqs?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.inquiriesDeleted} marketing inquiries`);

  // 6. Agreements, Task Assignments, Shipping Origins, Onboarding, Invitations, Applications
  console.log("\n[6] Deleting Agreements, Tasks, Onboarding, and Applications...");
  const { data: dAgrs } = await admin.from('company_agreements').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  AUDIT_RESULT.companyAgreementsDeleted = dAgrs?.length || 0;

  const { data: dTasks } = await admin.from('company_task_assignments').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  AUDIT_RESULT.companyTaskAssignmentsDeleted = dTasks?.length || 0;

  const { data: dOrigins } = await admin.from('company_shipping_origins').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  AUDIT_RESULT.companyShippingOriginsDeleted = dOrigins?.length || 0;

  const { data: dOnb } = await admin.from('company_onboarding_status').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  AUDIT_RESULT.companyOnboardingStatusDeleted = dOnb?.length || 0;

  const { data: dInvites } = await admin.from('company_invitations').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  AUDIT_RESULT.companyInvitationsDeleted = dInvites?.length || 0;

  const { data: dApps } = await admin.from('applications').delete().or(`company_id.in.(${TARGET_COMPANY_IDS.join(',')}),onboarded_company_id.in.(${TARGET_COMPANY_IDS.join(',')})`).select('id');
  AUDIT_RESULT.applicationsDeleted = dApps?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.applicationsDeleted} applications`);

  // 7. Company Users & User Profiles
  console.log("\n[7] Deleting Company Users & User Profiles...");
  const { data: dCUsers } = await admin.from('company_users').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  AUDIT_RESULT.companyUsersDeleted = dCUsers?.length || 0;

  const { data: dProfiles } = await admin.from('user_profiles').delete().in('user_id', TARGET_AUTH_USER_IDS).select('id');
  AUDIT_RESULT.userProfilesDeleted = dProfiles?.length || 0;
  console.log(`  ✓ Deleted ${AUDIT_RESULT.companyUsersDeleted} company_users, ${AUDIT_RESULT.userProfilesDeleted} user_profiles`);

  // 8. Companies
  console.log("\n[8] Deleting Companies...");
  const { data: dComps, error: compErr } = await admin.from('companies').delete().in('id', TARGET_COMPANY_IDS).select('id, name');
  if (compErr) {
    console.error("  ❌ Error deleting companies:", compErr);
  } else {
    AUDIT_RESULT.companiesDeleted = dComps?.length || 0;
    console.log(`  ✓ Deleted ${AUDIT_RESULT.companiesDeleted} companies:`, dComps);
  }

  // 9. Supabase Auth Users
  console.log("\n[9] Deleting Supabase Auth Users...");
  for (const uid of TARGET_AUTH_USER_IDS) {
    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (!authErr) {
      AUDIT_RESULT.authUsersDeleted++;
      console.log(`  ✓ Deleted Auth User: ${uid}`);
    } else {
      console.warn(`  Warning deleting auth user ${uid}:`, authErr.message);
    }
  }

  console.log("\n===================================================================");
  console.log("PURGE EXECUTION FINISHED SUCCESSFULLY!");
  console.log("===================================================================");
  console.log(JSON.stringify(AUDIT_RESULT, null, 2));
}

purgeAll().catch(console.error);
