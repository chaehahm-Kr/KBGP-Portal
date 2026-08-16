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

    const skus = ['TST-LET-TOL-003', 'TST-LET-HAR-004', 'LET-A123-50M', 'TST-LET-SKN-001'];
    
    console.log("Cleaning up legacy opening cost layers...");
    const res = await client.query(`
      DELETE FROM public.inventory_cost_layers 
      WHERE product_id IN (SELECT id FROM public.products WHERE letusto_sku = ANY($1))
        AND landed_cost_result_id IS NULL 
        AND receiving_line_id IS NULL
    `, [skus]);
    
    console.log(`Deleted ${res.rowCount} legacy opening cost layers.`);

  } catch (err) {
    console.error("❌ Cleanup failed:", err);
  } finally {
    await client.end();
  }
}

run();
