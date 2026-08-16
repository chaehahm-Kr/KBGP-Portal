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

    console.log("Using shared entities: Brand ID =", brandId, ", Warehouse ID =", warehouseId);

    // ==========================================
    // 2. SETUP DATASET A: SIMPLE END-TO-END
    // ==========================================
    console.log("Setting up Dataset A (Simple End-to-End)...");

    // Product A
    let prodARes = await client.query("SELECT id FROM public.products WHERE letusto_sku = 'TEST-LET-A'");
    let prodAId;
    if (prodARes.rows.length === 0) {
      const ins = await client.query(`
        INSERT INTO public.products (
          name, category, status, company_id, brand_id, letusto_sku, trading_status, carton_pack_qty, carton_cbm, package_weight, price_usd_fob, description
        ) VALUES (
          'TEST Product A', 'skincare', 'registered', $1, $2, 'TEST-LET-A', 'active', 10, 0.05, 1.0, 10.00,
          'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
        ) RETURNING id
      `, [companyId, brandId]);
      prodAId = ins.rows[0].id;
    } else {
      prodAId = prodARes.rows[0].id;
    }

    // PO A
    const poARes = await client.query(`
      INSERT INTO public.purchase_orders (
        po_number, supplier_id, order_date, po_status, fulfillment_status, currency, destination_warehouse_id, internal_note
      ) VALUES (
        'TEST-PO-A', $1, CURRENT_DATE, 'APPROVED', 'RECEIVED', 'USD', $2,
        'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
      ) RETURNING id
    `, [companyId, warehouseId]);
    const poAId = poARes.rows[0].id;

    const poALineRes = await client.query(`
      INSERT INTO public.purchase_order_lines (
        purchase_order_id, product_id, product_name_snapshot, letusto_sku_snapshot, qty, unit_cost
      ) VALUES (
        $1, $2, 'TEST Product A', 'TEST-LET-A', 100, 10.00
      ) RETURNING id
    `, [poAId, prodAId]);
    const poALineId = poALineRes.rows[0].id;

    // Shipment A
    const shipARes = await client.query(`
      INSERT INTO public.inbound_shipments (
        shipment_number, purchase_order_id, status, shipping_method, destination_warehouse_id, internal_note
      ) VALUES (
        'TEST-SH-A', $1, 'RECEIVED', 'Ocean', $2,
        'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
      ) RETURNING id
    `, [poAId, warehouseId]);
    const shipAId = shipARes.rows[0].id;

    const shipALineRes = await client.query(`
      INSERT INTO public.inbound_shipment_lines (
        inbound_shipment_id, purchase_order_line_id, product_id, shipped_qty
      ) VALUES (
        $1, $2, $3, 100
      ) RETURNING id
    `, [shipAId, poALineId, prodAId]);
    const shipALineId = shipALineRes.rows[0].id;

    // Receiving A
    const recARes = await client.query(`
      INSERT INTO public.receivings (
        receiving_number, inbound_shipment_id, purchase_order_id, warehouse_id, status, received_date, internal_note
      ) VALUES (
        'TEST-REC-A', $1, $2, $3, 'FINALIZED', CURRENT_DATE,
        'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
      ) RETURNING id
    `, [shipAId, poAId, warehouseId]);
    const recAId = recARes.rows[0].id;

    const recALineRes = await client.query(`
      INSERT INTO public.receiving_lines (
        receiving_id, inbound_shipment_line_id, purchase_order_line_id, product_id, received_qty, hold_qty, damaged_qty
      ) VALUES (
        $1, $2, $3, $4, 100, 0, 0
      ) RETURNING id
    `, [recAId, shipALineId, poALineId, prodAId]);
    const recALineId = recALineRes.rows[0].id;

    // Update physical balance to 100 units
    await client.query(`
      INSERT INTO public.inventory_balances (product_id, warehouse_id, qty_on_hand, qty_hold) 
      VALUES ($1, $2, 100, 0)
      ON CONFLICT (product_id, warehouse_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand
    `, [prodAId, warehouseId]);

    // Supplier Invoice A
    const invARes = await client.query(`
      INSERT INTO public.supplier_invoices (
        supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date,
        subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, internal_note
      ) VALUES (
        $1, $2, 'TEST-AP-A', 'TEST-INV-A', CURRENT_DATE, CURRENT_DATE + 30,
        1000.00, 0.00, 0.00, 1000.00, 1000.00, 0.00, 'APPROVED', 'PAID',
        'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
      ) RETURNING id
    `, [companyId, poAId]);
    const invAId = invARes.rows[0].id;

    await client.query(`
      INSERT INTO public.supplier_invoice_lines (
        supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount
      ) VALUES (
        $1, $2, $3, 'TEST-LET-A', 'TEST Product A', 100, 10.00, 1000.00
      )
    `, [invAId, poALineId, prodAId]);

    // Payment A
    await client.query(`
      INSERT INTO public.supplier_payments (
        payment_number, supplier_invoice_id, payment_date, payment_method, payment_amount, status, internal_note
      ) VALUES (
        'TEST-PAY-A', $1, CURRENT_DATE, 'WIRE', 1000.00, 'COMPLETED',
        'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
      )
    `, [invAId]);

    // Landed Cost Case A
    const caseARes = await client.query(`
      INSERT INTO public.landed_cost_cases (
        landed_cost_number, status, description, internal_note
      ) VALUES (
        'TEST-LC-A', 'FINALIZED', 'Simple Test Case A',
        'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
      ) RETURNING id
    `);
    const caseAId = caseARes.rows[0].id;

    await client.query("INSERT INTO public.landed_cost_case_shipments (landed_cost_case_id, inbound_shipment_id) VALUES ($1, $2)", [caseAId, shipAId]);

    // Insert Expenses & Allocations for A
    const expA1 = await client.query("INSERT INTO public.landed_cost_expenses (landed_cost_case_id, cost_type, currency, base_currency_amount, fx_rate_to_base, allocation_method, estimated_amount, actual_amount) VALUES ($1, 'OCEAN_FREIGHT', 'USD', 200.00, 1.0, 'CBM', 200.00, 200.00) RETURNING id", [caseAId]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 200.00)", [expA1.rows[0].id, recALineId]);

    const expA2 = await client.query("INSERT INTO public.landed_cost_expenses (landed_cost_case_id, cost_type, currency, base_currency_amount, fx_rate_to_base, allocation_method, estimated_amount, actual_amount) VALUES ($1, 'DUTY', 'USD', 100.00, 1.0, 'DIRECT', 100.00, 100.00) RETURNING id", [caseAId]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 100.00)", [expA2.rows[0].id, recALineId]);

    const expA3 = await client.query("INSERT INTO public.landed_cost_expenses (landed_cost_case_id, cost_type, currency, base_currency_amount, fx_rate_to_base, allocation_method, estimated_amount, actual_amount) VALUES ($1, 'TRUCKING', 'USD', 50.00, 1.0, 'WEIGHT', 50.00, 50.00) RETURNING id", [caseAId]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 50.00)", [expA3.rows[0].id, recALineId]);

    // Landed Cost Result A
    const resARes = await client.query(`
      INSERT INTO public.landed_cost_results (
        landed_cost_case_id, receiving_line_id, product_id, received_date, inventory_received_qty,
        supplier_acquisition_cost, freight_cost, duty_cost, broker_cost, port_cost, trucking_cost,
        insurance_cost, inspection_cost, other_cost, total_ancillary_cost, total_landed_cost, unit_landed_cost, cost_status
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, 100,
        1000.00, 200.00, 100.00, 0.00, 0.00, 50.00, 0.00, 0.00, 0.00, 350.00, 1350.00, 13.5000, 'FINAL'
      ) RETURNING id
    `, [caseAId, recALineId, prodAId]);
    const resAId = resARes.rows[0].id;

    // FIFO Cost Layer A
    await client.query(`
      INSERT INTO public.inventory_cost_layers (
        product_id, warehouse_id, receiving_line_id, landed_cost_result_id, received_date, original_qty, remaining_qty, unit_landed_cost, original_total_cost, status
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, 100, 100, 13.5000, 1350.00, 'ACTIVE'
      )
    `, [prodAId, warehouseId, recALineId, resAId]);

    console.log("Dataset A setup finished successfully.");

    // ==========================================
    // 3. SETUP DATASET B: CONSOLIDATED SHIPMENT
    // ==========================================
    console.log("Setting up Dataset B (Consolidated Shipment)...");

    // 3 Suppliers
    const suppliers = [];
    for (const code of ['B1', 'B2', 'B3']) {
      let supRes = await client.query("SELECT id FROM public.companies WHERE company_code = $1", [`TEST-${code}`]);
      if (supRes.rows.length === 0) {
        supRes = await client.query(`
          INSERT INTO public.companies (
            name, company_code, status, business_registration_number, country, intro
          ) VALUES (
            $1, $2, 'active', $3, 'South Korea',
            'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
          ) RETURNING id
        `, [`TEST Supplier ${code}`, `TEST-${code}`, `TEST-REG-${code}`]);
        
        // Insert role
        await client.query(`
          INSERT INTO public.company_roles (company_id, role)
          VALUES ($1, 'Supplier')
        `, [supRes.rows[0].id]);
      }
      suppliers.push(supRes.rows[0].id);
    }

    // 3 Products
    const products = [];
    // Prod B1 (CBM=0.05, WEIGHT=1.0)
    let p1 = await client.query("SELECT id FROM public.products WHERE letusto_sku = 'TEST-LET-B1'");
    if (p1.rows.length === 0) {
      p1 = await client.query(`
        INSERT INTO public.products (
          name, category, status, company_id, brand_id, letusto_sku, trading_status, carton_pack_qty, carton_cbm, package_weight, price_usd_fob, description
        ) VALUES (
          'TEST Product B1', 'skincare', 'registered', $1, $2, 'TEST-LET-B1', 'active', 10, 0.05, 1.0, 10.00,
          'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
        ) RETURNING id
      `, [companyId, brandId]);
    }
    products.push(p1.rows[0].id);

    // Prod B2 (CBM=0.08, WEIGHT=1.5)
    let p2 = await client.query("SELECT id FROM public.products WHERE letusto_sku = 'TEST-LET-B2'");
    if (p2.rows.length === 0) {
      p2 = await client.query(`
        INSERT INTO public.products (
          name, category, status, company_id, brand_id, letusto_sku, trading_status, carton_pack_qty, carton_cbm, package_weight, price_usd_fob, description
        ) VALUES (
          'TEST Product B2', 'skincare', 'registered', $1, $2, 'TEST-LET-B2', 'active', 20, 0.08, 1.5, 5.00,
          'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
        ) RETURNING id
      `, [companyId, brandId]);
    }
    products.push(p2.rows[0].id);

    // Prod B3 (CBM=0.03, WEIGHT=2.0)
    let p3 = await client.query("SELECT id FROM public.products WHERE letusto_sku = 'TEST-LET-B3'");
    if (p3.rows.length === 0) {
      p3 = await client.query(`
        INSERT INTO public.products (
          name, category, status, company_id, brand_id, letusto_sku, trading_status, carton_pack_qty, carton_cbm, package_weight, price_usd_fob, description
        ) VALUES (
          'TEST Product B3', 'skincare', 'registered', $1, $2, 'TEST-LET-B3', 'active', 5, 0.03, 2.0, 20.00,
          'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
        ) RETURNING id
      `, [companyId, brandId]);
    }
    products.push(p3.rows[0].id);

    // 3 POs, Shipments & Receivings
    const recLineIds = [];
    const poLineIds = [];
    const shipIds = [];
    const poIds = [];

    // B1: Qty=100, cost=10.00
    const poB1 = await client.query("INSERT INTO public.purchase_orders (po_number, supplier_id, order_date, po_status, fulfillment_status, currency, destination_warehouse_id, internal_note) VALUES ('TEST-PO-B1', $1, CURRENT_DATE, 'APPROVED', 'RECEIVED', 'USD', $2, 'CONTROLLED TEST') RETURNING id", [suppliers[0], warehouseId]);
    const polB1 = await client.query("INSERT INTO public.purchase_order_lines (purchase_order_id, product_id, product_name_snapshot, letusto_sku_snapshot, qty, unit_cost) VALUES ($1, $2, 'TEST Product B1', 'TEST-LET-B1', 100, 10.00) RETURNING id", [poB1.rows[0].id, products[0]]);
    const shB1 = await client.query("INSERT INTO public.inbound_shipments (shipment_number, purchase_order_id, status, shipping_method, destination_warehouse_id, internal_note) VALUES ('TEST-SH-B1', $1, 'RECEIVED', 'Ocean', $2, 'CONTROLLED TEST') RETURNING id", [poB1.rows[0].id, warehouseId]);
    const shlB1 = await client.query("INSERT INTO public.inbound_shipment_lines (inbound_shipment_id, purchase_order_line_id, product_id, shipped_qty) VALUES ($1, $2, $3, 100) RETURNING id", [shB1.rows[0].id, polB1.rows[0].id, products[0]]);
    const rcB1 = await client.query("INSERT INTO public.receivings (receiving_number, inbound_shipment_id, purchase_order_id, warehouse_id, status, received_date, internal_note) VALUES ('TEST-REC-B1', $1, $2, $3, 'FINALIZED', CURRENT_DATE, 'CONTROLLED TEST') RETURNING id", [shB1.rows[0].id, poB1.rows[0].id, warehouseId]);
    const rclB1 = await client.query("INSERT INTO public.receiving_lines (receiving_id, inbound_shipment_line_id, purchase_order_line_id, product_id, received_qty, hold_qty, damaged_qty) VALUES ($1, $2, $3, $4, 100, 0, 0) RETURNING id", [rcB1.rows[0].id, shlB1.rows[0].id, polB1.rows[0].id, products[0]]);
    recLineIds.push(rclB1.rows[0].id);
    poLineIds.push(polB1.rows[0].id);
    shipIds.push(shB1.rows[0].id);
    poIds.push(poB1.rows[0].id);

    // B2: Qty=200, cost=5.00
    const poB2 = await client.query("INSERT INTO public.purchase_orders (po_number, supplier_id, order_date, po_status, fulfillment_status, currency, destination_warehouse_id, internal_note) VALUES ('TEST-PO-B2', $1, CURRENT_DATE, 'APPROVED', 'RECEIVED', 'USD', $2, 'CONTROLLED TEST') RETURNING id", [suppliers[1], warehouseId]);
    const polB2 = await client.query("INSERT INTO public.purchase_order_lines (purchase_order_id, product_id, product_name_snapshot, letusto_sku_snapshot, qty, unit_cost) VALUES ($1, $2, 'TEST Product B2', 'TEST-LET-B2', 200, 5.00) RETURNING id", [poB2.rows[0].id, products[1]]);
    const shB2 = await client.query("INSERT INTO public.inbound_shipments (shipment_number, purchase_order_id, status, shipping_method, destination_warehouse_id, internal_note) VALUES ('TEST-SH-B2', $1, 'RECEIVED', 'Ocean', $2, 'CONTROLLED TEST') RETURNING id", [poB2.rows[0].id, warehouseId]);
    const shlB2 = await client.query("INSERT INTO public.inbound_shipment_lines (inbound_shipment_id, purchase_order_line_id, product_id, shipped_qty) VALUES ($1, $2, $3, 200) RETURNING id", [shB2.rows[0].id, polB2.rows[0].id, products[1]]);
    const rcB2 = await client.query("INSERT INTO public.receivings (receiving_number, inbound_shipment_id, purchase_order_id, warehouse_id, status, received_date, internal_note) VALUES ('TEST-REC-B2', $1, $2, $3, 'FINALIZED', CURRENT_DATE, 'CONTROLLED TEST') RETURNING id", [shB2.rows[0].id, poB2.rows[0].id, warehouseId]);
    const rclB2 = await client.query("INSERT INTO public.receiving_lines (receiving_id, inbound_shipment_line_id, purchase_order_line_id, product_id, received_qty, hold_qty, damaged_qty) VALUES ($1, $2, $3, $4, 200, 0, 0) RETURNING id", [rcB2.rows[0].id, shlB2.rows[0].id, polB2.rows[0].id, products[1]]);
    recLineIds.push(rclB2.rows[0].id);
    poLineIds.push(polB2.rows[0].id);
    shipIds.push(shB2.rows[0].id);
    poIds.push(poB2.rows[0].id);

    // B3: Qty=150, cost=20.00
    const poB3 = await client.query("INSERT INTO public.purchase_orders (po_number, supplier_id, order_date, po_status, fulfillment_status, currency, destination_warehouse_id, internal_note) VALUES ('TEST-PO-B3', $1, CURRENT_DATE, 'APPROVED', 'RECEIVED', 'USD', $2, 'CONTROLLED TEST') RETURNING id", [suppliers[2], warehouseId]);
    const polB3 = await client.query("INSERT INTO public.purchase_order_lines (purchase_order_id, product_id, product_name_snapshot, letusto_sku_snapshot, qty, unit_cost) VALUES ($1, $2, 'TEST Product B3', 'TEST-LET-B3', 150, 20.00) RETURNING id", [poB3.rows[0].id, products[2]]);
    const shB3 = await client.query("INSERT INTO public.inbound_shipments (shipment_number, purchase_order_id, status, shipping_method, destination_warehouse_id, internal_note) VALUES ('TEST-SH-B3', $1, 'RECEIVED', 'Ocean', $2, 'CONTROLLED TEST') RETURNING id", [poB3.rows[0].id, warehouseId]);
    const shlB3 = await client.query("INSERT INTO public.inbound_shipment_lines (inbound_shipment_id, purchase_order_line_id, product_id, shipped_qty) VALUES ($1, $2, $3, 150) RETURNING id", [shB3.rows[0].id, polB3.rows[0].id, products[2]]);
    const rcB3 = await client.query("INSERT INTO public.receivings (receiving_number, inbound_shipment_id, purchase_order_id, warehouse_id, status, received_date, internal_note) VALUES ('TEST-REC-B3', $1, $2, $3, 'FINALIZED', CURRENT_DATE, 'CONTROLLED TEST') RETURNING id", [shB3.rows[0].id, poB3.rows[0].id, warehouseId]);
    const rclB3 = await client.query("INSERT INTO public.receiving_lines (receiving_id, inbound_shipment_line_id, purchase_order_line_id, product_id, received_qty, hold_qty, damaged_qty) VALUES ($1, $2, $3, $4, 150, 0, 0) RETURNING id", [rcB3.rows[0].id, shlB3.rows[0].id, polB3.rows[0].id, products[2]]);
    recLineIds.push(rclB3.rows[0].id);
    poLineIds.push(polB3.rows[0].id);
    shipIds.push(shB3.rows[0].id);
    poIds.push(poB3.rows[0].id);

    // Update balances for B1, B2, B3
    await client.query("INSERT INTO public.inventory_balances (product_id, warehouse_id, qty_on_hand, qty_hold) VALUES ($1, $2, 100, 0) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand", [products[0], warehouseId]);
    await client.query("INSERT INTO public.inventory_balances (product_id, warehouse_id, qty_on_hand, qty_hold) VALUES ($1, $2, 200, 0) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand", [products[1], warehouseId]);
    await client.query("INSERT INTO public.inventory_balances (product_id, warehouse_id, qty_on_hand, qty_hold) VALUES ($1, $2, 150, 0) ON CONFLICT (product_id, warehouse_id) DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand", [products[2], warehouseId]);

    // 3 Invoices
    const invB1 = await client.query("INSERT INTO public.supplier_invoices (supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date, subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, internal_note) VALUES ($1, $2, 'TEST-AP-B1', 'TEST-INV-B1', CURRENT_DATE, CURRENT_DATE + 30, 1000.00, 0.00, 0.00, 1000.00, 0.00, 1000.00, 'APPROVED', 'UNPAID', 'CONTROLLED TEST') RETURNING id", [suppliers[0], poIds[0]]);
    await client.query("INSERT INTO public.supplier_invoice_lines (supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount) VALUES ($1, $2, $3, 'TEST-LET-B1', 'TEST Product B1', 100, 10.00, 1000.00)", [invB1.rows[0].id, poLineIds[0], products[0]]);

    const invB2 = await client.query("INSERT INTO public.supplier_invoices (supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date, subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, internal_note) VALUES ($1, $2, 'TEST-AP-B2', 'TEST-INV-B2', CURRENT_DATE, CURRENT_DATE + 30, 1000.00, 0.00, 0.00, 1000.00, 0.00, 1000.00, 'APPROVED', 'UNPAID', 'CONTROLLED TEST') RETURNING id", [suppliers[1], poIds[1]]);
    await client.query("INSERT INTO public.supplier_invoice_lines (supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount) VALUES ($1, $2, $3, 'TEST-LET-B2', 'TEST Product B2', 200, 5.00, 1000.00)", [invB2.rows[0].id, poLineIds[1], products[1]]);

    const invB3 = await client.query("INSERT INTO public.supplier_invoices (supplier_company_id, purchase_order_id, internal_ap_number, supplier_invoice_number, invoice_date, due_date, subtotal, tax_amount, other_charges, invoice_total, amount_paid, balance_due, invoice_status, payment_status, internal_note) VALUES ($1, $2, 'TEST-AP-B3', 'TEST-INV-B3', CURRENT_DATE, CURRENT_DATE + 30, 3000.00, 0.00, 0.00, 3000.00, 0.00, 3000.00, 'APPROVED', 'UNPAID', 'CONTROLLED TEST') RETURNING id", [suppliers[2], poIds[2]]);
    await client.query("INSERT INTO public.supplier_invoice_lines (supplier_invoice_id, purchase_order_line_id, product_id, sku_snapshot, product_name_snapshot, invoiced_qty, unit_price, line_amount) VALUES ($1, $2, $3, 'TEST-LET-B3', 'TEST Product B3', 150, 20.00, 3000.00)", [invB3.rows[0].id, poLineIds[2], products[2]]);

    // Landed Cost Case B
    const caseBRes = await client.query(`
      INSERT INTO public.landed_cost_cases (
        landed_cost_number, status, description, internal_note
      ) VALUES (
        'TEST-LC-B', 'FINALIZED', 'Consolidated Test Case B',
        'CONTROLLED PRODUCTION TEST DATA. DO NOT USE FOR REAL TRANSACTIONS.'
      ) RETURNING id
    `);
    const caseBId = caseBRes.rows[0].id;

    for (const shId of shipIds) {
      await client.query("INSERT INTO public.landed_cost_case_shipments (landed_cost_case_id, inbound_shipment_id) VALUES ($1, $2)", [caseBId, shId]);
    }

    // Insert Expenses & Allocations for B
    // Ocean Freight ($1,000) by CBM
    const expB1 = await client.query("INSERT INTO public.landed_cost_expenses (landed_cost_case_id, cost_type, currency, base_currency_amount, fx_rate_to_base, allocation_method, estimated_amount, actual_amount) VALUES ($1, 'OCEAN_FREIGHT', 'USD', 1000.00, 1.0, 'CBM', 1000.00, 1000.00) RETURNING id", [caseBId]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 227.27)", [expB1.rows[0].id, recLineIds[0]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 363.64)", [expB1.rows[0].id, recLineIds[1]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 409.09)", [expB1.rows[0].id, recLineIds[2]]);

    // Trucking ($500) by WEIGHT
    const expB2 = await client.query("INSERT INTO public.landed_cost_expenses (landed_cost_case_id, cost_type, currency, base_currency_amount, fx_rate_to_base, allocation_method, estimated_amount, actual_amount) VALUES ($1, 'TRUCKING', 'USD', 500.00, 1.0, 'WEIGHT', 500.00, 500.00) RETURNING id", [caseBId]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 71.43)", [expB2.rows[0].id, recLineIds[0]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 214.29)", [expB2.rows[0].id, recLineIds[1]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 214.28)", [expB2.rows[0].id, recLineIds[2]]);

    // Broker Fee ($300) by VALUE
    const expB3 = await client.query("INSERT INTO public.landed_cost_expenses (landed_cost_case_id, cost_type, currency, base_currency_amount, fx_rate_to_base, allocation_method, estimated_amount, actual_amount) VALUES ($1, 'CUSTOMS_BROKER', 'USD', 300.00, 1.0, 'VALUE', 300.00, 300.00) RETURNING id", [caseBId]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 37.99)", [expB3.rows[0].id, recLineIds[0]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 65.50)", [expB3.rows[0].id, recLineIds[1]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 196.51)", [expB3.rows[0].id, recLineIds[2]]);

    // Duty ($150) by DIRECT (to B1)
    const expB4 = await client.query("INSERT INTO public.landed_cost_expenses (landed_cost_case_id, cost_type, currency, base_currency_amount, fx_rate_to_base, allocation_method, estimated_amount, actual_amount) VALUES ($1, 'DUTY', 'USD', 150.00, 1.0, 'DIRECT', 150.00, 150.00) RETURNING id", [caseBId]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 150.00)", [expB4.rows[0].id, recLineIds[0]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 0.00)", [expB4.rows[0].id, recLineIds[1]]);
    await client.query("INSERT INTO public.landed_cost_allocations (landed_cost_expense_id, receiving_line_id, allocated_amount) VALUES ($1, $2, 0.00)", [expB4.rows[0].id, recLineIds[2]]);

    // Landed Cost Results & FIFO Layers for B
    // B1: acquisition=1000, freight=227.27, duty=150.00, broker=37.99, trucking=71.43. Total=1486.69. Unit=14.8669.
    const resB1 = await client.query(`
      INSERT INTO public.landed_cost_results (
        landed_cost_case_id, receiving_line_id, product_id, received_date, inventory_received_qty,
        supplier_acquisition_cost, freight_cost, duty_cost, broker_cost, port_cost, trucking_cost,
        insurance_cost, inspection_cost, other_cost, total_ancillary_cost, total_landed_cost, unit_landed_cost, cost_status
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, 100,
        1000.00, 227.27, 150.00, 37.99, 0.00, 71.43, 0.00, 0.00, 0.00, 486.69, 1486.69, 14.8669, 'FINAL'
      ) RETURNING id
    `, [caseBId, recLineIds[0], products[0]]);
    await client.query(`
      INSERT INTO public.inventory_cost_layers (
        product_id, warehouse_id, receiving_line_id, landed_cost_result_id, received_date, original_qty, remaining_qty, unit_landed_cost, original_total_cost, status
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, 100, 100, 14.8669, 1486.69, 'ACTIVE'
      )
    `, [products[0], warehouseId, recLineIds[0], resB1.rows[0].id]);

    // B2: acquisition=1000, freight=363.64, duty=0, broker=65.50, trucking=214.29. Total=1643.43. Unit=8.2172.
    const resB2 = await client.query(`
      INSERT INTO public.landed_cost_results (
        landed_cost_case_id, receiving_line_id, product_id, received_date, inventory_received_qty,
        supplier_acquisition_cost, freight_cost, duty_cost, broker_cost, port_cost, trucking_cost,
        insurance_cost, inspection_cost, other_cost, total_ancillary_cost, total_landed_cost, unit_landed_cost, cost_status
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, 200,
        1000.00, 363.64, 0.00, 65.50, 0.00, 214.29, 0.00, 0.00, 0.00, 643.43, 1643.43, 8.2172, 'FINAL'
      ) RETURNING id
    `, [caseBId, recLineIds[1], products[1]]);
    await client.query(`
      INSERT INTO public.inventory_cost_layers (
        product_id, warehouse_id, receiving_line_id, landed_cost_result_id, received_date, original_qty, remaining_qty, unit_landed_cost, original_total_cost, status
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, 200, 200, 8.2172, 1643.43, 'ACTIVE'
      )
    `, [products[1], warehouseId, recLineIds[1], resB2.rows[0].id]);

    // B3: acquisition=3000, freight=409.09, duty=0, broker=196.51, trucking=214.28. Total=3819.88. Unit=25.4659.
    const resB3 = await client.query(`
      INSERT INTO public.landed_cost_results (
        landed_cost_case_id, receiving_line_id, product_id, received_date, inventory_received_qty,
        supplier_acquisition_cost, freight_cost, duty_cost, broker_cost, port_cost, trucking_cost,
        insurance_cost, inspection_cost, other_cost, total_ancillary_cost, total_landed_cost, unit_landed_cost, cost_status
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, 150,
        3000.00, 409.09, 0.00, 196.51, 0.00, 214.28, 0.00, 0.00, 0.00, 819.88, 3819.88, 25.4659, 'FINAL'
      ) RETURNING id
    `, [caseBId, recLineIds[2], products[2]]);
    await client.query(`
      INSERT INTO public.inventory_cost_layers (
        product_id, warehouse_id, receiving_line_id, landed_cost_result_id, received_date, original_qty, remaining_qty, unit_landed_cost, original_total_cost, status
      ) VALUES (
        $1, $2, $3, $4, CURRENT_DATE, 150, 150, 25.4659, 3819.88, 'ACTIVE'
      )
    `, [products[2], warehouseId, recLineIds[2], resB3.rows[0].id]);

    console.log("Dataset B setup finished successfully.");

    console.log("\n==========================================");
    console.log("🎉 FINANCE E2E CONTROLLED TEST DATA GENERATED!");
    console.log("==========================================\n");

  } catch (err) {
    console.error("❌ Generation failed:", err);
  } finally {
    await client.end();
  }
}

run();
