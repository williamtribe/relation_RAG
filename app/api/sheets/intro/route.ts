import { NextResponse } from "next/server";
import { upsertProfileIntroById } from "../../../../lib/sheets";

export async function POST(req: Request) {
  try {
    const { id, intro, sheetName } = await req.json();
    if (!id || typeof intro !== "string") {
      return NextResponse.json({ error: "id and intro are required" }, { status: 400 });
    }
    await upsertProfileIntroById(id, intro, sheetName);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}