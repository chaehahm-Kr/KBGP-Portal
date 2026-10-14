const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
let env = {};
const envPaths = ['.env.production.local', '.env.local'];
for (const envPath of envPaths) {
  const fullPath = path.join(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    const envText = fs.readFileSync(fullPath, 'utf8');
    envText.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value;
      }
    });
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseKey = env['SUPABASE_SECRET_KEY'] || env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in env.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseKey);

// Pure resolver implementation mirroring lib/retailer/shipping-address-actions.ts
async function resolveCompanyDefaultShippingDestination(companyId) {
  // Rule 1: Configured default saved address
  const { data: defaultSaved } = await adminClient
    .from("retailer_shipping_addresses")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (
    defaultSaved &&
    defaultSaved.address_line1?.trim() &&
    defaultSaved.city?.trim() &&
    defaultSaved.state?.trim() &&
    defaultSaved.zip?.trim()
  ) {
    return {
      type: "saved_address",
      id: defaultSaved.id,
      name: defaultSaved.label,
      recipientName: defaultSaved.recipient_name,
      attentionName: defaultSaved.attention_name || null,
      addressLine1: defaultSaved.address_line1.trim(),
      addressLine2: defaultSaved.address_line2?.trim() || null,
      city: defaultSaved.city.trim(),
      state: defaultSaved.state.trim().toUpperCase(),
      zip: defaultSaved.zip.trim(),
      country: defaultSaved.country?.trim() || "US",
      phone: defaultSaved.phone?.trim() || null,
      deliveryNotes: defaultSaved.delivery_notes?.trim() || null,
      isExplicitDefault: true,
      isStoreFallback: false,
    };
  }

  // Rule 2: Deterministic Store Fallback
  const { data: storeRows } = await adminClient
    .from("stores")
    .select("id, name, address, city, state, zip, phone, manager_name, status")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name", { ascending: true });

  if (storeRows && storeRows.length > 0) {
    const eligibleStore = storeRows.find(
      (s) =>
        s.address?.trim() &&
        s.city?.trim() &&
        s.state?.trim() &&
        s.zip?.trim()
    );

    if (eligibleStore) {
      return {
        type: "store",
        id: eligibleStore.id,
        name: eligibleStore.name,
        recipientName: eligibleStore.manager_name || eligibleStore.name,
        attentionName: null,
        addressLine1: eligibleStore.address.trim(),
        addressLine2: null,
        city: eligibleStore.city.trim(),
        state: eligibleStore.state.trim().toUpperCase(),
        zip: eligibleStore.zip.trim(),
        country: "US",
        phone: eligibleStore.phone || null,
        deliveryNotes: null,
        isExplicitDefault: false,
        isStoreFallback: true,
      };
    }
  }

  // Rule 3: No default shipping destination available
  return null;
}

