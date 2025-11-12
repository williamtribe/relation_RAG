// @ts-ignore - Deno Edge Function 전용 URL import
import { serve } from "https://deno.land/std@0.223.0/http/server.ts";
// @ts-ignore - Deno Edge Function 전용 URL import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Next.js 타입체커용: Edge Function 실행환경(Deno) 전역 선언
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

type VectorType = "intro" | "work" | "hobby";
const EMBEDDING_MODEL = "text-embedding-3-large";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";

const trimOrNull = (value?: string | null) => {
  const trimmed = (value || "").trim();
  return trimmed.length ? trimmed : null;
};

const vectorId = (profileId: string, type: VectorType) => `${profileId}:${type}`;

const normalizeHost = (host: string) => (host.startsWith("https://") ? host : `https://${host}`);

async function fetchEmbeddings(apiKey: string, inputs: string[]): Promise<number[][]> {
  const response = await fetch(OPENAI_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} ${errText}`);
  }

  const json = await response.json();
  return json.data.map((item: { embedding: number[] }) => item.embedding);
}

async function pineconeUpsert(
  host: string,
  apiKey: string,
  namespace: string,
  vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>
) {
  const url = `${normalizeHost(host)}/vectors/upsert`;
  const body: Record<string, unknown> = { vectors };
  if (namespace) body.namespace = namespace;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinecone upsert failed: ${response.status} ${errText}`);
  }
}

async function pineconeDelete(host: string, apiKey: string, namespace: string, ids: string[]) {
  const url = `${normalizeHost(host)}/vectors/delete`;
  const body: Record<string, unknown> = { ids };
  if (namespace) body.namespace = namespace;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Pinecone delete failed: ${response.status} ${errText}`);
  }
}

serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const profileId: string | undefined = payload?.record?.id ?? payload?.profile_id;
    if (!profileId) {
      return new Response(JSON.stringify({ error: "profile_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const pineconeKey = Deno.env.get("PINECONE_API_KEY");
    const pineconeHost = Deno.env.get("PINECONE_HOST");
    const pineconeNamespace = Deno.env.get("PINECONE_NAMESPACE") || "";

    if (!supabaseUrl || !serviceKey || !openaiKey || !pineconeKey || !pineconeHost) {
      return new Response(JSON.stringify({ error: "missing environment variables" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,intro,work,hobby")
      .eq("id", profileId)
      .single();

    if (error || !profile) {
      return new Response(
        JSON.stringify({ error: error?.message || "profile not found", profileId }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const introText = [trimOrNull(profile.intro), trimOrNull(profile.work), trimOrNull(profile.hobby)]
      .filter(Boolean)
      .join(" ");
    const workText = trimOrNull(profile.work);
    const hobbyText = trimOrNull(profile.hobby);

    const tasks: Array<{ type: VectorType; text: string }> = [];
    if (introText) tasks.push({ type: "intro", text: introText });
    if (workText) tasks.push({ type: "work", text: workText });
    if (hobbyText) tasks.push({ type: "hobby", text: hobbyText });

    const embeddings = tasks.length ? await fetchEmbeddings(openaiKey, tasks.map((t) => t.text)) : [];

    const embeddingMap: Record<VectorType, number[] | null> = {
      intro: null,
      work: null,
      hobby: null,
    };

    const pineconeVectors: Array<{
      id: string;
      values: number[];
      metadata: { profile_id: string; vector_type: VectorType };
    }> = [];

    tasks.forEach((task, idx) => {
      const values = embeddings[idx];
      embeddingMap[task.type] = values;
      pineconeVectors.push({
        id: vectorId(profileId, task.type),
        values,
        metadata: { profile_id: profileId, vector_type: task.type },
      });
    });

    const deletes: string[] = [];
    (["intro", "work", "hobby"] as VectorType[]).forEach((type) => {
      if (embeddingMap[type] === null) {
        deletes.push(vectorId(profileId, type));
      }
    });

    await supabase.from("profile_embeddings").upsert({
      profile_id: profileId,
      embedding: embeddingMap.intro,
      work_embedding: embeddingMap.work,
      hobby_embedding: embeddingMap.hobby,
      updated_at: new Date().toISOString(),
    });

    if (pineconeVectors.length) {
      await pineconeUpsert(pineconeHost, pineconeKey, pineconeNamespace, pineconeVectors);
    }
    if (deletes.length) {
      const uniqueDeletes = Array.from(new Set(deletes));
      await pineconeDelete(pineconeHost, pineconeKey, pineconeNamespace, uniqueDeletes);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        profile_id: profileId,
        upserted: pineconeVectors.length,
        deleted: deletes.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[profile-pinecone-sync] error", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
