"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";

const retailerApplicationSchema = z.object({
  companyName: z.string().trim().min(1, "Company Name is required."),
  contactName: z.string().trim().min(1, "Owner / Contact Name is required."),
  email: z.string().trim().email("Please provide a valid email address."),
  phone: z.string().trim().min(1, "Phone number is required."),
  streetAddress: z.string().trim().min(1, "Street Address is required."),
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(1, "State is required."),
  zipCode: z.string().trim().min(1, "ZIP Code is required."),
  numberOfLocations: z.string().optional().default("1"),
  comments: z.string().optional().default(""),
  consentChecked: z.boolean().refine((val) => val === true, "Consent is required."),
  readinessAnswers: z.array(z.object({
    key: z.string(),
    title: z.string(),
    response: z.enum(["ready", "discuss"]),
  })).optional().default([]),
});

export type RetailerApplicationInput = z.infer<typeof retailerApplicationSchema>;

export async function submitPublicRetailerApplication(input: RetailerApplicationInput): Promise<{
  success: boolean;
  error?: string;
  applicationNumber?: string;
}> {
  const parsed = retailerApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid application input.",
    };
  }

  const data = parsed.data;
  const admin = createAdminClient();

  // 1. Generate Application Number
  const { data: numberResult } = await admin.rpc("generate_application_number");
  const applicationNumber = numberResult || `APP-RET-${Date.now().toString().slice(-6)}`;

  const fullAddress = {
    street: data.streetAddress,
    city: data.city,
    state: data.state,
    zip: data.zipCode,
    locationsCount: data.numberOfLocations,
  };

  // 2. Insert intake record into applications table
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
    console.error("[submitPublicRetailerApplication] Insert error:", insertErr);
    return {
      success: false,
      error: "Failed to save application. Please try again.",
    };
  }

  // 3. Send confirmation email to applicant & internal admin notification
  try {
    await sendEmail({
      to: data.email.toLowerCase().trim(),
      subject: `[K SELECT HUB] Retailer Application Received - ${applicationNumber}`,
      text: `Hello ${data.contactName},\n\nThank you for applying for partnership with K SELECT HUB.\n\nApplication Number: ${applicationNumber}\nCompany: ${data.companyName}\n\nOur K SELECT team will review your application and contact you regarding next steps.\n\nThank you,\nK SELECT Retail Operations Team`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #18181b; background-color: #ffffff;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #18181b;">K SELECT</span>
            <span style="font-size: 13px; font-weight: 700; color: #71717a; margin-left: 8px;">HUB</span>
          </div>

          <div style="background: #f4f4f5; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
            <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 12px 0; color: #18181b;">Application Received</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #3f3f46; margin: 0;">
              Hello <strong>${data.contactName}</strong>,<br/><br/>
              Thank you for applying for a K SELECT Retailer Partnership for <strong>${data.companyName}</strong>.
            </p>
          </div>

          <div style="border: 1px solid #e4e4e7; border-radius: 12px; padding: 20px; margin-bottom: 24px; font-size: 13px; color: #3f3f46;">
            <p style="margin: 0 0 8px 0;"><strong>Application Number:</strong> ${applicationNumber}</p>
            <p style="margin: 0 0 8px 0;"><strong>Company Name:</strong> ${data.companyName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Contact Email:</strong> ${data.email}</p>
            <p style="margin: 0;"><strong>Status:</strong> Under Review</p>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #71717a; margin: 0;">
            Our K SELECT team will review your application and contact you regarding next steps.
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.warn("[submitPublicRetailerApplication] Email sending warning:", emailErr);
  }

  return {
    success: true,
    applicationNumber,
  };
}
