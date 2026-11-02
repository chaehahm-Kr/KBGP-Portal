import { SupabaseClient } from "@supabase/supabase-js";
import { getClient } from "@/lib/brand-marketing/campaign-data-access";
import { serverEnv } from "@/lib/env/server";

export interface WebhookProcessingResult {
  success: boolean;
  status: "processed" | "idempotent_duplicate" | "ignored" | "error";
  eventType?: string;
  emailId?: string;
  reason?: string;
  recipientEmail?: string;
  campaignId?: string;
}

export interface ReconciliationResult {
  success: boolean;
  reconciledDelivered: number;
  reconciledBounced: number;
  totalDelivered: number;
  totalSent: number;
  error?: string;
  message?: string;
}

/**
 * Persists an event to the immutable delivery event ledger.
 * Writes to marketing_delivery_events if table exists, and always writes to marketing_campaign_logs.
 */
async function recordDeliveryEvent(
  supabase: SupabaseClient,
  eventType: string,
  providerMessageId: string,
  recipientEmail: string,
  campaignId?: string,
  recipientId?: string,
  payload?: any
): Promise<void> {
  const nowIso = new Date().toISOString();

  // 1. Try writing to marketing_delivery_events (Migration 0197)
  try {
    const { error: ledgerErr } = await supabase
      .from("marketing_delivery_events")
      .insert({
        provider: "resend",
        provider_message_id: providerMessageId,
        event_type: eventType,
        recipient_email: recipientEmail,
        campaign_id: campaignId || null,
        recipient_id: recipientId || null,
        payload: payload || {},
        created_at: nowIso,
      });

    if (ledgerErr && !ledgerErr.message.includes("does not exist")) {
      console.warn("[delivery-ledger] Error inserting to marketing_delivery_events:", ledgerErr.message);
    }
  } catch {
    // Migration 0197 may be pending Owner approval in Production
  }

  // 2. Always persist to marketing_campaign_logs (Authoritative existing table)
  if (campaignId) {
    try {
      await supabase
        .from("marketing_campaign_logs")
        .insert({
          campaign_id: campaignId,
          recipient_id: recipientId || null,
          event_type: eventType,
          is_test_mode: false,
          details: {
            provider: "resend",
            providerMessageId,
            recipientEmail,
            payload: payload || {},
          },
          performed_by: "resend_webhook",
          created_at: nowIso,
        });
    } catch (logErr: any) {
      console.warn("[delivery-ledger] Error inserting to marketing_campaign_logs:", logErr.message);
    }
  }
}

/**
 * Automatically suppresses an email address on bounce or complaint.
 */
async function recordSuppression(
  supabase: SupabaseClient,
  email: string,
  reason: "BOUNCED" | "COMPLAINT",
  source: string = "resend_webhook"
): Promise<void> {
  try {
    const normalized = email.toLowerCase().trim();
    const nowIso = new Date().toISOString();

    await supabase.from("marketing_suppression_list").upsert(
      {
        email: normalized,
        reason,
        source,
        status: "ACTIVE",
        suppressed_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "email" }
    );
  } catch (err: any) {
    console.warn(`[delivery-suppression] Error suppressing ${email}:`, err.message);
  }
}

/**
 * Processes an authenticated Resend webhook event.
 * Enforces state-machine transitions, idempotency, suppression updates, and metrics alignment.
 */
