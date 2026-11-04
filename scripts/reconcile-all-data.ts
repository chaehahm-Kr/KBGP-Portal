import * as fs from "fs";

// Load secrets safely from .env.local.production_backup
const envContent = fs.readFileSync(".env.local.production_backup", "utf8");
function getEnv(key: string): string {
  const match = envContent.match(new RegExp(`${key}=["']?([^"'\r\n]+)["']?`));
  return match ? match[1].trim() : "";
}

const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_KEY = getEnv("SUPABASE_SECRET_KEY");
const CAMPAIGN_ID = "cd741964-4c51-431e-bc9e-3c2eb32ddcef";

async function main() {
  console.log("=== COMPREHENSIVE FORENSIC RECONCILIATION ===");

  // 1. Load the 699 approved recipients from our CSV export
  const csvContent = fs.readFileSync("KBGP_Campaign_699_Approved_Recipients.csv", "utf8");
  const csvLines = csvContent.trim().split("\r\n");
  const headers = csvLines[0].split(",");
  const approvedRecipients: any[] = [];

  for (let i = 1; i < csvLines.length; i++) {
    // Simple parse (since emails and ids don't have commas)
    // headers: campaign_id,campaign_recipient_id,company_id,company_name,recipient_email,recipient_name,approval_snapshot_id,recipient_status,sent_at,delivered_at,provider_message_id
    const parts = csvLines[i].split(",");
    approvedRecipients.push({
      campaign_id: parts[0],
      campaign_recipient_id: parts[1],
      company_id: parts[2],
      company_name: parts[3],
      recipient_email: parts[4].trim().toLowerCase(),
      recipient_name: parts[5],
      snapshot_id: parts[6],
      status: parts[7],
    });
  }
  console.log(`Loaded ${approvedRecipients.length} approved recipients from frozen CSV.`);

  // 2. Load Resend emails dump
  const resendEmails: any[] = JSON.parse(fs.readFileSync("scripts/resend_emails_dump.json", "utf8"));
  console.log(`Loaded ${resendEmails.length} total Resend emails.`);

  // Filter for the campaign subject: "[K SELECT] 귀사의 브랜드, 미국 시장에서 실제 판매로 검증해 보세요"
  const targetEmails = resendEmails.filter(
    (e) => e.subject === "[K SELECT] 귀사의 브랜드, 미국 시장에서 실제 판매로 검증해 보세요"
  );
  console.log(`Total Resend emails matching target campaign subject: ${targetEmails.length}`);

  // Partition into Batch (created ~22:00 UTC) vs Broadcast (created ~23:08 UTC)
  const batchEmails: any[] = [];
  const broadcastEmails: any[] = [];
  const otherEmails: any[] = [];

  const batchCutoff = new Date("2026-11-02T22:30:00Z").getTime();
  const broadcastStart = new Date("2026-11-02T22:30:00Z").getTime();

  for (const e of targetEmails) {
    const t = new Date(e.created_at).getTime();
    if (t < batchCutoff) {
      batchEmails.push(e);
    } else {
      broadcastEmails.push(e);
    }
  }

  console.log(`Batch Emails Count (Path A): ${batchEmails.length}`);
  console.log(`Broadcast Emails Count (Path B): ${broadcastEmails.length}`);

  // Check email sets
  const approvedEmailSet = new Set(approvedRecipients.map((r) => r.recipient_email));
  const batchEmailMap = new Map<string, any>();
  const broadcastEmailMap = new Map<string, any>();

  for (const e of batchEmails) {
    const to = Array.isArray(e.to) ? e.to[0].trim().toLowerCase() : String(e.to).trim().toLowerCase();
    batchEmailMap.set(to, e);
  }

  for (const e of broadcastEmails) {
    const to = Array.isArray(e.to) ? e.to[0].trim().toLowerCase() : String(e.to).trim().toLowerCase();
    broadcastEmailMap.set(to, e);
  }

  console.log(`Unique emails in Batch: ${batchEmailMap.size}`);
  console.log(`Unique emails in Broadcast: ${broadcastEmailMap.size}`);

  // 3. Check Overlap between Batch and Broadcast
  const overlapEmails: string[] = [];
  for (const email of batchEmailMap.keys()) {
    if (broadcastEmailMap.has(email)) {
      overlapEmails.push(email);
    }
  }
  console.log(`\nOverlap between Batch and Broadcast: ${overlapEmails.length}`);
  if (overlapEmails.length > 0) {
    console.log("Overlapping emails:", overlapEmails);
  }

  // 4. Combined Unique Reach vs 699 Approved
  const unionEmails = new Set([...batchEmailMap.keys(), ...broadcastEmailMap.keys()]);
  console.log(`Total unique emails reached by either path: ${unionEmails.size}`);

  let approvedInBatch = 0;
  let approvedInBroadcast = 0;
  let approvedInNeither: string[] = [];

  for (const email of approvedEmailSet) {
    const inBatch = batchEmailMap.has(email);
    const inBcast = broadcastEmailMap.has(email);
    if (inBatch) approvedInBatch++;
    if (inBcast) approvedInBroadcast++;
    if (!inBatch && !inBcast) {
      approvedInNeither.push(email);
    }
  }

  console.log(`\nApproved recipients matched in Batch: ${approvedInBatch} / 699`);
  console.log(`Approved recipients matched in Broadcast: ${approvedInBroadcast} / 699`);
  console.log(`Approved recipients NOT reached by either: ${approvedInNeither.length}`);
  if (approvedInNeither.length > 0) {
    console.log("Unreached approved emails:", approvedInNeither);
  }

  // 5. Check if any emails in Resend were outside the approved 699
  const outsideEmails: string[] = [];
  for (const email of unionEmails) {
    if (!approvedEmailSet.has(email)) {
      outsideEmails.push(email);
    }
  }
  console.log(`Resend campaign emails outside the 699 approved list: ${outsideEmails.length}`);
  if (outsideEmails.length > 0) {
    console.log("Outside emails:", outsideEmails);
  }

  // 6. Broadcast Outcomes Deep Dive
  console.log("\n--- BROADCAST OUTCOMES DEEP DIVE ---");
  const bcastStatusCounts: Record<string, number> = {};
  for (const e of broadcastEmails) {
    bcastStatusCounts[e.last_event] = (bcastStatusCounts[e.last_event] || 0) + 1;
  }
  console.log("Broadcast Emails last_event counts from Resend API:", bcastStatusCounts);

  const batchStatusCounts: Record<string, number> = {};
  for (const e of batchEmails) {
    batchStatusCounts[e.last_event] = (batchStatusCounts[e.last_event] || 0) + 1;
  }
  console.log("Batch Emails last_event counts from Resend API:", batchStatusCounts);

  // 7. Inspect Audience Contacts vs 399 Broadcast emails
  const audienceContacts: any[] = JSON.parse(fs.readFileSync("scripts/audience_contacts_dump.json", "utf8"));
  const audienceEmailSet = new Set(audienceContacts.map((c) => c.email.trim().toLowerCase()));
  let bcastMatchesAudience = 0;
  let bcastOutsideAudience = 0;
  for (const email of broadcastEmailMap.keys()) {
    if (audienceEmailSet.has(email)) bcastMatchesAudience++;
    else bcastOutsideAudience++;
  }
  console.log(`Broadcast emails matching audience contacts: ${bcastMatchesAudience} / 399`);
  console.log(`Broadcast emails outside audience contacts: ${bcastOutsideAudience}`);
}

main().catch(console.error);
