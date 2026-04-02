import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") || "search_system";
    const onlyActive = searchParams.get("active") === "1";

    const supabase = getSupabaseClient();
    let query = supabase
      .from("prompt_templates")
      .select("id,name,version,content,is_active,created_at")
      .eq("name", name)
      .order("version", { ascending: false })
      .limit(50);

    if (onlyActive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message, errorCode: "PROMPT_LIST_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      items: data ?? [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", errorCode: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      content?: string;
      isActive?: boolean;
    };

    const name = (body.name || "search_system").trim();
    const content = (body.content || "").trim();
    const isActive = body.isActive !== false;

    if (!content) {
      return NextResponse.json(
        { error: "content is required", errorCode: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseClient();
    const { data: latest, error: latestError } = await supabase
      .from("prompt_templates")
      .select("version")
      .eq("name", name)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      return NextResponse.json(
        { error: latestError.message, errorCode: "PROMPT_VERSION_ERROR" },
        { status: 500 },
      );
    }

    const nextVersion = Number(latest?.version ?? 0) + 1;

    if (isActive) {
      await supabase.from("prompt_templates").update({ is_active: false }).eq("name", name);
    }

    const { data, error } = await supabase
      .from("prompt_templates")
      .insert({
        name,
        version: nextVersion,
        content,
        is_active: isActive,
      })
      .select("id,name,version,content,is_active,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, errorCode: "PROMPT_CREATE_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", errorCode: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: number;
      name?: string;
      activate?: boolean;
    };

    const id = Number(body.id);
    const activate = body.activate !== false;

    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "id is required", errorCode: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseClient();
    const { data: row, error: rowError } = await supabase
      .from("prompt_templates")
      .select("id,name")
      .eq("id", id)
      .maybeSingle();

    if (rowError || !row) {
      return NextResponse.json(
        { error: rowError?.message || "prompt not found", errorCode: "PROMPT_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (activate) {
      await supabase.from("prompt_templates").update({ is_active: false }).eq("name", row.name);
    }

    const { data, error } = await supabase
      .from("prompt_templates")
      .update({ is_active: activate })
      .eq("id", id)
      .select("id,name,version,content,is_active,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, errorCode: "PROMPT_ACTIVATE_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json({ item: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error", errorCode: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}