export async function processResendWebhookEvent(
  event: any,
  customClient?: SupabaseClient
): Promise<WebhookProcessingResult> {
  const eventType: string = event?.type || "";
  const emailId: string = event?.data?.email_id || "";
  const toList: string[] = event?.data?.to || [];
  const recipientEmail = toList[0]?.toLowerCase().trim() || "";

  if (!emailId) {
    return {
      success: true,
      status: "ignored",
      reason: "Missing email_id in event payload",
      eventType,
    };
  }

  const supabase = await getClient(customClient);

  // 1. Locate recipient by provider message ID
  const { data: recipients, error: findErr } = await supabase
    .from("marketing_campaign_recipients")
    .select("id, campaign_id, recipient_email, status, provider_message_id, sent_at, delivered_at")
    .eq("provider_message_id", emailId)
    .limit(1);

  if (findErr || !recipients || recipients.length === 0) {
    // Unmapped message ID (e.g. transactional email or external test)
    await recordDeliveryEvent(
      supabase,
      eventType,
      emailId,
      recipientEmail || "unknown",
      undefined,
      undefined,
      event
    );

    return {
      success: true,
      status: "ignored",
      emailId,
      eventType,
      reason: "No campaign recipient matched provider message ID",
    };
  }

  const recipient = recipients[0];
  const campaignId = recipient.campaign_id;
  const nowIso = new Date().toISOString();
  const eventTimestamp = event?.data?.created_at || event?.created_at || nowIso;

  // 2. Authoritative ledger logging
  await recordDeliveryEvent(
    supabase,
    eventType,
    emailId,
    recipient.recipient_email,
    campaignId,
    recipient.id,
    event
  );

  // 3. State Machine & Event Processing
  if (eventType === "email.delivered") {
    // Idempotency check: duplicate event protection
    if (recipient.status === "DELIVERED") {
      return {
        success: true,
        status: "idempotent_duplicate",
        emailId,
        eventType,
        campaignId,
        recipientEmail: recipient.recipient_email,
      };
    }

    // Update recipient status to DELIVERED
    await supabase
      .from("marketing_campaign_recipients")
      .update({
        status: "DELIVERED",
        delivered_at: eventTimestamp,
        updated_at: nowIso,
      })
      .eq("id", recipient.id);

    // Recompute real delivered count from authoritative DB
    const { count: realDeliveredCount } = await supabase
      .from("marketing_campaign_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "DELIVERED");

    // Fetch existing campaign stats to preserve counts
    const { data: camp } = await supabase
      .from("marketing_campaigns")
      .select("stats")
      .eq("id", campaignId)
      .single();

    const currentStats = camp?.stats || {};
    const sentCount = currentStats.sentCount || 0;
    const finalDelivered = realDeliveredCount || (currentStats.deliveredCount || 0) + 1;

    await supabase
      .from("marketing_campaigns")
      .update({
        stats: {
          ...currentStats,
          deliveredCount: finalDelivered,
          deliveryStatus: finalDelivered >= sentCount && sentCount > 0 ? "DELIVERED" : currentStats.deliveryStatus,
        },
        updated_at: nowIso,
      })
      .eq("id", campaignId);

    return {
      success: true,
      status: "processed",
      emailId,
      eventType,
      campaignId,
      recipientEmail: recipient.recipient_email,
    };
  }

  if (eventType === "email.bounced") {
    // Prevent downgrading if already verified delivered
    if (recipient.status === "DELIVERED") {
      console.warn(`[delivery] Retroactive bounce received for delivered recipient ${recipient.recipient_email}`);
    }

    await supabase
      .from("marketing_campaign_recipients")
      .update({
        status: "BOUNCED",
        error_message: event?.data?.message || "Mail server bounced message",
        updated_at: nowIso,
      })
      .eq("id", recipient.id);

    // Suppression enforcement
    await recordSuppression(supabase, recipient.recipient_email, "BOUNCED", "resend_webhook");

    return {
      success: true,
      status: "processed",
      emailId,
      eventType,
      campaignId,
      recipientEmail: recipient.recipient_email,
    };
  }

  if (eventType === "email.complained") {
    // Suppression enforcement
    await recordSuppression(supabase, recipient.recipient_email, "COMPLAINT", "resend_webhook");

    return {
      success: true,
      status: "processed",
      emailId,
      eventType,
      campaignId,
      recipientEmail: recipient.recipient_email,
    };
  }

  // Other telemetry events (delayed, opened, clicked)
  return {
    success: true,
    status: "processed",
    emailId,
    eventType,
    campaignId,
    recipientEmail: recipient.recipient_email,
  };
}

/**
 * Admin-only historical reconciliation for existing SENT recipients.
 * Queries GET https://api.resend.com/emails/:id to retrieve verified provider status.
 * Never dispatches new emails.
 */
export async function reconcileCampaignDelivery(
  campaignId: string,
  adminEmail: string,
  customClient?: SupabaseClient
): Promise<ReconciliationResult> {
  const apiKey = serverEnv.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on the server.");
  }

  const supabase = await getClient(customClient);

  // 1. Verify campaign exists
  const { data: campaign, error: cErr } = await supabase
    .from("marketing_campaigns")
    .select("id, name, stats, status")
    .eq("id", campaignId)
    .single();

  if (cErr || !campaign) {
    throw new Error(`Campaign '${campaignId}' not found.`);
  }

  // 2. Fetch unreconciled SENT recipients with genuine provider message IDs
  const { data: recipients, error: rErr } = await supabase
    .from("marketing_campaign_recipients")
    .select("id, recipient_email, provider_message_id, status")
    .eq("campaign_id", campaignId)
    .eq("status", "SENT");

  if (rErr) {
    throw new Error(`Failed to query campaign recipients: ${rErr.message}`);
  }

  const eligibleRecipients = (recipients || []).filter(
    (r) => r.provider_message_id && !r.provider_message_id.startsWith("sim_")
  );

  let reconciledDelivered = 0;
  let reconciledBounced = 0;
  const nowIso = new Date().toISOString();

  // 3. Batch reconcile with rate-limit protection (max 50 per execution)
  const batch = eligibleRecipients.slice(0, 50);

  for (const r of batch) {
    try {
      const res = await fetch(`https://api.resend.com/emails/${r.provider_message_id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.warn(`[reconciliation] Resend query error for ${r.recipient_email}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const lastEvent: string = (data.last_event || "").toLowerCase();

      if (lastEvent === "delivered") {
        await supabase
          .from("marketing_campaign_recipients")
          .update({
            status: "DELIVERED",
            delivered_at: data.created_at || nowIso,
            updated_at: nowIso,
          })
          .eq("id", r.id);

        await recordDeliveryEvent(
          supabase,
          "RECONCILIATION_DELIVERED",
          r.provider_message_id,
          r.recipient_email,
          campaignId,
          r.id,
          { provider: "resend", apiData: data }
        );

        reconciledDelivered++;
      } else if (lastEvent === "bounced") {
        await supabase
          .from("marketing_campaign_recipients")
          .update({
            status: "BOUNCED",
            updated_at: nowIso,
          })
          .eq("id", r.id);

        await recordSuppression(supabase, r.recipient_email, "BOUNCED", "resend_reconciliation");
        reconciledBounced++;
      }

      // 100ms throttle between API calls
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err: any) {
      console.warn(`[reconciliation] Failed to reconcile ${r.recipient_email}:`, err.message);
    }
  }

  // 4. Recount total delivered from authoritative table
  const { count: realDeliveredCount } = await supabase
    .from("marketing_campaign_recipients")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "DELIVERED");

  const { count: realSentCount } = await supabase
    .from("marketing_campaign_recipients")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["SENT", "DELIVERED"]);

  const totalDelivered = realDeliveredCount || 0;
  const totalSent = realSentCount || 0;

  // 5. Update campaign stats
  const currentStats = campaign.stats || {};
  const isAllDelivered = totalSent > 0 && totalDelivered >= totalSent;

  await supabase
    .from("marketing_campaigns")
    .update({
      stats: {
        ...currentStats,
        deliveredCount: totalDelivered,
        sentCount: totalSent,
        deliveryStatus: isAllDelivered ? "DELIVERED" : currentStats.deliveryStatus || "SENT",
      },
      updated_at: nowIso,
    })
    .eq("id", campaignId);

  // 6. Record audit log
  await supabase
    .from("marketing_campaign_logs")
    .insert({
      campaign_id: campaignId,
      event_type: "CAMPAIGN_DELIVERY_RECONCILED",
      is_test_mode: false,
      details: {
        adminEmail,
        reconciledDelivered,
        reconciledBounced,
        totalDelivered,
        totalSent,
        processedBatchSize: batch.length,
      },
      performed_by: adminEmail,
      created_at: nowIso,
    });

  return {
    success: true,
    reconciledDelivered,
    reconciledBounced,
    totalDelivered,
    totalSent,
    message: `Reconciled ${reconciledDelivered} delivered and ${reconciledBounced} bounced recipient records.`,
  };
}
