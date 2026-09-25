import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

export const runtime = "nodejs";

const retailerApiPayloadSchema = z.object({
  companyName: z.string().trim().min(1, "Company Name is required."),
  contactName: z.string().trim().min(1, "Owner / Contact Name is required."),
  email: z.string().trim().email("Please provide a valid email address."),
  phone: z.string().trim().min(1, "Phone number is required."),
  streetAddress: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  state: z.string().trim().optional().default(""),
  zipCode: z.string().trim().optional().default(""),
  numberOfLocations: z.string().optional().default("1"),
  comments: z.string().optional().default(""),
  readinessAnswers: z
    .array(
      z.object({
        key: z.string(),
        title: z.string(),
        response: z.enum(["ready", "discuss"]),
      })
    )
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  let body: any;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      const rawPayload = formData.get("payload");
      if (rawPayload && typeof rawPayload === "string") {
        body = JSON.parse(rawPayload);
      } else {
        body = Object.fromEntries(formData.entries());
      }
    } else {
      body = await request.json();
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, success: false, error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const result = retailerApiPayloadSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      {
        ok: false,
        success: false,
        error: result.error.issues[0]?.message || "Invalid retailer application input.",
      },
      { status: 422 }
    );
  }

  const data = result.data;
  const admin = createAdminClient();

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
      motivation_note: data.comments || "Public Retailer Application via K SELECT HUB",
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
      { status: 500 }
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

  return NextResponse.json({
    ok: true,
    success: true,
    applicationNumber,
    applicationId: appRow.id,
  });
}
