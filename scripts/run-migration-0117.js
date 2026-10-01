const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function run() {
  const ports = [6543, 5432];
  const hosts = [
    "aws-1-us-west-2.pooler.supabase.com",
    "db.shzfrppdobpmrstcjfqu.supabase.co"
  ];

  let client = null;
  let connected = false;

  for (const host of hosts) {
    for (const port of ports) {
      console.log(`Trying host=${host}, port=${port}...`);
      client = new Client({
        host,
        port,
        database: "postgres",
        user: "postgres.shzfrppdobpmrstcjfqu",
        password: "Extreme702$$##",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });

      try {
        await client.connect();
        connected = true;
        console.log(`Connected successfully to ${host}:${port}!`);
        break;
      } catch (err) {
        console.log(`Failed to connect to ${host}:${port}:`, err.message);
        await client.end().catch(() => {});
      }
    }
    if (connected) break;
  }

  if (!connected) {
    console.error("Could not connect via pg client.");
    return;
  }

  try {
    const sqlPath = path.join(__dirname, "../supabase/migrations/0117_impersonation_audit_logs.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Applying Migration 0117...");
    await client.query(sql);
    console.log("Migration 0117 Applied Successfully!");

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'impersonation_audit_logs'
    `);
    console.log("Verified impersonation_audit_logs table in Production DB:", res.rows);

  } catch (err) {
    console.error("Migration Execution Error:", err);
  } finally {
    await client.end().catch(() => {});
  }
}

run();
