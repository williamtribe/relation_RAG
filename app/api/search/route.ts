import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/db";
import { openai } from "../../../lib/openai";
import { getPineconeIndex, type ProfileVectorMetadata } from "../../../lib/pinecone";

type ProfileRow = {
  id: string;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  intro?: string | null;
  work?: string | null;
  hobby?: string | null;
  tags?: string[] | null;
};
type VectorType = ProfileVectorMetadata["vector_type"];
type TypedVectorMatch = {
  profile_id: string;
  pinecone_id?: string;
  distance?: number;
  similarity?: number;
  matchType: string;
  profile: ProfileRow | null;
};
type RawTypedVectorMatch = Omit<TypedVectorMatch, "profile">;
type AggregatedVectorMatch = {
  profile_id: string;
  distance?: number;
  similarity?: number;
  matchTypes: string[];
  profile: ProfileRow | null;
};

const VECTOR_LABELS: Record<VectorType, string> = {
  intro: "자기소개",
  work: "일/직업",
  hobby: "취미/관심사",
};

export async function POST(req: Request) {
  try {
    const { q, limit = 10, useVector = false } = await req.json();
    if (!q || typeof q !== "string") return NextResponse.json({ error: "q required" }, { status: 400 });

    // 1) 텍스트 검색 - 자기소개, 일/직업, 취미/관심사 모두 검색
    const { data: rows, error: e1 } = await supabaseAdmin
      .from("profiles")
      .select("id,name,company,role,intro,work,hobby,tags")
      .order("updated_at", { ascending: false });

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const needle = q.toLowerCase();
    const textMatches =
      (rows || [])
        .map((row) => {
          const matches: string[] = [];
          
          // 각 필드별로 검색하고 매칭된 필드 기록
          if (row.name && typeof row.name === "string" && row.name.toLowerCase().includes(needle)) {
            matches.push("이름");
          }
          if (row.company && typeof row.company === "string" && row.company.toLowerCase().includes(needle)) {
            matches.push("회사");
          }
          if (row.role && typeof row.role === "string" && row.role.toLowerCase().includes(needle)) {
            matches.push("역할");
          }
          if (row.intro && typeof row.intro === "string" && row.intro.toLowerCase().includes(needle)) {
            matches.push("자기소개");
          }
          if (row.work && typeof row.work === "string" && row.work.toLowerCase().includes(needle)) {
            matches.push("일/직업");
          }
          if (row.hobby && typeof row.hobby === "string" && row.hobby.toLowerCase().includes(needle)) {
            matches.push("취미/관심사");
          }
          if (Array.isArray(row.tags)) {
            const tagMatches = row.tags.filter((tag: any) => 
              typeof tag === "string" && tag.toLowerCase().includes(needle)
            );
            if (tagMatches.length > 0) {
              matches.push("태그");
            }
          }

          return matches.length > 0 ? { ...row, matchedFields: matches } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .slice(0, limit);

    const profiles = (rows || []) as ProfileRow[];
    const profileLookup = new Map<string, ProfileRow>(profiles.map((row) => [row.id, row]));

    // 2) 벡터 검색 - 자기소개, 일/직업, 취미/관심사 각각 검색
    let vectorMatches: AggregatedVectorMatch[] = [];
    let introMatches: TypedVectorMatch[] = [];
    let workMatches: TypedVectorMatch[] = [];
    let hobbyMatches: TypedVectorMatch[] = [];

    if (useVector) {
      const queryEmbedding = await openai.embeddings.create({
        input: q,
        model: "text-embedding-3-large",
      });
      const queryVec = queryEmbedding.data[0].embedding;
      const pineconeIndex = getPineconeIndex();

      const queryByType = async (type: VectorType): Promise<RawTypedVectorMatch[]> => {
        const response = await pineconeIndex.query({
          vector: queryVec,
          topK: limit,
          includeMetadata: true,
          includeValues: false,
          filter: { vector_type: { $eq: type } },
        });

        return (response.matches || [])
          .map((match) => {
            const profileId = match.metadata?.profile_id;
            if (!profileId) return null;
            const similarity = typeof match.score === "number" ? match.score : undefined;
            const distance = similarity !== undefined ? 1 - similarity : undefined;

            return {
              profile_id: profileId,
              pinecone_id: match.id,
              distance,
              similarity,
              matchType: VECTOR_LABELS[type],
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
      };

      const [introMatchesRaw, workMatchesRaw, hobbyMatchesRaw] = await Promise.all([
        queryByType("intro"),
        queryByType("work"),
        queryByType("hobby"),
      ]);

      const attachProfile = (matches: RawTypedVectorMatch[]): TypedVectorMatch[] =>
        matches.map((match) => ({
          ...match,
          profile: profileLookup.get(match.profile_id) || null,
        }));

      introMatches = attachProfile(introMatchesRaw);
      workMatches = attachProfile(workMatchesRaw);
      hobbyMatches = attachProfile(hobbyMatchesRaw);

      const allVectorMatches = new Map<
        string,
        {
          profile_id: string;
          distance?: number;
          similarity?: number;
          matchTypes: string[];
        }
      >();

      const accumulate = (matchList: ReadonlyArray<TypedVectorMatch>) => {
        matchList.forEach((match) => {
          const profileId = match.profile_id;
          if (!profileId) return;
          const similarity =
            match.similarity !== undefined
              ? match.similarity
              : match.distance !== undefined
              ? 1 - match.distance
              : undefined;

          if (!allVectorMatches.has(profileId)) {
            allVectorMatches.set(profileId, {
              profile_id: profileId,
              distance: match.distance,
              similarity,
              matchTypes: [match.matchType],
            });
          } else {
            const existing = allVectorMatches.get(profileId)!;
            if (similarity !== undefined && (existing.similarity === undefined || similarity > existing.similarity)) {
              existing.similarity = similarity;
              existing.distance = match.distance;
            }
            if (!existing.matchTypes.includes(match.matchType)) {
              existing.matchTypes.push(match.matchType);
            }
          }
        });
      };

      accumulate(introMatches);
      accumulate(workMatches);
      accumulate(hobbyMatches);

      vectorMatches = Array.from(allVectorMatches.values())
        .sort((a, b) => {
          const simA =
            a.similarity !== undefined
              ? a.similarity
              : a.distance !== undefined
              ? 1 - a.distance
              : 0;
          const simB =
            b.similarity !== undefined
              ? b.similarity
              : b.distance !== undefined
              ? 1 - b.distance
              : 0;
          return simB - simA;
        })
        .slice(0, limit)
        .map((match) => ({
          ...match,
          profile: profileLookup.get(match.profile_id) || null,
        }));
    }

    return NextResponse.json({ 
      textMatches, 
      vectorMatches,
      introMatches: introMatches.slice(0, limit),
      workMatches: workMatches.slice(0, limit),
      hobbyMatches: hobbyMatches.slice(0, limit)
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