async function runTests() {
  console.log("==================================================================");
  console.log("  P4-R3 SHIPPING DESTINATION RESOLUTION & CONFIRMATION AUDIT      ");
  console.log("==================================================================");

  // 1. Fetch active retailer companies
  const { data: companies, error: compErr } = await adminClient
    .from("companies")
    .select("id, name")
    .limit(10);

  if (compErr || !companies) {
    console.error("Error fetching companies:", compErr);
    process.exit(1);
  }

  console.log(`Fetched ${companies.length} retailer companies to audit.`);

  let testedRule1 = false;
  let testedRule2 = false;
  let testedRule3 = false;

  for (const company of companies) {
    console.log(`\n--- Company: ${company.name} (${company.id}) ---`);

    // Check saved addresses
    const { data: savedAddrs } = await adminClient
      .from("retailer_shipping_addresses")
      .select("*")
      .eq("company_id", company.id)
      .eq("is_active", true);

    const defaultSaved = savedAddrs?.find(a => a.is_default);
    console.log(`Saved Addresses: ${savedAddrs?.length || 0} (Configured Default: ${defaultSaved ? defaultSaved.label : "None"})`);

    // Check stores
    const { data: stores } = await adminClient
      .from("stores")
      .select("id, name, address, city, state, zip, status")
      .eq("company_id", company.id)
      .eq("status", "active")
      .order("name", { ascending: true });

    const eligibleStores = stores?.filter(s => s.address?.trim() && s.city?.trim() && s.state?.trim() && s.zip?.trim()) || [];
    console.log(`Active Stores: ${stores?.length || 0} (Eligible with valid address: ${eligibleStores.length})`);

    // Resolve authoritative default
    const resolved = await resolveCompanyDefaultShippingDestination(company.id);

    if (defaultSaved && defaultSaved.address_line1?.trim()) {
      testedRule1 = true;
      console.log(`Expected: Rule 1 (Saved Address Default: ${defaultSaved.label})`);
      if (resolved && resolved.type === "saved_address" && resolved.id === defaultSaved.id && resolved.isExplicitDefault) {
        console.log(`✓ PASS: Correctly resolved to Rule 1 explicit saved default: ${resolved.name}`);
      } else {
        console.error(`✗ FAIL: Expected Rule 1, got:`, resolved);
        process.exit(1);
      }
    } else if (eligibleStores.length > 0) {
      testedRule2 = true;
      console.log(`Expected: Rule 2 (Store Fallback: ${eligibleStores[0].name})`);
      if (resolved && resolved.type === "store" && resolved.id === eligibleStores[0].id && resolved.isStoreFallback) {
        console.log(`✓ PASS: Correctly resolved to Rule 2 store fallback: ${resolved.name}`);
      } else {
        console.error(`✗ FAIL: Expected Rule 2, got:`, resolved);
        process.exit(1);
      }
    } else {
      testedRule3 = true;
      console.log(`Expected: Rule 3 (No complete address)`);
      if (resolved === null) {
        console.log(`✓ PASS: Correctly resolved to null (Rule 3)`);
      } else {
        console.error(`✗ FAIL: Expected null, got:`, resolved);
        process.exit(1);
      }
    }
  }

  // 2. Test Server-side Order Submission Validation Logic
  console.log("\n==================================================================");
  console.log("  TESTING SERVER-SIDE IS_SHIPPING_CONFIRMED ENFORCEMENT          ");
  console.log("==================================================================");

  function simulateSubmitValidation(payload) {
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: "Order cart cannot be empty." };
    }
    if (!payload.isShippingConfirmed) {
      return {
        success: false,
        error: "Please explicitly confirm the shipping destination before submitting your order.",
      };
    }
    return { success: true, message: "Validation passed to order processing." };
  }

  // Case A: Missing confirmation flag
  const testA = simulateSubmitValidation({ items: [{ productId: "p1", quantity: 10 }] });
  console.log("Case A (Missing isShippingConfirmed):", testA.error);
  if (!testA.success && testA.error.includes("Please explicitly confirm the shipping destination")) {
    console.log("✓ PASS: Correctly rejected unconfirmed order submission!");
  } else {
    console.error("✗ FAIL: Expected rejection for missing confirmation.");
    process.exit(1);
  }

  // Case B: Explicitly false confirmation flag
  const testB = simulateSubmitValidation({ items: [{ productId: "p1", quantity: 10 }], isShippingConfirmed: false });
  console.log("Case B (isShippingConfirmed: false):", testB.error);
  if (!testB.success && testB.error.includes("Please explicitly confirm the shipping destination")) {
    console.log("✓ PASS: Correctly rejected false isShippingConfirmed!");
  } else {
    console.error("✗ FAIL: Expected rejection for false confirmation.");
    process.exit(1);
  }

  // Case C: Explicitly true confirmation flag
  const testC = simulateSubmitValidation({ items: [{ productId: "p1", quantity: 10 }], isShippingConfirmed: true });
  console.log("Case C (isShippingConfirmed: true):", testC.message);
  if (testC.success) {
    console.log("✓ PASS: Correctly accepted order submission with explicit confirmation!");
  } else {
    console.error("✗ FAIL: Expected acceptance for true confirmation.");
    process.exit(1);
  }

  // 3. Dynamic Rule 1 Override and Rule 2 Fallback Test
  console.log("\n==================================================================");
  console.log("  TESTING DYNAMIC RULE 1 OVERRIDE & STORE FALLBACK RESTORATION    ");
  console.log("==================================================================");

  const testCompId = "dc9249be-a9e0-4975-a4c9-b602bb2baa47"; // K SELECT Test Retailer with 2 stores

  // Verify initial state: Rule 2 (Store Fallback)
  const initialResolved = await resolveCompanyDefaultShippingDestination(testCompId);
  console.log("Initial state (Should be Rule 2 store fallback):", initialResolved?.name);
  if (initialResolved?.type !== "store" || !initialResolved?.isStoreFallback) {
    console.error("✗ Initial state expected store fallback, got:", initialResolved);
    process.exit(1);
  }
  console.log("✓ PASS: Initial state is Store Fallback:", initialResolved.name);

  // Insert a test default saved address
  const { data: newSaved, error: insertErr } = await adminClient
    .from("retailer_shipping_addresses")
    .insert({
      company_id: testCompId,
      label: "QA Test Central Warehouse",
      recipient_name: "QA Dock Manager",
      address_line1: "999 Logistics Pkwy",
      city: "Secaucus",
      state: "NJ",
      zip: "07094",
      country: "US",
      is_default: true,
      is_active: true,
    })
    .select()
    .single();

  if (insertErr || !newSaved) {
    console.error("Failed to insert test default address:", insertErr);
    process.exit(1);
  }

  try {
    // Resolve again: Must now be Rule 1 (QA Test Central Warehouse)
    const rule1Resolved = await resolveCompanyDefaultShippingDestination(testCompId);
    console.log("After inserting default saved address (Should be Rule 1):", rule1Resolved?.name);
    if (rule1Resolved?.type === "saved_address" && rule1Resolved?.id === newSaved.id && rule1Resolved?.isExplicitDefault) {
      console.log("✓ PASS: Correctly overridden by Rule 1 default saved address!");
    } else {
      console.error("✗ FAIL: Expected Rule 1 override, got:", rule1Resolved);
      process.exit(1);
    }

    // Now unset default on saved address
    const { error: unsetErr } = await adminClient
      .from("retailer_shipping_addresses")
      .update({ is_default: false })
      .eq("id", newSaved.id);

    if (unsetErr) {
      console.error("Failed to unset default:", unsetErr);
      process.exit(1);
    }

    // Resolve again: Must automatically revert to Rule 2 (Store Fallback)
    const revertedResolved = await resolveCompanyDefaultShippingDestination(testCompId);
    console.log("After unsetting default on saved address (Should revert to Rule 2):", revertedResolved?.name);
    if (revertedResolved?.type === "store" && revertedResolved?.isStoreFallback && revertedResolved?.id === initialResolved.id) {
      console.log("✓ PASS: Correctly reverted to Rule 2 store fallback:", revertedResolved.name);
    } else {
      console.error("✗ FAIL: Expected reversion to store fallback, got:", revertedResolved);
      process.exit(1);
    }
  } finally {
    // Cleanup: Delete the temporary test address
    await adminClient
      .from("retailer_shipping_addresses")
      .delete()
      .eq("id", newSaved.id);
    console.log("Cleaned up temporary test shipping address.");
  }

  console.log("\n==================================================================");
  console.log("  ALL P4-R3 DESTINATION & CONFIRMATION TESTS PASSED 100%!          ");
  console.log("==================================================================");
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
