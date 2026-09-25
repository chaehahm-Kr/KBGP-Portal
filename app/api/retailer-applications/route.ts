import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";

const ALLOWED_ORIGINS = [
  "https://www.kselecthub.com",
  "https://kselecthub.com",
  "https://admin.kselectnetwork.com",
  "https://portal.kselectnetwork.com",
  "https://portal.kselecthub.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      origin.includes("kselecthub") ||
      origin.includes("kselectnetwork"));

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://www.kselecthub.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-requested-with, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

const retailerApiPayloadSchema = z.object({
  companyName: z.string().trim().min(1, "Company Name is required.").or(
    z.string().trim().min(1)
  ),
  contactName: z.string().trim().min(1, "Owner / Contact Name is required."),
  email: z.string().trim().email("Please provide a valid email address."),
  phone: z.string().trim().min(1, "Phone number is required."),
  streetAddress: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  state: z.string().trim().optional().default(""),
  zipCode: z.string().trim().optional().default(""),
  numberOfLocations: z.string().optional().default("1"),
  comments: z.string().optional().default(""),
  recommendedConfig: z.string().optional().default("None"),
  simulatedInvestment: z.string().optional().default("None"),
  simulationId: z.string().optional(),
  readinessAnswers: z
    .array(
      z.object({
        key: z.string(),
        title: z.string(),
        response: z.enum(["ready", "discuss", "available"]),
      })
    )
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  let rawBody: any;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      rawBody = await request.json();
    } else if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await request.formData();
      const rawPayload = formData.get("payload");
      if (rawPayload && typeof rawPayload === "string") {
        rawBody = JSON.parse(rawPayload);
      } else {
        rawBody = Object.fromEntries(formData.entries());
      }
    } else {
      rawBody = await request.json();
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, success: false, error: "Invalid request payload." },
      { status: 400, headers: corsHeaders }
    );
  }

  // Normalize field aliases (e.g., storeName -> companyName, ownerName -> contactName, address -> streetAddress)
  const normalizedInput = {
    companyName: rawBody.companyName || rawBody.storeName || "",
    contactName: rawBody.contactName || rawBody.ownerName || "",
    email: rawBody.email || "",
    phone: rawBody.phone || "",
    streetAddress: rawBody.streetAddress || rawBody.address || "",
    city: rawBody.city || "",
    state: rawBody.state || rawBody.stateVal || "",
    zipCode: rawBody.zipCode || rawBody.zip || "",
    numberOfLocations: rawBody.numberOfLocations || "1",
    comments: rawBody.comments || "",
    recommendedConfig: rawBody.recommendedConfig || "None",
    simulatedInvestment: rawBody.simulatedInvestment || "None",
    simulationId: rawBody.simulationId,
    readinessAnswers: Array.isArray(rawBody.readinessAnswers)
      ? rawBody.readinessAnswers.map((item: any) => ({
          key: String(item.key || item.id || item.num || "question"),
          title: String(item.title || item.titleEn || item.titleKo || "Readiness Item"),
          response: item.response === "available" ? "ready" : item.response === "ready" ? "ready" : "discuss",
        }))
      : [],
  };

  const result = retailerApiPayloadSchema.safeParse(normalizedInput);
  if (!result.success) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: result.error.issues[0]?.message || "Invalid retailer application input.",
      },
      { status: 422, headers: corsHeaders }
    );
  }

  const data = result.data;
  const admin = createAdminClient();

  // Duplicate Check: Protect against immediate accidental resubmissions for same email with pending application
  try {
    const { data: existingApp } = await admin
      .from("applications")
      .select("id, application_number, status, created_at")
      .eq("applicant_contact_email", data.email.toLowerCase().trim())
      .eq("partner_type", "retailer")
      .in("status", ["submitted", "under_review", "assigned"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingApp) {
      return NextResponse.json(
        {
          ok: true,
          success: true,
          isExisting: true,
          applicationNumber: existingApp.application_number,
          applicationId: existingApp.id,
          message: "Application already submitted and currently under review.",
        },
        { headers: corsHeaders }
      );
    }
  } catch (dupErr) {
    console.warn("[POST /api/retailer-applications] Duplicate check non-fatal warning:", dupErr);
  }

  let applicationNumber = `APP-RET-${Date.now().toString().slice(-6)}`;
  try {
    const { data: numberResult } = await admin.rpc("generate_application_number");
    if (numberResult) {
      applicationNumber = numberResult;
    }
  } catch (err) {
    console.warn("[POST /api/retailer-applications] RPC fallback used:", err);
  }

  const fullAddress = {
    street: data.streetAddress,
    city: data.city,
    state: data.state,
    zip: data.zipCode,
    locationsCount: data.numberOfLocations,
  };

  let noteParts: string[] = [];
  if (data.comments) {
    noteParts.push(data.comments);
  }
  if (data.recommendedConfig && data.recommendedConfig !== "None") {
    noteParts.push(`[Simulator Recommendation: ${data.recommendedConfig} | Opening Order approx. $${data.simulatedInvestment}]`);
  }
  const motivationNote = noteParts.join("\n\n") || "Public Retailer Application via www.kselecthub.com";

  const { data: appRow, error: insertErr } = await admin
    .from("applications")
    .insert({
      application_number: applicationNumber,
      partner_type: "retailer",
      entry_mode: "public_application",
      status: "submitted",
      applicant_company_name: data.companyName,
      applicant_contact_name: data.contactName,
      applicant_contact_email: data.email.toLowerCase().trim(),
      applicant_contact_phone: data.phone,
      applicant_address: fullAddress,
      eligibility_responses: data.readinessAnswers,
      self_check_answers: data.readinessAnswers.map((r) => r.response === "ready"),
      motivation_note: motivationNote,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !appRow) {
    console.error("[POST /api/retailer-applications] DB insert error:", insertErr);
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: "Failed to persist retailer application. Please try again.",
      },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    await sendEmail({
      to: data.email.toLowerCase().trim(),
      subject: `[K SELECT HUB] Retailer Application Received - ${applicationNumber}`,
      text: `Hello ${data.contactName},\n\nThank you for applying for partnership with K SELECT HUB.\n\nApplication Number: ${applicationNumber}\nCompany: ${data.companyName}\n\nOur K SELECT team will review your application and contact you regarding next steps.\n\nThank you,\nK SELECT Retail Operations Team`,
    });
  } catch (emailErr) {
    console.warn("[POST /api/retailer-applications] Email notification warning:", emailErr);
  }

  return NextResponse.json(
    {
      ok: true,
      success: true,
      applicationNumber,
      applicationId: appRow.id,
    },
    { headers: corsHeaders }
  );
}
