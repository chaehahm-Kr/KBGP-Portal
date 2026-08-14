import { NextRequest, NextResponse } from "next/server";
import { getStoreAssetById, getStoreKnowledgeById } from "@/lib/knowledge/store";
import { isAuthorizedForAudience } from "@/lib/knowledge/retrieval";
import { SecurityUserContext, UserRole } from "@/lib/knowledge/types";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action") || "view"; // "view" | "download"

  try {
    // 1. Fetch Asset Record
    const asset = await getStoreAssetById(id);
    if (!asset) {
      return NextResponse.json({ error: "Asset record not found" }, { status: 404 });
    }

    // 2. Fetch Knowledge Item Record
    const item = await getStoreKnowledgeById(asset.knowledge_id);
    if (!item) {
      return NextResponse.json({ error: "Associated knowledge item not found" }, { status: 404 });
    }

    // 3. Determine User Context / Role
    let userRole: UserRole = "anonymous";
    let userId: string = "anon-user";

    // Check Header overrides (x-user-role / x-user-id)
    const roleHeader = request.headers.get("x-user-role");
    const idHeader = request.headers.get("x-user-id");

    if (roleHeader) {
      userRole = roleHeader as UserRole;
      if (idHeader) userId = idHeader;
    } else {
      // Check Supabase Auth Session Cookie with admin- / portal- prefix mapping
      try {
        const allCookies = request.cookies.getAll();
        const mappedCookies = allCookies.map(c => {
          if (c.name.startsWith("admin-sb-")) return { name: c.name.replace("admin-sb-", "sb-"), value: c.value };
          if (c.name.startsWith("portal-sb-")) return { name: c.name.replace("portal-sb-", "sb-"), value: c.value };
          return c;
        });

        const supabase = createServerClient(
          publicEnv.NEXT_PUBLIC_SUPABASE_URL,
          publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          {
            cookies: {
              getAll: () => mappedCookies,
              setAll: () => {}
            }
          }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;

          // Lookup trusted role from Supabase DB profiles table
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.role) {
            userRole = profile.role as UserRole;
          } else {
            userRole = (user.app_metadata?.role || user.user_metadata?.role || "admin") as UserRole;
          }
        }
      } catch (e) {
        // Fallback to anonymous if auth fails
      }
    }

    const userContext: SecurityUserContext = {
      userId,
      role: userRole
    };

    // 4. Validate Audience Security (Deny-by-Default)
    const isAuthorized = isAuthorizedForAudience(userContext, item);

    if (!isAuthorized) {
      if (userRole === "anonymous") {
        return NextResponse.json(
          {
            error: "Authentication required to access this manual asset",
            code: "UNAUTHENTICATED",
            requiresAuth: true
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        {
          error: "Access Denied: You do not have permission to view or download this manual asset.",
          code: "FORBIDDEN_AUDIENCE",
          userRole,
          requiredAudience: item.audience
        },
        { status: 403 }
      );
    }

    // 5. Locate & Stream Private Asset File
    const privateDir = path.join(process.cwd(), "private_assets", "manuals");
    let targetFilePath = path.join(privateDir, asset.file_name);

    if (!fs.existsSync(targetFilePath)) {
      const fallbackEnglish = path.join(privateDir, "K_SELECT_INSIGHTS_Operations_Manual_v1.0.pdf");
      if (fs.existsSync(fallbackEnglish)) {
        targetFilePath = fallbackEnglish;
      } else {
        const files = fs.existsSync(privateDir) ? fs.readdirSync(privateDir).filter(f => f.endsWith(".pdf")) : [];
        if (files.length > 0) {
          targetFilePath = path.join(privateDir, files[0]);
        } else {
          return NextResponse.json(
            { error: "Asset file not found in secure storage" },
            { status: 404 }
          );
        }
      }
    }

    const fileBuffer = await fs.promises.readFile(targetFilePath);
    const disposition = action === "download" ? "attachment" : "inline";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(asset.file_name)}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        "Pragma": "no-cache"
      }
    });
  } catch (error: any) {
    console.error("GET /api/admin/knowledge/asset/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error reading asset" },
      { status: 500 }
    );
  }
}
