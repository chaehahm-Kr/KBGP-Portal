import { NextRequest, NextResponse } from "next/server";
import { memoryAssetStore } from "@/lib/brand-marketing/package-importer";
import { createAdminClient } from "@/lib/supabase/admin";
import path from "path";

export const dynamic = "force-dynamic";

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path || [];
  const assetKey = pathSegments.join("/");

  // 1. Check in-memory fast cache
  if (memoryAssetStore.has(assetKey)) {
    const item = memoryAssetStore.get(assetKey)!;
    return new Response(new Uint8Array(item.buffer), {
      headers: {
        "Content-Type": item.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // 2. Fetch from Supabase Storage
  try {
    const admin = createAdminClient();
    const storagePath = `marketing/${assetKey}`;

    const { data, error } = await admin.storage
      .from("company-uploads")
      .download(storagePath);

    if (error || !data) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = getMimeType(assetKey);

    // Cache in memory
    memoryAssetStore.set(assetKey, { buffer, contentType });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to load asset" }, { status: 500 });
  }
}
