const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

function computeAuthoritativeOrderStatus(rawStatus, totalOrdered, totalShipped, totalCancelled) {
  const norm = (rawStatus || '').toLowerCase();
  const remaining = Math.max(0, totalOrdered - totalShipped - totalCancelled);
  if (totalCancelled >= totalOrdered && totalOrdered > 0) return 'cancelled';
  if (norm === 'cancelled' && totalShipped === 0) return 'cancelled';
  if (totalShipped > 0 && remaining === 0 && totalCancelled > 0) return 'partially_cancelled';
  if (norm === 'partially_cancelled' && remaining === 0) return 'partially_cancelled';
  if (totalShipped >= totalOrdered && totalOrdered > 0 && totalCancelled === 0) return 'shipped';
  if (remaining === 0 && totalShipped > 0 && totalCancelled === 0) return 'shipped';
  if (totalShipped > 0 && remaining > 0) return 'partially_shipped';
  if (norm === 'processing' || norm === 'confirmed') return 'processing';
  return 'submitted';
}

function isOrderOperationallyCompleted(ord) {
  if (ord.totalOrderedUnits === 0) {
    return ord.orderStatus === 'cancelled';
  }
  if (ord.totalRemainingUnits > 0) {
    return false;
  }
  if (ord.totalShippedUnits + ord.totalCancelledUnits !== ord.totalOrderedUnits) {
    return false;
  }
  return ['shipped', 'cancelled', 'partially_cancelled'].includes(ord.orderStatus);
}

