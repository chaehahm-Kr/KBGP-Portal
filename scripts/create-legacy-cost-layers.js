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

    const legacySKUs = [
      { sku: 'TST-LET-TOL-003', cost: 5.50 },
      { sku: 'TST-LET-HAR-004', cost: 4.60 },
      { sku: 'LET-A123-50M', cost: 3.50 },
      { sku: 'TST-LET-SKN-001', cost: 4.20 }
    ];

    let totalQtyMigrated = 0;

    for (const item of legacySKUs) {
      console.log(`\nProcessing legacy SKU: ${item.sku}...`);
      // Fetch product ID
      const prodRes = await client.query("SELECT id FROM public.products WHERE letusto_sku = $1", [item.sku]);
      if (prodRes.rows.length === 0) {
        console.log(`Product with SKU ${item.sku} not found!`);
        continue;
      }
      const productId = prodRes.rows[0].id;

      // Fetch active inventory balances for this product
      const balRes = await client.query(`
        SELECT ib.warehouse_id, ib.qty_on_hand, w.name as warehouse_name 
        FROM public.inventory_balances ib
        JOIN public.warehouses w ON ib.warehouse_id = w.id
        WHERE ib.product_id = $1 AND ib.qty_on_hand > 0
      `, [productId]);

      for (const bal of balRes.rows) {
        const warehouseId = bal.warehouse_id;
        const qty = Number(bal.qty_on_hand);
        console.log(`   Found physical balance of ${qty} units in warehouse: ${bal.warehouse_name}`);

        // Check if active layer already exists
        const existRes = await client.query(`
          SELECT id FROM public.inventory_cost_layers 
          WHERE product_id = $1 AND warehouse_id = $2 AND status = 'ACTIVE'
        `, [productId, warehouseId]);

        if (existRes.rows.length > 0) {
          console.log(`   [SKIP] Active cost layer already exists for ${item.sku} in ${bal.warehouse_name}`);
          continue;
        }

        // Create Cost Layer directly with NULL receiving_line_id and landed_cost_result_id
        const totalCost = qty * item.cost;
        await client.query(`
          INSERT INTO public.inventory_cost_layers (
            product_id, warehouse_id, receiving_line_id, landed_cost_result_id, received_date, original_qty, remaining_qty, unit_landed_cost, original_total_cost, status
          ) VALUES (
            $1, $2, NULL, NULL, CURRENT_DATE, $3, $3, $4, $5, 'ACTIVE'
          )
        `, [productId, warehouseId, qty, item.cost, totalCost]);

        console.log(`   [CREATED] Traceable cost layer of ${qty} units @ $${item.cost} created successfully.`);
        totalQtyMigrated += qty;
      }
    }

    console.log(`\nLegacy migration finished. Total quantity migrated: ${totalQtyMigrated}`);

  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
