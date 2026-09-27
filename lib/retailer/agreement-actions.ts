"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateRetailerAgreementPdf } from "./agreement-pdf";
import { sendEmail } from "@/lib/notifications/email";
import { sendTemplatedEmail } from "@/lib/notifications/templates";
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
        document_type: "RETAILER_AGREEMENT",
        title: `K SELECT Retailer Operating Agreement (v${version})`,
        file_name: pdfFilename,
        file_path: storagePath,
        mime_type: "application/pdf",
        file_size_bytes: pdfBuffer.length,
        agreement_version: version,
        agreement_acceptance_id: acceptance.id,
        signer_name: signerName,
        signer_email: signerEmail,
        signer_title: signerTitle,
        accepted_at: acceptance.accepted_at,
        status: "active",
      });

    // 6. Send delivery email with PDF attachment if signerEmail is present
    if (signerEmail && signerEmail.includes("@")) {
      try {
        const base64Pdf = pdfBuffer.toString("base64");
        const executedDateStr = new Date(acceptance.accepted_at).toISOString().split("T")[0];
        await sendTemplatedEmail(
          "hub_retailer_agreement_completed",
          signerEmail,
          {
            company_name: companyName,
            companyName: companyName,
            agreement_name: `K SELECT Retailer Operating Agreement (v${version})`,
            agreementName: `K SELECT Retailer Operating Agreement (v${version})`,
            agreement_version: version,
            agreementVersion: version,
            agreement_id: acceptance.id.slice(0, 8).toUpperCase(),
            agreementId: acceptance.id.slice(0, 8).toUpperCase(),
            signer_name: signerName,
            signerName: signerName,
            signer_title: signerTitle,
            signerTitle: signerTitle,
            executed_date: executedDateStr,
            executedDate: executedDateStr,
            effective_date: executedDateStr,
            effectiveDate: executedDateStr,
            portal_url: "https://portal.kselecthub.com/retailer/account?tab=documents",
            portalUrl: "https://portal.kselecthub.com/retailer/account?tab=documents",
            agreement_view_url: "https://portal.kselecthub.com/retailer/account?tab=documents",
            agreementViewUrl: "https://portal.kselecthub.com/retailer/account?tab=documents",
            supportEmail: "support@kselecthub.com",
          },
          [
            {
              filename: pdfFilename,
              content: base64Pdf,
            },
          ]
        );
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
    if (doc.file_path) {
      const { data: signedData } = await adminClient.storage
        .from("company-uploads")
        .createSignedUrl(doc.file_path, 3600);
      signedUrl = signedData?.signedUrl || null;
    }

    documents.push({
      id: doc.id,
      companyId: doc.company_id,
      documentType: doc.document_type,
      title: doc.title,
      description: doc.signer_name ? `Signed by ${doc.signer_name}` : doc.file_name,
      storageBucket: "company-uploads",
      storagePath: doc.file_path,
      filename: doc.file_name,
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
