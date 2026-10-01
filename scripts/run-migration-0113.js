const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
    console.log("Connected to Production Supabase DB!");

    const sqlPath = path.join(__dirname, '../supabase/migrations/0113_brand_agreement_system.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Applying Migration 0113...");
    await client.query(sql);
    console.log("Migration 0113 Applied Successfully!");

    // Verify table existence & seeded template
    const res = await client.query(`
      SELECT id, name, version, status, source_pdf_path 
      FROM public.agreement_templates 
      WHERE version = '1.0'
    `);
    console.log("Seeded Agreement Template:", res.rows);

  } catch (err) {
    console.error("Migration Error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
