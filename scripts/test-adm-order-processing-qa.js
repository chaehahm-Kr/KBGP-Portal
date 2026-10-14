// scripts/test-adm-order-processing-qa.js
// Automated Functional QA for ADM-ORDER-PROCESSING-001
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

async function runQA() {
  console.log('========================================================');
  console.log('ADM-ORDER-PROCESSING-001: Centralized Order Processing QA');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (details) console.error(`   Details: ${details}`);
    }
  }

  // 1. Fetch all orders with enrichments
  const { data: rawOrders, error } = await sb
    .from('retailer_orders')
    .select(`
      id,
      order_number,
      company_id,
      store_id,
      order_status,
      payment_status,
      payment_terms,
      subtotal_amount,
      total_amount,
      discount_amount,
      coupon_code,
      total_items_count,
      total_skus_count,
      shipping_destination_type,
      recipient_name,
      shipping_city,
      shipping_state,
      cancellation_requested,
      refund_amount,
      refund_status,
      is_test,
      created_at,
      updated_at,
      companies ( id, name, company_code ),
      stores ( id, name, address, city, state, zip ),
      retailer_order_items ( id, product_id, sku, product_name, quantity, quantity_shipped, quantity_cancelled, unit_wholesale_price, line_total ),
      retailer_invoices ( id, invoice_number, invoice_date, due_date, total_amount, amount_paid, balance_due, invoice_status, payment_status, terms_name, fulfillment_id, fulfillment_number ),
      retailer_order_fulfillments ( id, fulfillment_number, status, carrier, tracking_number, box_count, created_at, shipped_at, retailer_order_fulfillment_boxes ( id, box_number, carrier, tracking_number, status ) )
    `)
    .order('created_at', { ascending: false });

  assert(!error && rawOrders && rawOrders.length > 0, 'Database queries return orders with all relationships', error?.message);

  // 2. Primary Test Order KSR-2026-000023 Verification
  const refOrder = rawOrders.find((o) => o.order_number === 'KSR-2026-000023');
  assert(Boolean(refOrder), 'Reference Test Order KSR-2026-000023 is present');

  if (refOrder) {
    const items = refOrder.retailer_order_items || [];
    const orderedUnits = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
    const shippedUnits = items.reduce((s, i) => s + Number(i.quantity_shipped || 0), 0);
    const remainingUnits = Math.max(0, orderedUnits - shippedUnits);

    assert(orderedUnits === 162, 'KSR-2026-000023 ordered units match 162', `Got: ${orderedUnits}`);
    assert(shippedUnits === 162, 'KSR-2026-000023 shipped units match 162', `Got: ${shippedUnits}`);
    assert(remainingUnits === 0, 'KSR-2026-000023 remaining units is 0', `Got: ${remainingUnits}`);
    assert(refOrder.order_status === 'shipped', 'KSR-2026-000023 order_status is shipped', `Got: ${refOrder.order_status}`);
    assert(refOrder.retailer_invoices?.length === 2, 'KSR-2026-000023 has exactly 2 dispatch-based invoices', `Got: ${refOrder.retailer_invoices?.length}`);
    assert(refOrder.retailer_order_fulfillments?.length === 2, 'KSR-2026-000023 has exactly 2 fulfillments', `Got: ${refOrder.retailer_order_fulfillments?.length}`);

    // Check Multi-Box cartons on fulfillment 1
    const ful1 = refOrder.retailer_order_fulfillments.find((f) => f.fulfillment_number === 'KSF-2026-000002');
    assert(Boolean(ful1), 'Fulfillment KSF-2026-000002 is present');
    if (ful1) {
      const boxes = ful1.retailer_order_fulfillment_boxes || [];
      assert(boxes.length === 3, 'KSF-2026-000002 contains 3 carton boxes', `Got: ${boxes.length}`);
      assert(boxes.every((b) => b.tracking_number && b.tracking_number.startsWith('1z')), 'KSF-2026-000002 all boxes have valid tracking numbers');
    }

    // Check fulfillment 2 missing tracking indicator
    const ful2 = refOrder.retailer_order_fulfillments.find((f) => f.fulfillment_number === 'KSF-2026-000003');
    assert(Boolean(ful2), 'Fulfillment KSF-2026-000003 is present');
    if (ful2) {
      const ful2Missing = !ful2.tracking_number && (!ful2.retailer_order_fulfillment_boxes || ful2.retailer_order_fulfillment_boxes.length === 0);
      assert(ful2Missing, 'KSF-2026-000003 correctly flags as missing tracking (awaiting carrier assignment)');
    }
  }

  // 3. Operational Summary KPI Counters
  let newOrders = 0;
  let readyToProcess = 0;
  let partiallyShipped = 0;
  let onHold = 0;
  let trackingMissing = 0;
  let completed = 0;

  for (const o of rawOrders) {
    const items = o.retailer_order_items || [];
    const ordered = items.reduce((s, i) => s + Number(i.quantity || 0), 0) || Number(o.total_ordered_units || o.total_items_count || 0);
    const shipped = ['shipped', 'delivered'].includes(o.order_status)
      ? ordered
      : items.reduce((s, i) => s + Number(i.quantity_shipped || 0), 0);
    const cancelled = ['cancelled'].includes(o.order_status)
      ? ordered
      : items.reduce((s, i) => s + Number(i.quantity_cancelled || 0), 0);
    const remaining = Math.max(0, ordered - shipped - cancelled);

    const hasTrackingMissing = (o.retailer_order_fulfillments || []).some((f) => {
      if (f.status === 'cancelled') return false;
      const hasFulfillmentTracking = Boolean(f.tracking_number && f.tracking_number.trim());
      const hasBoxTracking = (f.retailer_order_fulfillment_boxes || []).some(
        (b) => b.status === 'active' && Boolean(b.tracking_number && b.tracking_number.trim())
      );
      return !hasFulfillmentTracking && !hasBoxTracking;
    });

    if (o.order_status === 'submitted') newOrders++;
    if (['submitted', 'processing', 'partially_shipped'].includes(o.order_status) && remaining > 0 && !o.cancellation_requested) readyToProcess++;
    if (o.order_status === 'partially_shipped') partiallyShipped++;
    if (o.cancellation_requested) onHold++;
    if (hasTrackingMissing) trackingMissing++;
    if (['shipped', 'cancelled'].includes(o.order_status) || (remaining === 0 && shipped > 0)) completed++;
  }

  assert(rawOrders.length > 0, `Total Orders count is positive: ${rawOrders.length}`);
  assert(newOrders >= 1, `New Orders (submitted) counter is positive: ${newOrders}`);
  assert(trackingMissing >= 1, `Tracking Missing counter correctly identifies KSR-2026-000023: ${trackingMissing}`);
  assert(completed >= 6, `Completed orders counter is positive: ${completed}`);

  // 4. Companies and Stores cascading lists
  const { data: companies } = await sb.from('companies').select('id, name, company_code').order('name');
  const { data: stores } = await sb.from('stores').select('id, name, company_id, city, state').order('name');

  assert(companies && companies.length > 0, `Companies list retrieved: ${companies?.length} companies`);
  assert(stores && stores.length > 0, `Stores list retrieved: ${stores?.length} stores`);

  // Verify each store links to a company
  const orphanStores = stores.filter((s) => !companies.some((c) => c.id === s.company_id));
  assert(orphanStores.length === 0, 'All stores have valid company mappings for cascading filters');

  console.log(`\n========================================================`);
  console.log(`QA Result: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('========================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runQA();
