"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateRetailerAgreementPdf } from "./agreement-pdf";
import { sendEmail } from "@/lib/notifications/email";
import { verifyAdminSession, verifyRetailerSession } from "@/lib/auth/dal";

export interface RetailerDocumentRecord {
  id: string;
  companyId: string;
  documentType: string;
  title: string;
  description?: string | null;
  storageBucket: string;
  storagePath: string;
  filename: string;
  fileSizeBytes?: number | null;
  mimeType: string;
  agreementVersion?: string | null;
  createdAt: string;
  signedUrl?: string | null;
}

export interface RetailerAgreementViewItem {
  id: string;
  companyId: string;
  agreementType: string;
  agreementVersion: string;
  acceptedName: string;
  signerTitle?: string | null;
  signerEmail?: string | null;
  acceptedAt: string;
  pdfStatus: "pending" | "generated" | "failed";
  pdfStoragePath?: string | null;
  pdfFilename?: string | null;
  pdfGeneratedAt?: string | null;
  pdfError?: string | null;
  signedPdfUrl?: string | null;
}

/**
 * Server-side generation and archival storage of the signed Retailer Agreement PDF
 */
export async function processAgreementPdfGeneration(acceptanceId: string): Promise<{
  success: boolean;
  error?: string;
  storagePath?: string;
}> {
  const adminClient = createAdminClient();

  // 1. Fetch acceptance record + company + signer info
  const { data: acceptance, error: accErr } = await adminClient
    .from("retailer_agreement_acceptances")
    .select(`
      id,
      company_id,
      user_id,
      agreement_type,
      agreement_version,
      accepted_name,
      signer_title,
      signer_email,
      accepted_ip,
      accepted_at,
      companies (
        id,
        name,
        business_registration_number
      )
    `)
    .eq("id", acceptanceId)
    .maybeSingle();

  if (accErr || !acceptance) {
    console.error("[processAgreementPdfGeneration] Acceptance record not found:", accErr);
    return { success: false, error: "Agreement acceptance record not found." };
  }

  const comp = Array.isArray(acceptance.companies) ? acceptance.companies[0] : acceptance.companies;
  const companyName = comp?.name || "K SELECT Retailer Partner";
  const businessRegistrationNumber = comp?.business_registration_number || null;
  const version = acceptance.agreement_version || "1.0";
  const signerName = acceptance.accepted_name || "Authorized Representative";
  const signerEmail = acceptance.signer_email || null;
  const signerTitle = acceptance.signer_title || "Company Representative";

  const storageBucket = "company-uploads";
  const pdfFilename = `kselect_retailer_agreement_v${version.replace(".", "_")}_${acceptance.id.slice(0, 8)}.pdf`;
  const storagePath = `retailers/${acceptance.company_id}/agreements/${pdfFilename}`;

  try {
    // 2. Generate PDF Buffer
    const pdfBytes = await generateRetailerAgreementPdf({
      companyName,
      companyId: acceptance.company_id,
      businessRegistrationNumber,
      signerName,
      signerTitle,
      signerEmail,
      signerIp: acceptance.accepted_ip,
      acceptedAt: acceptance.accepted_at,
      acceptanceId: acceptance.id,
      agreementVersion: version,
    });

    const pdfBuffer = Buffer.from(pdfBytes);

    // 3. Upload to private Supabase Storage
    const { error: uploadError } = await adminClient.storage
      .from(storageBucket)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const now = new Date().toISOString();

    // 4. Update retailer_agreement_acceptances
    await adminClient
      .from("retailer_agreement_acceptances")
      .update({
        pdf_status: "generated",
        pdf_storage_path: storagePath,
        pdf_filename: pdfFilename,
        pdf_generated_at: now,
        pdf_error: null,
      })
      .eq("id", acceptance.id);

    // 5. Upsert into retailer_documents
    await adminClient
      .from("retailer_documents")
      .insert({
        company_id: acceptance.company_id,
        document_type: "operating_agreement",
        title: `K SELECT Retailer Operating Agreement (v${version})`,
        description: `Authoritative executed agreement signed by ${signerName} on ${new Date(acceptance.accepted_at).toLocaleDateString("en-US")}.`,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        filename: pdfFilename,
        file_size_bytes: pdfBuffer.length,
        mime_type: "application/pdf",
        agreement_version: version,
        acceptance_id: acceptance.id,
        created_by: acceptance.user_id,
      });

    // 6. Send delivery email with PDF attachment if signerEmail is present
    if (signerEmail && signerEmail.includes("@")) {
      try {
        const base64Pdf = pdfBuffer.toString("base64");
        await sendEmail({
          to: signerEmail,
          subject: `[K SELECT] Executed Retailer Operating Agreement (v${version}) - ${companyName}`,
          text: `Dear ${signerName},\n\nThank you for executing the K SELECT Retailer Operating Agreement (Version ${version}) for ${companyName}.\n\nAttached is your official, immutable signed PDF document for your records.\n\nYou can also access and download this document at any time from your Retailer Portal Account Settings under "Agreements & Documents".\n\nBest regards,\nK SELECT Operations & Compliance Team`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #18181b; background-color: #ffffff;">
              <div style="margin-bottom: 24px;">
                <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #18181b;">K SELECT</span>
                <span style="font-size: 13px; font-weight: 700; color: #71717a; margin-left: 8px;">Document Archive</span>
              </div>
              
              <div style="background: #f4f4f5; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
                <h2 style="font-size: 18px; font-weight: 800; margin: 0 0 12px 0; color: #18181b;">Retailer Operating Agreement Executed</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #3f3f46; margin: 0;">
                  The K SELECT Retailer Operating Agreement (<strong>Version ${version}</strong>) has been successfully executed for <strong>${companyName}</strong>.
                </p>
              </div>

              <div style="border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; line-height: 1.6;">
                <div><strong>Signatory:</strong> ${signerName} (${signerTitle})</div>
                <div><strong>Executed Date:</strong> ${new Date(acceptance.accepted_at).toUTCString()}</div>
                <div><strong>Document:</strong> ${pdfFilename}</div>
              </div>

              <p style="font-size: 13px; line-height: 1.6; color: #52525b; margin-bottom: 28px;">
                Attached to this email is your official, tamper-evident archival PDF. You can also view and download this agreement at any time in the Retailer Portal under <strong>Account → Agreements & Documents</strong>.
              </p>

              <div style="text-align: center; margin-bottom: 32px;">
                <a href="https://portal.kselecthub.com/account" style="display: inline-block; background-color: #18181b; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 12px;">
                  Open Retailer Portal Documents →
                </a>
              </div>

              <p style="font-size: 12px; color: #a1a1aa; line-height: 1.5; margin: 0;">
                K SELECT NETWORK Compliance & Legal Archiving System.<br/>
                This is an automated system confirmation.
              </p>
            </div>
          `,
          attachments: [
            {
              filename: pdfFilename,
              content: base64Pdf,
            },
          ],
        });
      } catch (emailErr) {
        console.warn("[processAgreementPdfGeneration] Email delivery failed (PDF still archived):", emailErr);
      }
    }

    return {
      success: true,
      storagePath,
    };
  } catch (err: any) {
    console.error("[processAgreementPdfGeneration] PDF Processing failed:", err);
    await adminClient
      .from("retailer_agreement_acceptances")
      .update({
        pdf_status: "failed",
        pdf_error: err.message || "Unknown PDF generation error",
      })
      .eq("id", acceptance.id);

    return {
      success: false,
      error: err.message || "Failed to generate agreement PDF.",
    };
  }
}

/**
 * Fetch agreements and documents with pre-resolved signed download URLs for a retailer company
 */
export async function getRetailerCompanyAgreementsAndDocuments(companyId: string): Promise<{
  agreements: RetailerAgreementViewItem[];
  documents: RetailerDocumentRecord[];
}> {
  const adminClient = createAdminClient();

  // 1. Fetch Acceptances
  const { data: rawAcceptances } = await adminClient
    .from("retailer_agreement_acceptances")
    .select(`
      id,
      company_id,
      agreement_type,
      agreement_version,
      accepted_name,
      signer_title,
      signer_email,
      accepted_at,
      pdf_status,
      pdf_storage_path,
      pdf_filename,
      pdf_generated_at,
      pdf_error
    `)
    .eq("company_id", companyId)
    .order("accepted_at", { ascending: false });

  // 2. Fetch Documents
  const { data: rawDocs } = await adminClient
    .from("retailer_documents")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const agreements: RetailerAgreementViewItem[] = [];
  for (const acc of rawAcceptances || []) {
    let signedPdfUrl: string | null = null;
    if (acc.pdf_storage_path && acc.pdf_status === "generated") {
      const { data: signedData } = await adminClient.storage
        .from("company-uploads")
        .createSignedUrl(acc.pdf_storage_path, 3600);
      signedPdfUrl = signedData?.signedUrl || null;
    }

    agreements.push({
      id: acc.id,
      companyId: acc.company_id,
      agreementType: acc.agreement_type,
      agreementVersion: acc.agreement_version,
      acceptedName: acc.accepted_name,
      signerTitle: acc.signer_title,
      signerEmail: acc.signer_email,
      acceptedAt: acc.accepted_at,
      pdfStatus: (acc.pdf_status as any) || "pending",
      pdfStoragePath: acc.pdf_storage_path,
      pdfFilename: acc.pdf_filename,
      pdfGeneratedAt: acc.pdf_generated_at,
      pdfError: acc.pdf_error,
      signedPdfUrl,
    });
  }

  const documents: RetailerDocumentRecord[] = [];
  for (const doc of rawDocs || []) {
    let signedUrl: string | null = null;
    if (doc.storage_path) {
      const { data: signedData } = await adminClient.storage
        .from(doc.storage_bucket || "company-uploads")
        .createSignedUrl(doc.storage_path, 3600);
      signedUrl = signedData?.signedUrl || null;
    }

    documents.push({
      id: doc.id,
      companyId: doc.company_id,
      documentType: doc.document_type,
      title: doc.title,
      description: doc.description,
      storageBucket: doc.storage_bucket,
      storagePath: doc.storage_path,
      filename: doc.filename,
      fileSizeBytes: doc.file_size_bytes,
      mimeType: doc.mime_type,
      agreementVersion: doc.agreement_version,
      createdAt: doc.created_at,
      signedUrl,
    });
  }

  return { agreements, documents };
}

/**
 * Admin action to re-trigger PDF generation for a failed or legacy agreement
 */
export async function adminRetryAgreementPdfAction(acceptanceId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  await verifyAdminSession();
  return await processAgreementPdfGeneration(acceptanceId);
}
