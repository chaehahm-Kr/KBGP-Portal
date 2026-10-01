/**
 * execute-test-companies-deletion.js
 * 
 * Task ID: ADM-COMP-004
 * Task Name: Delete Two Test Companies & All Related Test Data
 * 
 * Targets:
 * 1. John (9f37ece5-e164-4357-9ecb-3982ee118ad4)
 * 2. Carmel (0ec853ef-45dc-4f8f-aa63-59debeaf4af1 & 053723dd-aa07-4200-9406-7b8773dd323e)
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

const TARGET_AUTH_USER_IDS = [
  'bc73d3fb-555a-4ca8-a61d-e1eac0583295', // john@letusto.com (John)
  '3fa315a4-4e92-411c-b3ee-bc3daf7ac67b', // polo7104@naver.com (Carmel)
  '4315b4b1-393e-4d1e-af3a-9dcd413b6f2e', // david.lee.tact@gmail.com (Carmel2)
  '07209857-e428-473f-9233-e4bba32f2fa6', // jinseoklee81@gmail.com (Carmel2)
];

const DELETION_LOG = {
  storageFiles: [],
  productAttributeValues: 0,
  productImages: 0,
  productCertificates: 0,
  productVideos: 0,
  productChangeLogs: 0,
  products: 0,
  inquiryEvents: 0,
  inquiryMessages: 0,
  partnerInquiries: 0,
  companyAgreements: 0,
  companyTaskAssignments: 0,
  companyShippingOrigins: 0,
  companyOnboardingStatus: 0,
  companyInvitations: 0,
  applications: 0,
  brands: 0,
  companyUsers: 0,
  userProfiles: 0,
  companies: 0,
  authUsers: []
};

async function executeDeletion() {
  console.log("===================================================================");
  console.log("STARTING SAFE PURGE OF TEST COMPANIES: John & Carmel / Carmel2");
  console.log("===================================================================");

  // 1. DELETE STORAGE FILES
  console.log("\n[Step 1] Deleting Storage Files...");
  
  // Storage files identified
  const storagePathsToDelete = [
    // Carmel
    '0ec853ef-45dc-4f8f-aa63-59debeaf4af1/products/751c5ba2-4dff-4a9f-9d87-37ae14a7ba94/images/5b3a82b7-d9c2-4037-ac2e-21a953fa6f93-2026-09-28 13 20 48.png',
    // Carmel2
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
    'agreements/053723dd-aa07-4200-9406-7b8773dd323e/KSN-AGR-CAR66-26-RL6L.pdf',
  ];

  const { data: delStorage, error: delStorageErr } = await admin.storage.from('company-uploads').remove(storagePathsToDelete);
  if (delStorageErr) {
    console.warn("Storage removal note:", delStorageErr);
  } else {
    console.log(`  ✓ Removed ${delStorage?.length || storagePathsToDelete.length} files from storage bucket 'company-uploads'`);
    DELETION_LOG.storageFiles = storagePathsToDelete;
  }

  // 2. IDENTIFY TARGET PRODUCTS & BRANDS
  const { data: targetBrands } = await admin.from('brands').select('id, name, company_id').in('company_id', TARGET_COMPANY_IDS);
  const brandIds = (targetBrands || []).map(b => b.id);
  console.log(`\nTarget Brands (${brandIds.length}):`, targetBrands?.map(b => `${b.name} (${b.id})`));

  const { data: targetProducts } = await admin.from('products').select('id, name, company_id').in('company_id', TARGET_COMPANY_IDS);
  const productIds = (targetProducts || []).map(p => p.id);
  console.log(`Target Products (${productIds.length}):`, targetProducts?.map(p => `${p.name} (${p.id})`));

  // 3. DELETE PRODUCT CHILD RECORDS
  if (productIds.length > 0) {
    console.log("\n[Step 2] Deleting Product Child Records...");
    
    const { data: dAttrs } = await admin.from('product_attribute_values').delete().in('product_id', productIds).select('id');
    DELETION_LOG.productAttributeValues = dAttrs?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.productAttributeValues} product_attribute_values`);

    const { data: dImgs } = await admin.from('product_images').delete().in('product_id', productIds).select('id');
    DELETION_LOG.productImages = dImgs?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.productImages} product_images`);

    const { data: dCerts } = await admin.from('product_certificates').delete().in('product_id', productIds).select('id');
    DELETION_LOG.productCertificates = dCerts?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.productCertificates} product_certificates`);

    const { data: dVids } = await admin.from('product_videos').delete().in('product_id', productIds).select('id');
    DELETION_LOG.productVideos = dVids?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.productVideos} product_videos`);

    const { data: dLogs } = await admin.from('product_change_logs').delete().in('product_id', productIds).select('id');
    DELETION_LOG.productChangeLogs = dLogs?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.productChangeLogs} product_change_logs`);

    const { data: dProds } = await admin.from('products').delete().in('id', productIds).select('id');
    DELETION_LOG.products = dProds?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.products} products`);
  }

  // 4. DELETE INQUIRIES & MESSAGES
  console.log("\n[Step 3] Deleting Support Inquiries & Messages...");
  const { data: targetInqs } = await admin.from('partner_inquiries').select('id, case_number, company_id').in('company_id', TARGET_COMPANY_IDS);
  const inqIds = (targetInqs || []).map(i => i.id);

  if (inqIds.length > 0) {
    const { data: dEvents } = await admin.from('inquiry_events').delete().in('inquiry_id', inqIds).select('id');
    DELETION_LOG.inquiryEvents = dEvents?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.inquiryEvents} inquiry_events`);

    const { data: dMsgs } = await admin.from('inquiry_messages').delete().in('inquiry_id', inqIds).select('id');
    DELETION_LOG.inquiryMessages = dMsgs?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.inquiryMessages} inquiry_messages`);

    const { data: dInqs } = await admin.from('partner_inquiries').delete().in('id', inqIds).select('id');
    DELETION_LOG.partnerInquiries = dInqs?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.partnerInquiries} partner_inquiries`);
  }

  // 5. DELETE AGREEMENTS
  console.log("\n[Step 4] Deleting Company Agreements...");
  const { data: dAgrs } = await admin.from('company_agreements').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  DELETION_LOG.companyAgreements = dAgrs?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.companyAgreements} company_agreements`);

  // 6. DELETE TASK ASSIGNMENTS
  console.log("\n[Step 5] Deleting Task Assignments...");
  const { data: dTasks } = await admin.from('company_task_assignments').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  DELETION_LOG.companyTaskAssignments = dTasks?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.companyTaskAssignments} company_task_assignments`);

  // 7. DELETE SHIPPING ORIGINS
  console.log("\n[Step 6] Deleting Shipping Origins...");
  const { data: dOrigins } = await admin.from('company_shipping_origins').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  DELETION_LOG.companyShippingOrigins = dOrigins?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.companyShippingOrigins} company_shipping_origins`);

  // 8. DELETE ONBOARDING STATUS & INVITATIONS
  console.log("\n[Step 7] Deleting Onboarding Status & Invitations...");
  const { data: dOnb } = await admin.from('company_onboarding_status').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  DELETION_LOG.companyOnboardingStatus = dOnb?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.companyOnboardingStatus} company_onboarding_status`);

  const { data: dInvites } = await admin.from('company_invitations').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  DELETION_LOG.companyInvitations = dInvites?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.companyInvitations} company_invitations`);

  // 9. DELETE APPLICATIONS
  console.log("\n[Step 8] Deleting Applications...");
  const { data: dApps } = await admin.from('applications').delete().or(`company_id.in.(${TARGET_COMPANY_IDS.join(',')}),onboarded_company_id.in.(${TARGET_COMPANY_IDS.join(',')})`).select('id');
  DELETION_LOG.applications = dApps?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.applications} applications`);

  // 10. DELETE BRANDS
  console.log("\n[Step 9] Deleting Brands...");
  const { data: dBrands } = await admin.from('brands').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  DELETION_LOG.brands = dBrands?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.brands} brands`);

  // 11. DELETE COMPANY USERS & USER PROFILES
  console.log("\n[Step 10] Deleting Company Users & User Profiles...");
  const { data: dCUsers } = await admin.from('company_users').delete().in('company_id', TARGET_COMPANY_IDS).select('id');
  DELETION_LOG.companyUsers = dCUsers?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.companyUsers} company_users`);

  const { data: dProfiles } = await admin.from('user_profiles').delete().in('user_id', TARGET_AUTH_USER_IDS).select('id');
  DELETION_LOG.userProfiles = dProfiles?.length || 0;
  console.log(`  ✓ Deleted ${DELETION_LOG.userProfiles} user_profiles`);

  // 12. DELETE COMPANIES
  console.log("\n[Step 11] Deleting Companies...");
  const { data: dComps, error: dCompsErr } = await admin.from('companies').delete().in('id', TARGET_COMPANY_IDS).select('id, name');
  if (dCompsErr) {
    console.error("Error deleting companies:", dCompsErr);
  } else {
    DELETION_LOG.companies = dComps?.length || 0;
    console.log(`  ✓ Deleted ${DELETION_LOG.companies} companies:`, dComps);
  }

  // 13. DELETE SUPABASE AUTH USERS
  console.log("\n[Step 12] Deleting Supabase Auth Users...");
  for (const uid of TARGET_AUTH_USER_IDS) {
    try {
      const { error: delAuthErr } = await admin.auth.admin.deleteUser(uid);
      if (delAuthErr) {
        console.warn(`  Warning deleting auth user ${uid}:`, delAuthErr.message);
      } else {
        console.log(`  ✓ Deleted auth user ${uid}`);
        DELETION_LOG.authUsers.push(uid);
      }
    } catch (e) {
      console.warn(`  Exception deleting auth user ${uid}:`, e.message);
    }
  }

  console.log("\n===================================================================");
  console.log("DELETION EXECUTION COMPLETE! SUMMARY:");
  console.log("===================================================================");
  console.log(JSON.stringify(DELETION_LOG, null, 2));
}

executeDeletion().catch(console.error);
