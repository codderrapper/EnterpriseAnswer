import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const PromptPostSchema = z.object({
  name: z.string().trim().default("search_system"),
  content: z.string().trim().min(1, "content is required"),
  isActive: z.boolean().default(true),
});

const PromptPatchSchema = z.object({
  id: z.number().int().finite({ message: "id is required" }),
  activate: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") || "search_system";
    const onlyActive = searchParams.get("active") === "1";

    const supabase = await getSupabaseServerClient();
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
    const parsed = PromptPostSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload", errorCode: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }

    const { name, content, isActive } = parsed.data;

    const supabase = await getSupabaseServerClient();
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
    const parsed = PromptPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid payload", errorCode: "INVALID_PAYLOAD" },
        { status: 400 },
      );
    }

    const { id, activate } = parsed.data;

    const supabase = await getSupabaseServerClient();
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
