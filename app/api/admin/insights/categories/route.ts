import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_CATEGORIES = [
  { id: "cat-1", name: "U.S. MARKET ENTRY", description: "Regulations, MoCRA compliance, import customs, and U.S. distribution strategy" },
  { id: "cat-2", name: "RETAIL TRENDS", description: "Independent beauty supply stores, chain retailers, and offline shelf dynamics" },
  { id: "cat-3", name: "CONSUMER INSIGHTS", description: "U.S. K-Beauty consumer behavior, ingredient trends, and product preferences" },
  { id: "cat-4", name: "COMPLIANCE & LEGAL", description: "FDA, FTC claims, safety substantiation, and packaging guidelines" }
];

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("insights_categories").select("*").order("name");

    if (error || !data || data.length === 0) {
      return NextResponse.json({ categories: DEFAULT_CATEGORIES });
    }

    return NextResponse.json({ categories: data });
  } catch (e) {
    return NextResponse.json({ categories: DEFAULT_CATEGORIES });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("insights_categories")
      .insert({ name: name.trim(), description: description || "" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ category: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create category" }, { status: 500 });
  }
}
