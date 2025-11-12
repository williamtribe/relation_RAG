import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { openai } from "@/lib/openai";

type EmbeddingRow = {
  profile_id: string;
  embedding: number[] | string | null;
  updated_at?: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  intro: string | null;
  company: string | null;
  role: string | null;
};

const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "that",
  "this",
  "you",
  "your",
  "but",
  "are",
  "have",
  "has",
  "i",
  "im",
  "me",
  "we",
  "our",
  "us",
  "to",
  "of",
  "in",
  "on",
  "at",
  "is",
  "it",
  "be",
  "a",
  "an",
  "my",
  "by",
  "또",
  "그리고",
  "하지만",
  "그러나",
  "저는",
  "제가",
  "우리",
  "나",
  "있는",
  "있는",
  "하고",
  "하고있습니다",
  "합니다",
  "이에요",
  "입니다",
  "에서",
  "으로",
  "에게",
  "그리고요",
  "또한",
]);

const DEFAULT_MAX_CLUSTERS = 6;
const CACHE_ROW_ID = "default";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestedKParam = url.searchParams.get("k");
    const requestedK = Number(requestedKParam);
    const force = url.searchParams.get("force") === "true";

    const { data: latestUpdatedRow, error: latestUpdatedError } = await supabaseAdmin
      .from("profile_embeddings")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestUpdatedError) {
      return NextResponse.json({ error: latestUpdatedError.message }, { status: 500 });
    }

    const latestUpdatedValue = latestUpdatedRow?.updated_at as string | null | undefined;
    const latestEmbeddingUpdatedAt = latestUpdatedValue ? new Date(latestUpdatedValue) : null;

    if (!force) {
      const { data: cacheRow, error: cacheError } = await supabaseAdmin
        .from("intro_cluster_cache")
        .select("clusters, meta, source_updated_at")
        .eq("id", CACHE_ROW_ID)
        .maybeSingle();

      if (!cacheError && cacheRow) {
        const cacheSourceUpdatedAt = cacheRow.source_updated_at
          ? new Date(cacheRow.source_updated_at)
          : null;
        const latestTimestamp = latestEmbeddingUpdatedAt?.getTime() ?? null;
        const cacheTimestamp = cacheSourceUpdatedAt?.getTime() ?? null;

        if (
          !latestTimestamp ||
          (cacheTimestamp !== null && cacheTimestamp >= latestTimestamp)
        ) {
          return NextResponse.json({
            clusters: cacheRow.clusters || [],
            meta: cacheRow.meta || { totalProfiles: 0, k: 0 },
            cached: true,
          });
        }
      } else if (cacheError && cacheError.code !== "42P01") {
        console.error("[intro-clusters] cache fetch error", cacheError);
      }
    }

    const { clusters, meta, sourceUpdatedAt } = await computeIntroClusters({
      requestedK: Number.isFinite(requestedK) ? requestedK : undefined,
      fallbackSourceUpdatedAt: latestEmbeddingUpdatedAt,
    });

    await upsertClusterCache({ clusters, meta, sourceUpdatedAt });

    return NextResponse.json({ clusters, meta, cached: false });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unknown error" }, { status: 500 });
  }
}

