import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/db";
import { openai } from "../../../lib/openai";

export async function POST(req: Request) {
  try {
    const { q, limit = 10, useVector = false } = await req.json();
    if (!q || typeof q !== "string") return NextResponse.json({ error: "q required" }, { status: 400 });

    // 1) 텍스트 검색 (ILIKE)
    const { data: rows, error: e1 } = await supabaseAdmin
      .from("profiles")
      .select("id,name,company,role,intro,tags")
      .order("updated_at", { ascending: false });

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const needle = q.toLowerCase();
    const textMatches =
      (rows || [])
        .filter((row) => {
          const haystacks = [
            row.name,
            row.company,
            row.role,
            row.intro,
            ...(Array.isArray(row.tags) ? row.tags : []),
          ];
          return haystacks.some((value) =>
            typeof value === "string" && value.toLowerCase().includes(needle)
          );
        })
        .slice(0, limit);

    // 2) 선택: 벡터 검색
    let vectorMatches: any[] = [];
    if (useVector) {
      const emb = await openai.embeddings.create({ input: q, model: "text-embedding-3-small" });
      const vec = emb.data[0].embedding;
      const { data } = await supabaseAdmin.rpc("match_profiles", {
        query_embedding: vec, match_count: limit, exclude_profile_id: "00000000-0000-0000-0000-000000000000"
      });
      vectorMatches = data || [];
    }

    return NextResponse.json({ textMatches, vectorMatches });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
