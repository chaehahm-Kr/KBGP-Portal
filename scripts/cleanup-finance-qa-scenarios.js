const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: "aws-1-us-west-2.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: "postgres.shzfrppdobpmrstcjfqu",
    password: "Extreme702$$##",
  });
  
  try {
    await client.connect();
    console.log("Connected to DB!");

    console.log("Starting cleanup of READY-TO-TEST SCENARIO DATA...");

    const testPrefixes = ['TEST-01-%', 'TEST-02-%', 'TEST-03-%', 'TEST-04-%', 'TEST-05-%', 'TEST-06-%'];

    // 1. Delete Landed Cost Results / Case shipments / Cases
    // Note: Landed Cost cases aren't pre-created by the script but might be created by the user testing the workflow.
    await client.query(`
      DELETE FROM public.landed_cost_results 
      WHERE landed_cost_case_id IN (
        SELECT id FROM public.landed_cost_cases 
        WHERE landed_cost_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.landed_cost_allocations 
      WHERE landed_cost_expense_id IN (
        SELECT id FROM public.landed_cost_expenses 
        WHERE landed_cost_case_id IN (
          SELECT id FROM public.landed_cost_cases 
          WHERE landed_cost_number LIKE ANY($1)
        )
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.landed_cost_expenses 
      WHERE landed_cost_case_id IN (
        SELECT id FROM public.landed_cost_cases 
        WHERE landed_cost_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.landed_cost_case_shipments 
      WHERE landed_cost_case_id IN (
        SELECT id FROM public.landed_cost_cases 
        WHERE landed_cost_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.landed_cost_cases 
      WHERE landed_cost_number LIKE ANY($1)
    `, [testPrefixes]);

    // 2. Delete Supplier Payments (referencing invoices with test internal AP numbers, or payments matching prefixes)
    await client.query(`
      DELETE FROM public.supplier_payments 
      WHERE payment_number LIKE ANY($1) 
        OR supplier_invoice_id IN (
          SELECT id FROM public.supplier_invoices 
          WHERE internal_ap_number LIKE ANY($1)
        )
    `, [testPrefixes]);

    // 3. Delete Supplier Invoices
    await client.query(`
      DELETE FROM public.supplier_invoice_adjustments 
      WHERE supplier_invoice_id IN (
        SELECT id FROM public.supplier_invoices 
        WHERE internal_ap_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.supplier_invoice_lines 
      WHERE supplier_invoice_id IN (
        SELECT id FROM public.supplier_invoices 
        WHERE internal_ap_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.supplier_invoices 
      WHERE internal_ap_number LIKE ANY($1)
    `, [testPrefixes]);

    // 4. Delete Receivings
    await client.query(`
      DELETE FROM public.receiving_lines 
      WHERE receiving_id IN (
        SELECT id FROM public.receivings 
        WHERE receiving_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.receivings 
      WHERE receiving_number LIKE ANY($1)
    `, [testPrefixes]);

    // 5. Delete Shipments
    await client.query(`
      DELETE FROM public.inbound_shipment_lines 
      WHERE inbound_shipment_id IN (
        SELECT id FROM public.inbound_shipments 
        WHERE shipment_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.inbound_shipments 
      WHERE shipment_number LIKE ANY($1)
    `, [testPrefixes]);

    // 6. Delete POs
    await client.query(`
      DELETE FROM public.purchase_order_lines 
      WHERE purchase_order_id IN (
        SELECT id FROM public.purchase_orders 
        WHERE po_number LIKE ANY($1)
      )
    `, [testPrefixes]);

    await client.query(`
      DELETE FROM public.purchase_orders 
      WHERE po_number LIKE ANY($1)
    `, [testPrefixes]);

    // 7. Revert inventory balance counts (decrement physical balance by 100 per flow)
    // To keep it simple, since inventory_balances holds totals, we don't delete them, but we can subtract or leave as-is since these are test products.
    // Let's decrement for prodAId by (100 * 5) = 500 units, and B1/B2/B3 by 100 units.
    const prodARes = await client.query("SELECT id FROM public.products WHERE letusto_sku = 'TEST-LET-A'");
    if (prodARes.rows.length > 0) {
      await client.query("UPDATE public.inventory_balances SET qty_on_hand = GREATEST(qty_on_hand - 500, 0) WHERE product_id = $1", [prodARes.rows[0].id]);
    }
    const bCodes = ['B1', 'B2', 'B3'];
    for (const code of bCodes) {
      const pRes = await client.query("SELECT id FROM public.products WHERE letusto_sku = $1", [`TEST-LET-${code}`]);
      if (pRes.rows.length > 0) {
        await client.query("UPDATE public.inventory_balances SET qty_on_hand = GREATEST(qty_on_hand - 100, 0) WHERE product_id = $1", [pRes.rows[0].id]);
      }
    }

    console.log("Scenario cleanup completed successfully!");

  } catch (err) {
    console.error("❌ Cleanup failed:", err);
  } finally {
    await client.end();
  }
}

run();