async function computeIntroClusters({
  requestedK,
  fallbackSourceUpdatedAt,
}: {
  requestedK?: number;
  fallbackSourceUpdatedAt: Date | null;
}) {
  const { data: embeddingRows, error: embeddingError } = await supabaseAdmin
    .from("profile_embeddings")
    .select("profile_id, embedding, updated_at")
    .not("embedding", "is", null);

  if (embeddingError) {
    throw new Error(embeddingError.message);
  }

  const normalized = (embeddingRows || []).map((row) => ({
    profile_id: row.profile_id,
    embedding: normalizeEmbedding(row.embedding),
    updated_at: row.updated_at ?? null,
  }));

  const validEmbeddings = normalized.filter(
    (
      row
    ): row is {
      profile_id: string;
      embedding: number[];
      updated_at: string | null;
    } => Array.isArray(row.embedding) && row.embedding.length > 0
  );

  if (!validEmbeddings.length) {
    return {
      clusters: [],
      meta: { totalProfiles: 0, k: 0 },
      sourceUpdatedAt: fallbackSourceUpdatedAt ?? null,
    };
  }

  const profileIds = validEmbeddings.map((row) => row.profile_id);
  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, name, company, role, intro")
    .in("id", profileIds);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileMap = new Map(profileRows?.map((profile) => [profile.id, profile] as const));

  const rowsWithIntro = validEmbeddings
    .map((row) => {
      const profile = profileMap.get(row.profile_id);
      return { row, profile };
    })
    .filter(
      (item): item is { row: typeof validEmbeddings[number]; profile: ProfileRow } =>
        Boolean(item.profile?.intro?.trim())
    );

  if (!rowsWithIntro.length) {
    const sourceUpdatedAt = determineSourceUpdatedAt(validEmbeddings, fallbackSourceUpdatedAt);
    return {
      clusters: [],
      meta: { totalProfiles: 0, k: 0 },
      sourceUpdatedAt,
    };
  }

  const vectors = rowsWithIntro.map((item) => item.row.embedding);
  const inferredK =
    typeof requestedK === "number" && Number.isFinite(requestedK) && requestedK > 0
      ? Math.min(Math.max(1, Math.floor(requestedK)), vectors.length)
      : Math.min(
          DEFAULT_MAX_CLUSTERS,
          Math.max(1, Math.round(Math.sqrt(vectors.length)) || 1)
        );

  const { assignments } = kMeans(vectors, inferredK);

  const clusters = new Map<
    number,
    {
      members: Array<{
        profile: ProfileRow;
        introSnippet: string;
      }>;
    }
  >();

  assignments.forEach((clusterIdx, vectorIdx) => {
    const profile = rowsWithIntro[vectorIdx]?.profile;
    if (!profile) return;
    const intro = (profile.intro || "").trim();
    if (!intro) return;
    if (!clusters.has(clusterIdx)) {
      clusters.set(clusterIdx, { members: [] });
    }
    clusters.get(clusterIdx)!.members.push({
      profile,
      introSnippet: intro.length > 150 ? `${intro.slice(0, 147)}...` : intro,
    });
  });

  let clusterPayload = Array.from(clusters.entries())
    .map(([clusterIdx, clusterData]) => {
      const combinedIntro = clusterData.members.map((m) => m.profile.intro || "").join(" ");
      return {
        clusterId: clusterIdx,
        label: `Cluster ${clusterIdx + 1}`,
        size: clusterData.members.length,
        keywords: extractTopKeywords(combinedIntro, 4),
        members: clusterData.members.map(({ profile, introSnippet }) => ({
          profile_id: profile.id,
          name: profile.name,
          company: profile.company,
          role: profile.role,
          introSnippet,
        })),
      };
    })
    .sort((a, b) => b.size - a.size);

  if (clusterPayload.length) {
    clusterPayload = await enrichClustersWithSummaries(clusterPayload);
  }

  const sourceUpdatedAt = determineSourceUpdatedAt(validEmbeddings, fallbackSourceUpdatedAt);

  return {
    clusters: clusterPayload,
    meta: { totalProfiles: rowsWithIntro.length, k: clusterPayload.length },
    sourceUpdatedAt,
  };
}

async function upsertClusterCache({
  clusters,
  meta,
  sourceUpdatedAt,
}: {
  clusters: any;
  meta: any;
  sourceUpdatedAt: Date | null;
}) {
  const payload = {
    id: CACHE_ROW_ID,
    clusters,
    meta,
    source_updated_at: sourceUpdatedAt ? sourceUpdatedAt.toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("intro_cluster_cache").upsert(payload);
  if (error) {
    if (error.code === "42P01") {
      console.warn("[intro-clusters] cache table missing, skipping cache upsert");
    } else {
      console.error("[intro-clusters] cache upsert failed", error);
    }
  }
}

function determineSourceUpdatedAt(
  embeddings: Array<{ updated_at: string | null }>,
  fallback: Date | null
) {
  const msFromEmbeddings = embeddings.reduce((max, row) => {
    const ts = row.updated_at ? Date.parse(row.updated_at) : 0;
    return ts > max ? ts : max;
  }, 0);
  const fallbackMs = fallback ? fallback.getTime() : 0;
  const effective = Math.max(msFromEmbeddings, fallbackMs);
  return effective ? new Date(effective) : null;
}

function kMeans(vectors: number[][], k: number, maxIterations = 30) {
  const dimension = vectors[0].length;
  const clusterCount = Math.min(Math.max(1, k), vectors.length);

  let centroids = initializeCentroids(vectors, clusterCount);
  let assignments = new Array(vectors.length).fill(0);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let hasChanged = false;

    // Step 1: Assign points to nearest centroid
    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i];
      let bestCluster = 0;
      let bestSimilarity = -Infinity;

      for (let c = 0; c < centroids.length; c++) {
        const similarity = cosineSimilarity(vector, centroids[c]);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestCluster = c;
        }
      }

      if (assignments[i] !== bestCluster) {
        hasChanged = true;
        assignments[i] = bestCluster;
      }
    }

    // Step 2: Recompute centroids
    const sums = Array.from({ length: clusterCount }, () => new Array(dimension).fill(0));
    const counts = new Array(clusterCount).fill(0);

    for (let i = 0; i < vectors.length; i++) {
      const cluster = assignments[i];
      counts[cluster]++;
      const vector = vectors[i];
      for (let d = 0; d < dimension; d++) {
        sums[cluster][d] += vector[d];
      }
    }

    for (let c = 0; c < clusterCount; c++) {
      if (counts[c] === 0) {
        centroids[c] = vectors[Math.floor(Math.random() * vectors.length)].slice();
        continue;
      }
      for (let d = 0; d < dimension; d++) {
        sums[c][d] /= counts[c];
      }
      centroids[c] = sums[c];
    }

    if (!hasChanged) break;
  }

  return { assignments, centroids };
}

