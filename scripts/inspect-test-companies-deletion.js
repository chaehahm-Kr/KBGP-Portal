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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function inspectTestCompanies() {
  console.log("=== Inspecting Companies matching 'John' and 'Carmel' ===");
  
  // 1. Find companies
  const { data: allCompanies, error: compErr } = await admin
    .from("companies")
    .select("*");
  
  if (compErr) {
    console.error("Error fetching companies:", compErr);
    return;
  }

  console.log(`Total companies in DB: ${allCompanies.length}`);
  
  const targetCompanies = allCompanies.filter(c => {
    const str = JSON.stringify(c).toLowerCase();
    return str.includes("john") || str.includes("carmel");
  });

  console.log("\nMatching Companies found:", JSON.stringify(targetCompanies, null, 2));
  
  const targetCompanyIds = targetCompanies.map(c => c.id);
  console.log("\nTarget Company IDs:", targetCompanyIds);

  if (targetCompanyIds.length === 0) {
    console.log("No companies matched 'John' or 'Carmel'. Checking all companies names for reference:");
    console.log(allCompanies.map(c => ({ id: c.id, name: c.name, name_ko: c.name_ko, name_en: c.name_en })));
    return;
  }

  for (const comp of targetCompanies) {
    console.log(`\n======================================================`);
    console.log(`INSPECTING COMPANY: ${comp.name} / ${comp.name_ko} / ${comp.name_en} (${comp.id})`);
    console.log(`======================================================`);

    // Company Users
    const { data: cUsers } = await admin.from("company_users").select("*").eq("company_id", comp.id);
    console.log(`- company_users (${cUsers?.length || 0}):`, cUsers);

    const userIds = (cUsers || []).map(u => u.user_id).filter(Boolean);
    
    // Auth Users
    if (userIds.length > 0) {
      const { data: authUsers } = await admin.auth.admin.listUsers();
      const matchingAuth = (authUsers?.users || []).filter(u => userIds.includes(u.id));
      console.log(`- auth.users (${matchingAuth.length}):`, matchingAuth.map(u => ({ id: u.id, email: u.email, metadata: u.user_metadata })));
    }

    // Profiles / User Profiles
    const { data: profiles } = await admin.from("user_profiles").select("*").in("user_id", userIds.length ? userIds : ["dummy-id"]);
    console.log(`- user_profiles (${profiles?.length || 0}):`, profiles);

    // Brands
    const { data: brands } = await admin.from("brands").select("*").eq("company_id", comp.id);
    console.log(`- brands (${brands?.length || 0}):`, brands);
    const brandIds = (brands || []).map(b => b.id);

    // Products (by company_id or brand_id)
    const { data: products } = await admin.from("products").select("id, name, display_name, letusto_sku, manufacture_sku, company_id, brand_id").or(`company_id.eq.${comp.id}${brandIds.length ? `,brand_id.in.(${brandIds.join(",")})` : ""}`);
    console.log(`- products (${products?.length || 0}):`, products);
    const productIds = (products || []).map(p => p.id);

    // Applications
    const { data: apps } = await admin.from("brand_applications").select("*").eq("company_id", comp.id);
    console.log(`- brand_applications (${apps?.length || 0}):`, apps);

    // Invitations
    const { data: invites } = await admin.from("company_invitations").select("*").eq("company_id", comp.id);
    console.log(`- company_invitations (${invites?.length || 0}):`, invites);

    // Onboarding Status
    const { data: onb } = await admin.from("company_onboarding_status").select("*").eq("company_id", comp.id);
    console.log(`- company_onboarding_status (${onb?.length || 0}):`, onb);

    // Agreements
    const { data: agreements } = await admin.from("company_agreements").select("*").eq("company_id", comp.id);
    console.log(`- company_agreements (${agreements?.length || 0}):`, agreements);

    // Shipping Origins
    const { data: origins } = await admin.from("company_shipping_origins").select("*").eq("company_id", comp.id);
    console.log(`- company_shipping_origins (${origins?.length || 0}):`, origins);

    // Inquiries
    const { data: inqs } = await admin.from("partner_inquiries").select("*").eq("company_id", comp.id);
    console.log(`- partner_inquiries (${inqs?.length || 0}):`, inqs);
    const inqIds = (inqs || []).map(i => i.id);
    if (inqIds.length > 0) {
      const { data: inqMsgs } = await admin.from("inquiry_messages").select("id, inquiry_id").in("inquiry_id", inqIds);
      console.log(`  - inquiry_messages (${inqMsgs?.length || 0})`);
    }

    // PO Requests / Purchase Orders
    const { data: poReqs } = await admin.from("po_requests").select("id, request_no, company_id").eq("company_id", comp.id);
    console.log(`- po_requests (${poReqs?.length || 0}):`, poReqs);

    const { data: pos } = await admin.from("purchase_orders").select("id, po_number, supplier_company_id").eq("supplier_company_id", comp.id);
    console.log(`- purchase_orders (${pos?.length || 0}):`, pos);

    // Invoices / Finance
    const { data: invs } = await admin.from("supplier_invoices").select("id, invoice_no, company_id").eq("company_id", comp.id);
    console.log(`- supplier_invoices (${invs?.length || 0}):`, invs);

    // Product Images / Certs / Videos
    if (productIds.length > 0) {
      const { data: pImages } = await admin.from("product_images").select("id, product_id, storage_path").in("product_id", productIds);
      console.log(`- product_images (${pImages?.length || 0}):`, pImages);

      const { data: pCerts } = await admin.from("product_certificates").select("id, product_id, storage_path").in("product_id", productIds);
      console.log(`- product_certificates (${pCerts?.length || 0}):`, pCerts);

      const { data: pVideos } = await admin.from("product_videos").select("id, product_id, storage_path").in("product_id", productIds);
      console.log(`- product_videos (${pVideos?.length || 0}):`, pVideos);

      const { data: pLogs } = await admin.from("product_change_logs").select("id, product_id").in("product_id", productIds);
      console.log(`- product_change_logs (${pLogs?.length || 0})`);
    }
  }
}

inspectTestCompanies().catch(console.error);
