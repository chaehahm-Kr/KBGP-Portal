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

    console.log("Starting cleanup of CONTROLLED PRODUCTION TEST DATA...");

    // 1. Delete FIFO layers & Consumptions
    await client.query(`
      DELETE FROM public.inventory_cost_layer_consumptions 
      WHERE inventory_cost_layer_id IN (
        SELECT id FROM public.inventory_cost_layers 
        WHERE product_id IN (SELECT id FROM public.products WHERE letusto_sku LIKE 'TEST-%')
      )
    `);

    await client.query("DELETE FROM public.inventory_cost_layers WHERE product_id IN (SELECT id FROM public.products WHERE letusto_sku LIKE 'TEST-%')");
    await client.query("DELETE FROM public.inventory_movements WHERE product_id IN (SELECT id FROM public.products WHERE letusto_sku LIKE 'TEST-%')");
    await client.query("DELETE FROM public.inventory_balances WHERE product_id IN (SELECT id FROM public.products WHERE letusto_sku LIKE 'TEST-%')");

    // 2. Delete Landed Cost Results
    await client.query("DELETE FROM public.landed_cost_results WHERE landed_cost_case_id IN (SELECT id FROM public.landed_cost_cases WHERE landed_cost_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.landed_cost_allocations WHERE landed_cost_expense_id IN (SELECT id FROM public.landed_cost_expenses WHERE landed_cost_case_id IN (SELECT id FROM public.landed_cost_cases WHERE landed_cost_number LIKE 'TEST-%'))");
    await client.query("DELETE FROM public.landed_cost_expenses WHERE landed_cost_case_id IN (SELECT id FROM public.landed_cost_cases WHERE landed_cost_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.landed_cost_case_shipments WHERE landed_cost_case_id IN (SELECT id FROM public.landed_cost_cases WHERE landed_cost_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.landed_cost_cases WHERE landed_cost_number LIKE 'TEST-%'");

    // 3. Delete Supplier Invoices & Payments
    await client.query("DELETE FROM public.supplier_invoice_adjustments WHERE supplier_invoice_id IN (SELECT id FROM public.supplier_invoices WHERE internal_ap_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.supplier_invoice_lines WHERE supplier_invoice_id IN (SELECT id FROM public.supplier_invoices WHERE internal_ap_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.supplier_payments WHERE payment_number LIKE 'TEST-%'");
    await client.query("DELETE FROM public.supplier_invoices WHERE internal_ap_number LIKE 'TEST-%'");

    // 4. Delete Receivings
    await client.query("DELETE FROM public.receiving_lines WHERE receiving_id IN (SELECT id FROM public.receivings WHERE receiving_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.receivings WHERE receiving_number LIKE 'TEST-%'");

    // 5. Delete Shipments
    await client.query("DELETE FROM public.inbound_shipment_lines WHERE inbound_shipment_id IN (SELECT id FROM public.inbound_shipments WHERE shipment_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.inbound_shipments WHERE shipment_number LIKE 'TEST-%'");

    // 6. Delete POs
    await client.query("DELETE FROM public.purchase_order_lines WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE po_number LIKE 'TEST-%')");
    await client.query("DELETE FROM public.purchase_orders WHERE po_number LIKE 'TEST-%'");

    // 7. Delete Products & Companies
    await client.query("DELETE FROM public.products WHERE letusto_sku LIKE 'TEST-%'");
    await client.query("DELETE FROM public.company_roles WHERE company_id IN (SELECT id FROM public.companies WHERE company_code LIKE 'TEST-%')");
    await client.query("DELETE FROM public.companies WHERE company_code LIKE 'TEST-%'");

    console.log("Cleanup completed successfully!");

  } catch (err) {
    console.error("❌ Cleanup failed:", err);
  } finally {
    await client.end();
  }
}

run();