function initializeCentroids(vectors: number[][], k: number) {
  if (vectors.length <= k) {
    return vectors.map((vec) => vec.slice());
  }
  const step = Math.max(1, Math.floor(vectors.length / k));
  const centroids: number[][] = [];
  for (let i = 0; i < k; i++) {
    const idx = (i * step) % vectors.length;
    centroids.push(vectors[idx].slice());
  }
  return centroids;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractTopKeywords(text: string, limit = 4) {
  if (!text.trim()) return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  if (!tokens.length) return [];

  const frequency = tokens.reduce((map, token) => {
    map.set(token, (map.get(token) || 0) + 1);
    return map;
  }, new Map<string, number>());

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function normalizeEmbedding(value: number[] | string | null) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    const withoutBrackets = trimmed.replace(/^[\[\(\{]+|[\]\)\}]+$/g, "");
    if (!withoutBrackets) return null;
    const numbers = withoutBrackets
      .split(/[\s,]+/)
      .map((token) => Number(token))
      .filter((n) => Number.isFinite(n));
    return numbers.length ? numbers : null;
  }
  return null;
}

async function enrichClustersWithSummaries(
  clusters: Array<{
    clusterId: number;
    label: string;
    size: number;
    keywords: string[];
    members: Array<{
      profile_id: string;
      name: string | null;
      company: string | null;
      role: string | null;
      introSnippet: string;
    }>;
  }>
) {
  if (!process.env.OPENAI_API_KEY) return clusters;

  const result: typeof clusters = [];
  for (const cluster of clusters) {
    const llmKeywords = await summarizeClusterKeywords(cluster).catch((err) => {
      console.error("[intro-clusters] summarization failed", err);
      return null;
    });
    result.push({
      ...cluster,
      keywords: llmKeywords?.length ? llmKeywords : cluster.keywords,
    });
  }
  return result;
}

async function summarizeClusterKeywords(cluster: {
  label: string;
  members: Array<{
    name: string | null;
    introSnippet: string;
  }>;
}) {
  if (!cluster.members.length) return null;

  const sample = cluster.members
    .slice(0, 10)
    .map((member, idx) => {
      const name = member.name ? `(${member.name})` : "";
      return `${idx + 1}. ${name} ${member.introSnippet}`.trim();
    })
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "너는 여러 자기소개를 읽고 공통된 주제를 요약하는 분석가이다. " +
          "항상 JSON 객체로 {\"keywords\":[\"키워드1\",\"키워드2\",...]} 형태로만 답하라. " +
          "키워드는 2~4개, 한/두 단어로 간결하게 쓰고 인사말이나 의미 없는 단어는 제외해라.",
      },
      {
        role: "user",
        content:
          `다음 자기소개들의 공통 관심사/주제를 요약해서 의미 있는 키워드를 뽑아줘.\n\n${sample}`,
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.keywords)) {
      return parsed.keywords
        .map((kw: unknown) => (typeof kw === "string" ? kw.trim() : ""))
        .filter(Boolean)
        .slice(0, 4);
    }
  } catch {
    // ignore parsing errors
  }
  return null;
}
