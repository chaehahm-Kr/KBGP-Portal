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

    // 1. Fetch Shared Entities
    const compRes = await client.query("SELECT id FROM public.companies WHERE company_code = 'LET-476'");
    if (compRes.rows.length === 0) throw new Error("Letusto Test company (LET-476) not found!");
    const companyId = compRes.rows[0].id;

    const brandRes = await client.query("SELECT id FROM public.brands LIMIT 1");
    if (brandRes.rows.length === 0) throw new Error("No active brand found!");
    const brandId = brandRes.rows[0].id;

    const whRes = await client.query("SELECT id FROM public.warehouses WHERE status = 'active' LIMIT 1");
    if (whRes.rows.length === 0) throw new Error("No active warehouse found!");
    const warehouseId = whRes.rows[0].id;

    // Fetch Product A (already created in Dataset A)
    let prodRes = await client.query("SELECT id FROM public.products WHERE letusto_sku = 'TEST-LET-A'");
    if (prodRes.rows.length === 0) throw new Error("TEST-LET-A product not found! Run demo data creation script first.");
    const prodAId = prodRes.rows[0].id;

    console.log("Shared entity lookup succeeded.");

    // Helper to generate PO, Shipment, and Receiving
    async function createBaseFlow(scenarioNum, poNum, shipmentNum, recNum, prodId, qty, unitCost, supplierCompanyId) {
      // PO
      const poRes = await client.query(`
        INSERT INTO public.purchase_orders (
          po_number, supplier_id, order_date, po_status, fulfillment_status, currency, destination_warehouse_id, internal_note
        ) VALUES (
          $1, $2, CURRENT_DATE, 'SENT', 'RECEIVED', 'USD', $3,
          'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
        ) RETURNING id
      `, [poNum, supplierCompanyId, warehouseId]);
      const poId = poRes.rows[0].id;

      const poLineRes = await client.query(`
        INSERT INTO public.purchase_order_lines (
          purchase_order_id, product_id, product_name_snapshot, letusto_sku_snapshot, qty, unit_cost
        ) VALUES (
          $1, $2, 'TEST Product A', 'TEST-LET-A', $3, $4
        ) RETURNING id
      `, [poId, prodId, qty, unitCost]);
      const poLineId = poLineRes.rows[0].id;

      // Shipment
      const shipRes = await client.query(`
        INSERT INTO public.inbound_shipments (
          shipment_number, purchase_order_id, status, shipping_method, destination_warehouse_id, internal_note
        ) VALUES (
          $1, $2, 'RECEIVED', 'Ocean', $3,
          'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
        ) RETURNING id
      `, [shipmentNum, poId, warehouseId]);
      const shipId = shipRes.rows[0].id;

      const shipLineRes = await client.query(`
        INSERT INTO public.inbound_shipment_lines (
          inbound_shipment_id, purchase_order_line_id, product_id, shipped_qty
        ) VALUES (
          $1, $2, $3, $4
        ) RETURNING id
      `, [shipId, poLineId, prodId, qty]);
      const shipLineId = shipLineRes.rows[0].id;

      // Receiving
      const recRes = await client.query(`
        INSERT INTO public.receivings (
          receiving_number, inbound_shipment_id, purchase_order_id, warehouse_id, status, received_date, internal_note
        ) VALUES (
          $1, $2, $3, $4, 'FINALIZED', CURRENT_DATE,
          'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
        ) RETURNING id
      `, [recNum, shipId, poId, warehouseId]);
      const recId = recRes.rows[0].id;

      const recLineRes = await client.query(`
        INSERT INTO public.receiving_lines (
          receiving_id, inbound_shipment_line_id, purchase_order_line_id, product_id, received_qty, hold_qty, damaged_qty
        ) VALUES (
          $1, $2, $3, $4, $5, 0, 0
        ) RETURNING id
      `, [recId, shipLineId, poLineId, prodId, qty]);
      const recLineId = recLineRes.rows[0].id;

      // Update physical inventory
      await client.query(`
        INSERT INTO public.inventory_balances (product_id, warehouse_id, qty_on_hand, qty_hold) 
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (product_id, warehouse_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand
      `, [prodId, warehouseId, qty]);

      return { poId, poLineId, shipId, shipLineId, recId, recLineId };
    }

    // =========================================================================
    // SCENARIO 01 — INVOICE READY
    // =========================================================================
    console.log("Setting up Scenario 01...");
    await createBaseFlow('01', 'TEST-01-PO', 'TEST-01-SH', 'TEST-01-REC', prodAId, 100, 10.00, companyId);

    // =========================================================================
    // SCENARIO 02 — SETTLEMENT READY
    // =========================================================================
    console.log("Setting up Scenario 02...");
    const flow02 = await createBaseFlow('02', 'TEST-02-PO', 'TEST-02-SH', 'TEST-02-REC', prodAId, 100, 10.00, companyId);
    
    const inv02 = await client.query(`
      INSERT INTO public.supplier_invoices (
        supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date,
        subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, settlement_status, internal_note
      ) VALUES (
        $1, $2, 'TEST-02-AP', 'TEST-02-INV-NUM', CURRENT_DATE, CURRENT_DATE + 30,
        1000.00, 0.00, 0.00, 1000.00, 0.00, 1000.00, 'APPROVED', 'UNPAID', 'OPEN',
        'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
      ) RETURNING id
    `, [companyId, flow02.poId]);
    
    await client.query(`
      INSERT INTO public.supplier_invoice_lines (
        supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount
      ) VALUES (
        $1, $2, $3, 'TEST-LET-A', 'TEST Product A', 100, 10.00, 1000.00
      )
    `, [inv02.rows[0].id, flow02.poLineId, prodAId]);

    // =========================================================================
    // SCENARIO 03 — PAYMENT READY
    // =========================================================================
    console.log("Setting up Scenario 03...");
    const flow03 = await createBaseFlow('03', 'TEST-03-PO', 'TEST-03-SH', 'TEST-03-REC', prodAId, 100, 10.00, companyId);
    
    const inv03 = await client.query(`
      INSERT INTO public.supplier_invoices (
        supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date,
        subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, settlement_status, internal_note
      ) VALUES (
        $1, $2, 'TEST-03-AP', 'TEST-03-INV-NUM', CURRENT_DATE, CURRENT_DATE + 30,
        1000.00, 0.00, 0.00, 1000.00, 0.00, 1000.00, 'APPROVED', 'UNPAID', 'SETTLED',
        'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
      ) RETURNING id
    `, [companyId, flow03.poId]);

    await client.query(`
      INSERT INTO public.supplier_invoice_lines (
        supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount
      ) VALUES (
        $1, $2, $3, 'TEST-LET-A', 'TEST Product A', 100, 10.00, 1000.00
      )
    `, [inv03.rows[0].id, flow03.poLineId, prodAId]);

    // =========================================================================
    // SCENARIO 04 — PARTIAL PAYMENT READY
    // =========================================================================
    console.log("Setting up Scenario 04...");
    const flow04 = await createBaseFlow('04', 'TEST-04-PO', 'TEST-04-SH', 'TEST-04-REC', prodAId, 100, 10.00, companyId);
    
    const inv04 = await client.query(`
      INSERT INTO public.supplier_invoices (
        supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date,
        subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, settlement_status, internal_note
      ) VALUES (
        $1, $2, 'TEST-04-AP', 'TEST-04-INV-NUM', CURRENT_DATE, CURRENT_DATE + 30,
        1000.00, 0.00, 0.00, 1000.00, 400.00, 600.00, 'APPROVED', 'PARTIALLY_PAID', 'SETTLED',
        'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
      ) RETURNING id
    `, [companyId, flow04.poId]);

    await client.query(`
      INSERT INTO public.supplier_invoice_lines (
        supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount
      ) VALUES (
        $1, $2, $3, 'TEST-LET-A', 'TEST Product A', 100, 10.00, 1000.00
      )
    `, [inv04.rows[0].id, flow04.poLineId, prodAId]);

    // Insert 400.00 Completed Payment
    await client.query(`
      INSERT INTO public.supplier_payments (
        payment_number, supplier_invoice_id, payment_date, payment_method, payment_amount, status, internal_note
      ) VALUES (
        'TEST-04-PAY', $1, CURRENT_DATE, 'WIRE', 400.00, 'COMPLETED',
        'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
      )
    `, [inv04.rows[0].id]);

    // =========================================================================
    // SCENARIO 05 — LANDED COST READY
    // =========================================================================
    console.log("Setting up Scenario 05...");
    const flow05 = await createBaseFlow('05', 'TEST-05-PO', 'TEST-05-SH', 'TEST-05-REC', prodAId, 100, 10.00, companyId);
    
    const inv05 = await client.query(`
      INSERT INTO public.supplier_invoices (
        supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date,
        subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, settlement_status, internal_note
      ) VALUES (
        $1, $2, 'TEST-05-AP', 'TEST-05-INV-NUM', CURRENT_DATE, CURRENT_DATE + 30,
        1000.00, 0.00, 0.00, 1000.00, 1000.00, 0.00, 'APPROVED', 'PAID', 'SETTLED',
        'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
      ) RETURNING id
    `, [companyId, flow05.poId]);

    await client.query(`
      INSERT INTO public.supplier_invoice_lines (
        supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount
      ) VALUES (
        $1, $2, $3, 'TEST-LET-A', 'TEST Product A', 100, 10.00, 1000.00
      )
    `, [inv05.rows[0].id, flow05.poLineId, prodAId]);

    // Insert 1000.00 Completed Payment
    await client.query(`
      INSERT INTO public.supplier_payments (
        payment_number, supplier_invoice_id, payment_date, payment_method, payment_amount, status, internal_note
      ) VALUES (
        'TEST-05-PAY', $1, CURRENT_DATE, 'WIRE', 1000.00, 'COMPLETED',
        'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
      )
    `, [inv05.rows[0].id]);

    // =========================================================================
    // SCENARIO 06 — CONSOLIDATED LC READY
    // =========================================================================
    console.log("Setting up Scenario 06...");

    const consolidationSuppliers = [
      { code: 'B1', po: 'TEST-06-PO-B1', sh: 'TEST-06-SH-B1', rec: 'TEST-06-REC-B1', ap: 'TEST-06-AP-B1', inv: 'TEST-06-INV-B1-NUM' },
      { code: 'B2', po: 'TEST-06-PO-B2', sh: 'TEST-06-SH-B2', rec: 'TEST-06-REC-B2', ap: 'TEST-06-AP-B2', inv: 'TEST-06-INV-B2-NUM' },
      { code: 'B3', po: 'TEST-06-PO-B3', sh: 'TEST-06-SH-B3', rec: 'TEST-06-REC-B3', ap: 'TEST-06-AP-B3', inv: 'TEST-06-INV-B3-NUM' }
    ];

    for (let i = 0; i < 3; i++) {
      const cItem = consolidationSuppliers[i];
      // Fetch the suppliers generated during E2E script
      const cRes = await client.query("SELECT id FROM public.companies WHERE company_code = $1", [`TEST-${cItem.code}`]);
      if (cRes.rows.length === 0) throw new Error(`TEST-${cItem.code} supplier not found! Run E2E script first.`);
      const supId = cRes.rows[0].id;

      // Fetch products B1, B2, B3
      const pRes = await client.query("SELECT id FROM public.products WHERE letusto_sku = $1", [`TEST-LET-${cItem.code}`]);
      if (pRes.rows.length === 0) throw new Error(`TEST-LET-${cItem.code} product not found!`);
      const pId = pRes.rows[0].id;

      console.log(`Creating B${i+1} flow: PO=${cItem.po}, Shipment=${cItem.sh}, Receiving=${cItem.rec}...`);
      const flow = await createBaseFlow(`06-${cItem.code}`, cItem.po, cItem.sh, cItem.rec, pId, 100, 10.00, supId);

      const inv = await client.query(`
        INSERT INTO public.supplier_invoices (
          supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date,
          subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, settlement_status, internal_note
        ) VALUES (
          $1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + 30,
          1000.00, 0.00, 0.00, 1000.00, 1000.00, 0.00, 'APPROVED', 'PAID', 'SETTLED',
          'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
        ) RETURNING id
      `, [supId, flow.poId, cItem.ap, cItem.inv]);

      await client.query(`
        INSERT INTO public.supplier_invoice_lines (
          supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount
        ) VALUES (
          $1, $2, $3, $4, $5, 100, 10.00, 1000.00
        )
      `, [inv.rows[0].id, flow.poLineId, pId, `TEST-LET-${cItem.code}`, `TEST Product ${cItem.code}`]);

      // Completed payment
      await client.query(`
        INSERT INTO public.supplier_payments (
          payment_number, supplier_invoice_id, payment_date, payment_method, payment_amount, status, internal_note
        ) VALUES (
          $1, $2, CURRENT_DATE, 'WIRE', 1000.00, 'COMPLETED',
          'CONTROLLED QA SCENARIO. NOT A REAL BUSINESS TRANSACTION.'
        )
      `, [`TEST-06-PAY-${cItem.code}`, inv.rows[0].id]);
    }

    console.log("\n==========================================");
    console.log("🎉 SCENARIO READY TEST DATA GENERATED!");
    console.log("==========================================\n");

  } catch (err) {
    console.error("❌ Scenario creation failed:", err);
  } finally {
    await client.end();
  }
}

run();
