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
    console.error("Could not connect to Supabase DB via pg.");
    process.exit(1);
  }

  const migrationSql = fs.readFileSync(
    path.join(__dirname, "../supabase/migrations/0118_agreement_recipient_updated_at.sql"),
    "utf8"
  );

  console.log("Executing migration 0118 SQL...");
  try {
    await client.query(migrationSql);
    console.log("Migration 0118 applied successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
