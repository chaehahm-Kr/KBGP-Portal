import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_AUTHORS = [
  { id: "aut-1", name: "Compliance Operations Team", role: "K SELECT Regulatory & Compliance Desk" },
  { id: "aut-2", name: "Market Intelligence Desk", role: "K SELECT U.S. Retail & Market Research" },
  { id: "aut-3", name: "K-Beauty Strategy Team", role: "K SELECT Brand Acceleration Team" }
];

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("insights_authors").select("*").order("name");

    if (error || !data || data.length === 0) {
      return NextResponse.json({ authors: DEFAULT_AUTHORS });
    }

    return NextResponse.json({ authors: data });
  } catch (e) {
    return NextResponse.json({ authors: DEFAULT_AUTHORS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const { name, role } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Author name is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("insights_authors")
      .insert({ name: name.trim(), role: role || "" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ author: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create author" }, { status: 500 });
  }
}