function calculateDaysOpenNumber(createdAt) {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const utcCreated = Date.UTC(createdDate.getUTCFullYear(), createdDate.getUTCMonth(), createdDate.getUTCDate());
  const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = Math.floor((utcNow - utcCreated) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

async function runQA() {
  console.log('=== [QA TEST: ADM-ORDER-PROCESSING-001-R1] ===');

  const { data: rawOrders, error } = await sb
    .from('retailer_orders')
    .select(`
      id, order_number, order_status, total_items_count, is_test, created_at, updated_at,
      retailer_order_items ( id, sku, product_name, quantity, quantity_shipped, quantity_cancelled ),
      retailer_order_fulfillments (
        id, fulfillment_number, status, carrier, tracking_number, box_count, created_at, shipped_at, notes,
        retailer_order_fulfillment_boxes ( id, box_number, box_total, carrier, tracking_number, status )
      )
    `)
    .order('created_at', { ascending: false });

  if (error || !rawOrders) {
    console.error('Failed to fetch orders:', error);
    process.exit(1);
  }

  console.log(`Fetched ${rawOrders.length} orders from Supabase.`);

  const mapped = rawOrders.map(o => {
    const items = o.retailer_order_items || [];
    const totalOrderedUnits = items.reduce((s, it) => s + Number(it.quantity || 0), 0) || Number(o.total_items_count || 0);
    const totalShippedUnits = ['shipped', 'delivered'].includes(o.order_status)
      ? totalOrderedUnits
      : items.reduce((s, it) => s + Number(it.quantity_shipped || 0), 0);
    const totalCancelledUnits = ['cancelled'].includes(o.order_status)
      ? totalOrderedUnits
      : items.reduce((s, it) => s + Number(it.quantity_cancelled || 0), 0);
    const totalRemainingUnits = Math.max(0, totalOrderedUnits - totalShippedUnits - totalCancelledUnits);

    const authoritativeStatus = computeAuthoritativeOrderStatus(
      o.order_status,
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits
    );

    const fulfillments = o.retailer_order_fulfillments || [];
    const dispatches = fulfillments.map(f => {
      const rawBoxes = f.retailer_order_fulfillment_boxes || [];
      const activeBoxes = rawBoxes.filter(b => b.status === 'active');
      const isTrackingComplete =
        f.status === 'cancelled' ||
        (activeBoxes.length > 0
          ? activeBoxes.every(b => Boolean(b.tracking_number && b.tracking_number.trim()))
          : Boolean(f.tracking_number && f.tracking_number.trim()));

      return {
        id: f.id,
        fulfillmentNumber: f.fulfillment_number,
        status: f.status,
        isTrackingComplete
      };
    });

    const hasConfirmedDispatch = dispatches.some(d => d.status !== 'cancelled');
    const untrackedDispatchesCount = dispatches.filter(d => d.status !== 'cancelled' && !d.isTrackingComplete).length;
    const isCompleted = isOrderOperationallyCompleted({
      orderStatus: authoritativeStatus,
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits,
      totalRemainingUnits,
    });
    const daysOpen = isCompleted ? null : calculateDaysOpenNumber(o.created_at);

    return {
      orderNumber: o.order_number,
      orderStatus: authoritativeStatus,
      totalOrderedUnits,
      totalShippedUnits,
      totalCancelledUnits,
      totalRemainingUnits,
      hasConfirmedDispatch,
      untrackedDispatchesCount,
      isCompleted,
      daysOpen,
      createdAt: o.created_at,
    };
  });

  // Check 1: Completed count
  const completedCount = mapped.filter(o => o.isCompleted).length;
  console.log(`[CHECK 1] Completed Orders: ${completedCount} (Expected: 6)`);
  if (completedCount !== 6) throw new Error(`Expected 6 completed orders, got ${completedCount}`);

  // Check 2: KSR-2026-000012 zero-unit processing order
  const ord12 = mapped.find(o => o.orderNumber === 'KSR-2026-000012');
  console.log(`[CHECK 2] KSR-2026-000012 status=${ord12.orderStatus}, isCompleted=${ord12.isCompleted}, daysOpen=${ord12.daysOpen}`);
  if (ord12.isCompleted !== false) throw new Error('KSR-2026-000012 must NOT be completed');

  // Check 3: KSR-2026-000023 multi-dispatch tracking
  const ord23 = mapped.find(o => o.orderNumber === 'KSR-2026-000023');
  console.log(`[CHECK 3] KSR-2026-000023 hasConfirmedDispatch=${ord23.hasConfirmedDispatch}, untrackedDispatches=${ord23.untrackedDispatchesCount}`);
  if (!ord23.hasConfirmedDispatch || ord23.untrackedDispatchesCount !== 1) {
    throw new Error('KSR-2026-000023 must have 1 untracked dispatch');
  }

  // Check 4: KSR-2026-000022 legacy header tracking
  const ord22 = mapped.find(o => o.orderNumber === 'KSR-2026-000022');
  console.log(`[CHECK 4] KSR-2026-000022 hasConfirmedDispatch=${ord22.hasConfirmedDispatch}, untrackedDispatches=${ord22.untrackedDispatchesCount}`);
  if (!ord22.hasConfirmedDispatch || ord22.untrackedDispatchesCount !== 0) {
    throw new Error('KSR-2026-000022 must be fully tracked via legacy fallback');
  }

  // Check 5: KSR-2026-000002 unconfirmed dispatch
  const ord02 = mapped.find(o => o.orderNumber === 'KSR-2026-000002');
  console.log(`[CHECK 5] KSR-2026-000002 hasConfirmedDispatch=${ord02.hasConfirmedDispatch}, untrackedDispatches=${ord02.untrackedDispatchesCount}`);
  if (ord02.hasConfirmedDispatch) throw new Error('KSR-2026-000002 must NOT have confirmed dispatch');

  // Check 6: Multi-status filter simulation
  const filterSubmitted = mapped.filter(o => ['submitted'].includes(o.orderStatus)).length;
  const filterProcessing = mapped.filter(o => ['processing'].includes(o.orderStatus)).length;
  const filterSubmittedOrProcessing = mapped.filter(o => ['submitted', 'processing'].includes(o.orderStatus)).length;
  console.log(`[CHECK 6] Multi-status filter: submitted=${filterSubmitted}, processing=${filterProcessing}, combined=${filterSubmittedOrProcessing}`);
  if (filterSubmittedOrProcessing !== filterSubmitted + filterProcessing) {
    throw new Error('Multi-status OR filter logic failed');
  }

  // Check 7: Days Open values
  console.log('[CHECK 7] Days Open Breakdown:');
  mapped.forEach(o => {
    console.log(`  - ${o.orderNumber}: status=${o.orderStatus}, isCompleted=${o.isCompleted}, daysOpen=${o.daysOpen}`);
  });

  console.log('\n=== ALL QA ASSERTIONS PASSED! ===');
}

runQA().catch(err => {
  console.error('QA FAILED:', err);
  process.exit(1);
});
