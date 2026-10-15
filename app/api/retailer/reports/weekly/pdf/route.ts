import { NextRequest, NextResponse } from "next/server";
import { getRetailerAccessibleStores } from "@/lib/retailer/weekly-check";
import { getRetailerWeeklyReportData } from "@/lib/retailer/weekly-report";
import { generateWeeklyReportPdf, getWeeklyReportPdfFilename } from "@/lib/retailer/weekly-report-pdf";
import { createClient } from "@/lib/supabase/server";
import { getImpersonationSession } from "@/lib/auth/impersonation";

export const dynamic = "force-dynamic";

/**
 * GET /api/retailer/reports/weekly/pdf
 * Generates and downloads a print-ready Weekly Performance & Reorder Report PDF
 * Strict server-side authorization: verifies session, company membership, and store access.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Session verification (supports both regular session and admin impersonation)
    const impSession = await getImpersonationSession();
    const isImpersonatingRetailer = impSession && impSession.portalType === "RETAILER";

    if (!isImpersonatingRetailer) {
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.json(
          { error: "Unauthorized. Please log in to download reports." },
          { status: 401 }
        );
      }
    }

    // 2. Fetch accessible stores and verify company membership
    const { companyId, stores } = await getRetailerAccessibleStores();

    if (!companyId) {
      return NextResponse.json(
        { error: "Forbidden. Retailer company membership not found." },
        { status: 403 }
      );
    }

    // 3. Extract and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const requestedWeek = searchParams.get("week") || undefined;
    const requestedStore = searchParams.get("store") || undefined;

    // Validate store scope authorization
    const validStoreIds = stores.map((s) => s.id);
    if (requestedStore && requestedStore !== "all") {
      const isStoreAuthorized = validStoreIds.includes(requestedStore);
      if (!isStoreAuthorized) {
        return NextResponse.json(
          { error: "Forbidden. You do not have access to the requested store." },
          { status: 403 }
        );
      }
    }

    // 4. Fetch authoritative weekly report data
    const reportData = await getRetailerWeeklyReportData({
      reportingWeek: requestedWeek,
      storeId: requestedStore,
    });

    // 5. Generate PDF bytes
    const pdfBytes = await generateWeeklyReportPdf(reportData);
    const filename = getWeeklyReportPdfFilename(reportData);

    // 6. Return binary PDF response with attachment headers
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.byteLength.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    // Catch Next.js redirect errors (e.g. from DAL session expiration)
    if (
      error?.digest?.startsWith("NEXT_REDIRECT") ||
      error?.message?.includes("NEXT_REDIRECT")
    ) {
      return NextResponse.json(
        { error: "Unauthorized. Session expired, please log in." },
        { status: 401 }
      );
    }

    console.error("[Weekly Report PDF API Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate report PDF." },
      { status: 500 }
    );
  }
}
