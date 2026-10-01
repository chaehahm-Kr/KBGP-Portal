import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateUploadedFile } from "@/lib/files/validate";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const knowledgeId = (formData.get("knowledgeId") as string) || "general";

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file (allow documents & spreadsheets & images, max 25MB for official manuals)
    const validation = await validateUploadedFile(file, ["document", "image", "spreadsheet"]);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "pdf";
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `knowledge/${knowledgeId}/${Date.now()}_${cleanFileName}`;

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from("company-uploads")
      .upload(storagePath, file, {
        contentType: validation.detectedMime,
        upsert: true
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
    }

    // Generate signed URL
    const { data: signedData } = await supabase.storage
      .from("company-uploads")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year signed URL

    return NextResponse.json({
      file_url: signedData?.signedUrl || `/api/admin/knowledge/asset/${knowledgeId}`,
      file_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      file_type: validation.detectedMime
    });
  } catch (err: any) {
    console.error("Knowledge upload API error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload document" }, { status: 500 });
  }
}
