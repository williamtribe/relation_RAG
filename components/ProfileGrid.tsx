"use client";
import { useEffect, useMemo, useState } from "react";
import ProfileModal from "./ProfileModal";

const CLUSTER_PREVIEW_LIMIT = 12;

type Profile = {
  id: string;
  name: string;
  company?: string;
  role?: string;
  intro?: string;
  hobby?: string; // 취미 소개
  work?: string; // 일/직업 소개
  tags?: string[];
  avatar_url?: string;
  updated_at?: string;
  likes?: string[]; // 자신에게 좋아요를 누른 사람들의 ID 배열
};
type SearchMatch = {
  id: string;
  name: string;
  company?: string;
  role?: string;
  intro?: string;
  work?: string;
  hobby?: string;
  matchedFields?: string[]; // 매칭된 필드 목록
};
type VectorMatch = { 
  profile_id: string; 
  distance?: number;
  similarity?: number; // 유사도 직접 저장
  matchTypes?: string[]; // 매칭된 타입 목록 (자기소개, 일/직업, 취미/관심사)
  profile?: Profile | null;
};
type IntroCluster = {
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
};

export default function ProfileGrid({
  currentUserName,
  currentProfileId,
  currentKakaoId,
}: {
  currentUserName: string;
  currentProfileId?: string | null;
  currentKakaoId?: string | null;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [aiPicks, setAiPicks] = useState<{
    intro: Array<{ profile_id: string; distance?: number }>;
    work: Array<{ profile_id: string; distance?: number }>;
    hobby: Array<{ profile_id: string; distance?: number }>;
  }>({ intro: [], work: [], hobby: [] });
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [resolvedUserId, setResolvedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [useVector, setUseVector] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [vectorMatches, setVectorMatches] = useState<VectorMatch[]>([]);
  const [introClusters, setIntroClusters] = useState<IntroCluster[]>([]);
  const [clusterLoading, setClusterLoading] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<number>>(() => new Set());
  const [selfDraft, setSelfDraft] = useState({
    name: "",
    company: "",
    role: "",
    intro: "",
    hobby: "",
    work: "",
    tagsText: "",
  });
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);
  const [basicSuccess, setBasicSuccess] = useState<string | null>(null);
  const [introSaving, setIntroSaving] = useState(false);
  const [introError, setIntroError] = useState<string | null>(null);
  const [introSuccess, setIntroSuccess] = useState<string | null>(null);

  async function fetchProfiles() {
    const r = await fetch("/api/profiles");
    const j = await r.json();
    setProfiles(j.data || []);
  }

  async function fetchLikes() {
    if (!resolvedUserId) return;
    const r = await fetch(`/api/likes?liker_id=${resolvedUserId}`);
    if (!r.ok) return;
    const j = await r.json();
    setLikedIds(new Set(j.ids || []));
  }

  async function fetchAIPicks() {
    if (!resolvedUserId) return;
    const r = await fetch("/api/ai-picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: resolvedUserId, limit: 4 })
    });
    if (!r.ok) {
      console.error("AI 픽 가져오기 실패:", r.status, await r.text());
      return;
    }
    const j = await r.json();
    console.log("AI 픽 응답:", j);
    setAiPicks({
      intro: j.intro || [],
      work: j.work || [],
      hobby: j.hobby || []
    });
  }
  const isAdmin = currentKakaoId === "4539688026";

  useEffect(() => { fetchProfiles(); }, []);
  useEffect(() => { fetchAIPicks(); }, [resolvedUserId]);
  useEffect(() => { fetchLikes(); }, [resolvedUserId]);
  useEffect(() => {
    if (isAdmin) {
      fetchIntroClusters();
    } else {
      setIntroClusters([]);
      setExpandedClusters(new Set());
    }
  }, [isAdmin]);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);
  const selfProfile = resolvedUserId ? profileMap.get(resolvedUserId) || null : null;

  const toggleClusterExpansion = (clusterId: number) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  };

  const openProfile = (profileId: string, fallback?: Partial<Profile>) => {
    const existing = profileMap.get(profileId);
    if (existing) {
      setSelected(existing);
      return;
    }
    if (fallback) {
      const safeName = fallback.name?.trim();
      const fallbackProfile: Profile = {
        id: profileId,
        name: safeName && safeName.length ? safeName : "이름 없음",
      };
      if (typeof fallback.company === "string" && fallback.company.trim()) {
        fallbackProfile.company = fallback.company;
      }
      if (typeof fallback.role === "string" && fallback.role.trim()) {
        fallbackProfile.role = fallback.role;
      }
      if (typeof fallback.intro === "string" && fallback.intro.trim()) {
        fallbackProfile.intro = fallback.intro;
      }
      if (typeof fallback.work === "string" && fallback.work.trim()) {
        fallbackProfile.work = fallback.work;
      }
      if (typeof fallback.hobby === "string" && fallback.hobby.trim()) {
        fallbackProfile.hobby = fallback.hobby;
      }
      if (Array.isArray(fallback.tags)) {
        fallbackProfile.tags = fallback.tags;
      }
      if (Array.isArray(fallback.likes)) {
        fallbackProfile.likes = fallback.likes;
      }
      if (typeof fallback.avatar_url === "string") {
        fallbackProfile.avatar_url = fallback.avatar_url;
      }
      if (typeof fallback.updated_at === "string") {
        fallbackProfile.updated_at = fallback.updated_at;
      }
      setSelected(fallbackProfile);
      return;
    }
    console.warn("프로필 정보를 찾을 수 없습니다:", profileId);
  };

  useEffect(() => {
    // currentProfileId가 있으면 우선 사용 (카카오 로그인한 경우)
    if (currentProfileId) {
      const profile = profiles.find((p) => p.id === currentProfileId);
      if (profile) {
        setResolvedUserId(currentProfileId);
        return;
      } else if (profiles.length > 0) {
        // 프로필 목록이 로드되었는데 currentProfileId를 찾지 못한 경우
        console.warn("프로필을 찾을 수 없습니다:", currentProfileId);
      }
    }
    
    // currentProfileId가 없거나 찾지 못한 경우 이름으로 찾기
    if (!currentUserName.trim()) {
      setResolvedUserId("");
      return;
    }
    const normalized = currentUserName.trim().toLowerCase();
    const matched = profiles.find((p) => (p.name || "").trim().toLowerCase() === normalized);
    setResolvedUserId(matched?.id || "");
  }, [currentUserName, currentProfileId, profiles]);

  useEffect(() => {
    if (selfProfile) {
      setSelfDraft({
        name: selfProfile.name || "",
        company: selfProfile.company || "",
        role: selfProfile.role || "",
        intro: selfProfile.intro || "",
        hobby: selfProfile.hobby || "",
        work: selfProfile.work || "",
        tagsText: (selfProfile.tags || []).join(", "),
      });
    } else if (currentUserName) {
      setSelfDraft((draft) => ({
        ...draft,
        name: currentUserName,
      }));
    }
  }, [selfProfile?.id, selfProfile?.updated_at, currentUserName]);

  // AI 픽 프로필들 (카테고리별로 분리)
  const introPickProfiles = aiPicks.intro
    .map(({ profile_id }) => profiles.find((p) => p.id === profile_id))
    .filter((p): p is Profile => Boolean(p));
  
  const workPickProfiles = aiPicks.work
    .map(({ profile_id }) => profiles.find((p) => p.id === profile_id))
    .filter((p): p is Profile => Boolean(p));
  
  const hobbyPickProfiles = aiPicks.hobby
    .map(({ profile_id }) => profiles.find((p) => p.id === profile_id))
    .filter((p): p is Profile => Boolean(p));

  // 내가 좋아요를 누른 사람들의 프로필
  const likedProfiles = Array.from(likedIds)
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is Profile => Boolean(p));

  // 나에게 좋아요를 누른 사람들의 프로필 (본인만 확인 가능)
  const likedByProfiles = useMemo(() => {
    if (!selfProfile?.likes || !Array.isArray(selfProfile.likes)) {
      return [];
    }
    const result = selfProfile.likes
      .map((id) => profileMap.get(id))
      .filter((p): p is Profile => Boolean(p));
    
    console.log("나에게 좋아요를 누른 사람들:", {
      likesIds: selfProfile.likes,
      foundProfiles: result.map(p => ({ id: p.id, name: p.name }))
    });
    
    return result;
  }, [selfProfile?.likes, profileMap]);

  const vectorMatchProfiles = vectorMatches.reduce<
    { profile: Profile; distance?: number; similarity?: number; matchTypes?: string[] }[]
  >((acc, { profile_id, profile, distance, similarity, matchTypes }) => {
    const resolvedProfile = profile || profileMap.get(profile_id);
    if (resolvedProfile) acc.push({ profile: resolvedProfile, distance, similarity, matchTypes });
    return acc;
  }, []);

  async function runSearch() {
    if (!searchQuery.trim()) {
      setSearchMatches([]);
      setVectorMatches([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchQuery.trim(), useVector }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "검색에 실패했습니다.");
      setSearchMatches(data?.textMatches || []);
      setVectorMatches(data?.vectorMatches || []);
    } catch (err: any) {
      setSearchError(err?.message || "검색 실패");
    } finally {
      setSearching(false);
    }
  }

  async function patchProfile(id: string, patch: Partial<Profile>) {
    const r = await fetch(`/api/profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok && patch.intro !== undefined) {
      await upsertEmbedding(id, patch.intro);
    }
    await fetchProfiles();
    await fetchAIPicks();
  }

  async function toggleLike(targetId: string, on: boolean) {
    if (!resolvedUserId) {
      console.warn("좋아요를 누르려면 먼저 로그인해주세요.");
      alert("좋아요를 누르려면 먼저 카카오 로그인을 해주세요.");
      return;
    }
    setLikedIds(prev => {
      const next = new Set(prev);
      if (on) next.add(targetId); else next.delete(targetId);
      return next;
    });
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liker_id: resolvedUserId, likee_id: targetId, on }),
    });
    
    const responseData = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      console.error("좋아요 업데이트 실패:", responseData);
      alert(`좋아요 업데이트 실패: ${responseData.error || "알 수 없는 오류"}`);
      // 실패 시 UI 상태 복원
      await fetchLikes();
    } else {
      console.log("좋아요 업데이트 성공:", responseData);
      // 성공 시에도 최신 상태로 갱신
      await fetchLikes();
      await fetchProfiles(); // 프로필 목록도 새로고침하여 likes 배열 업데이트
    }
  }

  async function fetchIntroClusters(options: { force?: boolean } = {}) {
    if (!isAdmin) {
      setClusterLoading(false);
      setIntroClusters([]);
      return;
    }
    setClusterLoading(true);
    setClusterError(null);
    try {
      const params = new URLSearchParams();
      if (options.force) params.set("force", "true");
      const query = params.toString();
      const res = await fetch(`/api/intro-clusters${query ? `?${query}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "클러스터링 정보를 불러오지 못했습니다.");
      setIntroClusters(data?.clusters || []);
    } catch (err: any) {
      setClusterError(err?.message || "클러스터링 정보를 불러오지 못했습니다.");
    } finally {
      setClusterLoading(false);
    }
  }

  function parseTags(text: string) {
    return text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function saveBasicProfile() {
    if (!resolvedUserId) {
      setBasicError("로그인이 필요합니다.");
      alert("프로필을 수정하려면 카카오 로그인이 필요합니다.");
      return;
    }
    const baseName = selfDraft.name.trim();
    if (!baseName) {
      setBasicError("이름을 입력해 주세요.");
      return;
    }
    setBasicSaving(true);
    setBasicError(null);
    setBasicSuccess(null);
    const payload = {
      name: baseName,
      company: selfDraft.company.trim(),
      role: selfDraft.role.trim(),
      tags: parseTags(selfDraft.tagsText),
    };

    try {
      if (selfProfile) {
        const patch: Partial<Profile> = {};
        if ((selfProfile.name || "").trim() !== payload.name) patch.name = payload.name;
        if ((selfProfile.company || "").trim() !== payload.company) patch.company = payload.company;
        if ((selfProfile.role || "").trim() !== payload.role) patch.role = payload.role;

        const existingTags = (selfProfile.tags || []).join(",");
        const nextTags = payload.tags.join(",");
        if (existingTags !== nextTags) patch.tags = payload.tags;

        if (!Object.keys(patch).length) {
          setBasicSuccess("변경 사항이 없습니다.");
          setBasicSaving(false);
          return;
        }

        await patchProfile(resolvedUserId, patch);
      } else {
        // 로그인하지 않은 경우 프로필 생성 불가
        throw new Error("프로필을 생성하려면 카카오 로그인이 필요합니다.");
      }
      setBasicSuccess("기본 정보가 저장되었습니다.");
    } catch (err: any) {
      setBasicError(err?.message || "저장 실패");
    } finally {
      setBasicSaving(false);
    }
  }

  async function saveIntroProfile() {
    if (!resolvedUserId) {
      setIntroError("로그인이 필요합니다.");
      alert("프로필을 수정하려면 카카오 로그인이 필요합니다.");
      return;
    }
    const workText = selfDraft.work.trim();
    const hobbyText = selfDraft.hobby.trim();
    const introText = selfDraft.intro.trim();
    
    // 메인 자기소개는 필수
    if (!introText) {
      setIntroError("메인 자기소개를 입력해 주세요.");
      return;
    }
    
    setIntroSaving(true);
    setIntroError(null);
    setIntroSuccess(null);

    try {
      if (selfProfile && resolvedUserId) {
        // 변경사항 확인
        const hasChanges = 
          (selfProfile.work || "") !== workText ||
          (selfProfile.hobby || "") !== hobbyText ||
          (selfProfile.intro || "") !== introText;
        
        if (!hasChanges) {
          setIntroSuccess("소개가 이미 최신입니다.");
          setIntroSaving(false);
          return;
        }
        
        // work, hobby, intro 모두 저장
        await patchProfile(resolvedUserId, { 
          work: workText,
          hobby: hobbyText,
          intro: introText
        });
        
        // 임베딩 생성: 전체(합친 것), 일, 취미 각각 별도로
        await upsertEmbedding(resolvedUserId, introText, workText, hobbyText);
        
        setIntroSuccess("소개/임베딩이 업데이트되었습니다.");
      } else {
        throw new Error("프로필을 찾을 수 없습니다. 로그인 상태를 확인해주세요.");
      }
    } catch (err: any) {
      setIntroError(err?.message || "저장 실패");
    } finally {
      setIntroSaving(false);
    }
  }

return (
    <div style={{ display: "grid", gap: 24 }}>
      {isAdmin && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>자기소개 클러스터링</h2>
            <button
              onClick={() => fetchIntroClusters({ force: true })}
              disabled={clusterLoading}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: clusterLoading ? "#f3f4f6" : "white",
                fontSize: 13,
                cursor: clusterLoading ? "not-allowed" : "pointer",
              }}
            >
              {clusterLoading ? "새로고침 중..." : "새로고침"}
            </button>
          </div>
          {clusterError && (
            <p style={{ marginTop: 8, color: "#dc2626", fontSize: 14 }}>{clusterError}</p>
          )}
          <div style={{ marginTop: 12 }}>
            {clusterLoading && introClusters.length === 0 && (
              <p style={{ fontSize: 14, color: "#6b7280" }}>클러스터를 계산하는 중입니다...</p>
            )}
            {!clusterLoading && introClusters.length === 0 && !clusterError && (
              <p style={{ fontSize: 14, color: "#6b7280" }}>
                아직 임베딩된 자기소개가 충분하지 않아 클러스터를 만들 수 없습니다.
              </p>
            )}
            {introClusters.length > 0 && (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {introClusters.map((cluster) => {
                  const isExpanded = expandedClusters.has(cluster.clusterId);
                  const previewMembers = cluster.members.slice(0, CLUSTER_PREVIEW_LIMIT);
                  const membersToRender = isExpanded ? cluster.members : previewMembers;
                  const remaining = cluster.members.length - membersToRender.length;
                  return (
                    <div
                      key={cluster.clusterId}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                        background: "#ffffff",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{cluster.label}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{cluster.size}명</div>
                      </div>
                      {cluster.keywords.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {cluster.keywords.map((keyword) => (
                            <span
                              key={keyword}
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: "#eef2ff",
                                color: "#3730a3",
                                fontWeight: 500,
                              }}
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {membersToRender.map((member) => {
                          const info = [member.company, member.role].filter(Boolean).join(" • ");
                          return (
                            <button
                              key={member.profile_id}
                              type="button"
                              onClick={() =>
                                openProfile(member.profile_id, {
                                  name: member.name ?? undefined,
                                  company: member.company ?? undefined,
                                  role: member.role ?? undefined,
                                  intro: member.introSnippet,
                                })
                              }
                              title={member.introSnippet}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid #d1d5db",
                                background: "#f9fafb",
                                fontSize: 12,
                                textAlign: "left",
                                cursor: "pointer",
                                lineHeight: 1.3,
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ fontWeight: 600, color: "#111827" }}>
                                {member.name || "이름 없음"}
                              </span>
                              {info && (
                                <span style={{ fontSize: 10, color: "#6b7280" }}>{info}</span>
                              )}
                            </button>
                          );
                        })}
                        {remaining > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleClusterExpansion(cluster.clusterId)}
                            style={{
                              fontSize: 12,
                              color: "#2563eb",
                              background: "transparent",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: 8,
                              cursor: "pointer",
                              textDecoration: "underline",
                              alignSelf: "center",
                            }}
                          >
                            +{remaining}명 더 보기
                          </button>
                        )}
                        {isExpanded && cluster.members.length > CLUSTER_PREVIEW_LIMIT && (
                          <button
                            type="button"
                            onClick={() => toggleClusterExpansion(cluster.clusterId)}
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              background: "transparent",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: 8,
                              cursor: "pointer",
                              alignSelf: "center",
                            }}
                          >
                            접기
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>내 정보</h2>
        {!resolvedUserId && (
          <p style={{ marginTop: 8, color: "#6b7280" }}>
            카카오 로그인을 하면 내 정보를 등록하거나 수정할 수 있습니다.
          </p>
        )}
        {resolvedUserId && (
          <div style={{ marginTop: 12, display: "grid", gap: 12, maxWidth: 720 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 200px", fontSize: 14 }}>
                이름
                <input
                  value={selfDraft.name}
                  onChange={(e) => setSelfDraft((d) => ({ ...d, name: e.target.value }))}
                  style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
                />
              </label>
              <label style={{ flex: "1 1 200px", fontSize: 14 }}>
                회사
                <input
                  value={selfDraft.company}
                  onChange={(e) => setSelfDraft((d) => ({ ...d, company: e.target.value }))}
                  style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
                />
              </label>
              <label style={{ flex: "1 1 200px", fontSize: 14 }}>
                직무
                <input
                  value={selfDraft.role}
                  onChange={(e) => setSelfDraft((d) => ({ ...d, role: e.target.value }))}
                  style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
                />
              </label>
            </div>
            <label style={{ fontSize: 14 }}>
              태그 (쉼표로 구분)
              <input
                value={selfDraft.tagsText}
                onChange={(e) => setSelfDraft((d) => ({ ...d, tagsText: e.target.value }))}
                style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
              />
            </label>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={saveBasicProfile}
                disabled={basicSaving}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                {basicSaving ? "저장 중..." : selfProfile ? "기본 정보 수정" : "기본 정보 등록"}
              </button>
              {basicError && <span style={{ color: "#dc2626" }}>{basicError}</span>}
              {basicSuccess && <span style={{ color: "#16a34a" }}>{basicSuccess}</span>}
            </div>
            <hr style={{ margin: "12px 0", border: "none", borderBottom: "1px solid #e5e7eb" }} />
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>메인 자기소개</span>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>(전체적인 자기소개)</span>
                </div>
                <textarea
                  value={selfDraft.intro}
                  onChange={(e) => setSelfDraft((d) => ({ ...d, intro: e.target.value }))}
                  placeholder="자신에 대해 자유롭게 소개해주세요."
                  rows={5}
                  style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
                />
              </label>
              <label style={{ fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>일 / 직업</span>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>(업무, 직업, 일에 대한 이야기)</span>
                </div>
                <textarea
                  value={selfDraft.work}
                  onChange={(e) => setSelfDraft((d) => ({ ...d, work: e.target.value }))}
                  placeholder="예: 현재 키이스트에서 산업공학을 전공하고 있어요. 데이터 분석과 프로세스 개선에 관심이 많습니다."
                  rows={4}
                  style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
                />
              </label>
              <label style={{ fontSize: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>취미 / 관심사</span>
                  <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 400 }}>(취미, 관심사, 즐거운 이야기)</span>
                </div>
                <textarea
                  value={selfDraft.hobby}
                  onChange={(e) => setSelfDraft((d) => ({ ...d, hobby: e.target.value }))}
                  placeholder="예: 주말에는 등산을 즐기고, 요리하는 걸 좋아해요. 최근에는 와인에 관심이 생겼습니다."
                  rows={4}
                  style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={saveIntroProfile}
                disabled={introSaving}
                style={{
                  padding: "8px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "#111827",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                {introSaving ? "업데이트 중..." : "소개 / 임베딩 업데이트"}
              </button>
              {introError && <span style={{ color: "#dc2626" }}>{introError}</span>}
              {introSuccess && <span style={{ color: "#16a34a" }}>{introSuccess}</span>}
            </div>
            
            {/* 나에게 좋아요를 누른 사람들 (본인만 확인 가능) */}
            {selfProfile && (
              <div style={{ marginTop: 16, padding: 16, background: "#f9fafb", borderRadius: 8 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  나에게 좋아요를 누른 사람들
                  {likedByProfiles.length > 0 && ` (${likedByProfiles.length})`}
                </h3>
                {likedByProfiles.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                    {likedByProfiles.map(p => (
                      <button
                        key={p.id}
                        onClick={() => openProfile(p.id, p)}
                        style={{ 
                          border: "1px solid #e5e7eb", 
                          borderRadius: 6, 
                          padding: 12, 
                          textAlign: "left", 
                          background: "white",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#2563eb";
                          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "#e5e7eb";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {p.avatar_url ? (
                            <img 
                              src={p.avatar_url} 
                              alt={p.name}
                              style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#6b7280" }}>
                              {p.name?.[0]?.toUpperCase() || "?"}
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{p.name || "이름 없음"}</div>
                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2, color: "#6b7280" }}>
                              {[p.company, p.role].filter(Boolean).join(" • ") || "정보 없음"}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                    아직 좋아요를 누른 사람이 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>검색</h2>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={searchQuery}
            placeholder="이름, 소개 등으로 검색"
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            style={{ flex: "1 1 280px", border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
          />
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={useVector} onChange={(e) => setUseVector(e.target.checked)} />
            AI 벡터 검색
          </label>
          <button
            onClick={runSearch}
            disabled={searching}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background: "#111827",
              color: "white",
            }}
          >
            {searching ? "검색중..." : "검색"}
          </button>
        </div>
        {searchError && <p style={{ color: "#dc2626", marginTop: 8 }}>{searchError}</p>}
        {searchMatches.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>텍스트 검색 결과</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {searchMatches.map((match) => {
                return (
                  <button
                    key={match.id}
                    onClick={() =>
                      openProfile(match.id, {
                        name: match.name,
                        company: match.company,
                        role: match.role,
                        intro: match.intro,
                        work: match.work,
                        hobby: match.hobby,
                      })
                    }
                    style={{ 
                      border: "1px solid #e5e7eb", 
                      borderRadius: 8, 
                      padding: 12, 
                      textAlign: "left",
                      background: "white",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#2563eb";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{match.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                      {[match.company, match.role].filter(Boolean).join(" • ") || "정보 없음"}
                    </div>
                    {match.matchedFields && match.matchedFields.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {match.matchedFields.map((field) => (
                          <span
                            key={field}
                            style={{
                              fontSize: 11,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "#dbeafe",
                              color: "#1e40af",
                              fontWeight: 500,
                            }}
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                    <p style={{ marginTop: 8, fontSize: 12, color: "#4b5563", lineHeight: 1.4 }}>
                      {(match.intro || match.work || match.hobby || "").slice(0, 80)}
                      {((match.intro || match.work || match.hobby || "").length > 80) && "..."}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {useVector && vectorMatchProfiles.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>AI 벡터 검색 결과</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {vectorMatchProfiles.map(({ profile, distance, similarity, matchTypes }) => (
                <button
                  key={profile.id}
                  onClick={() => openProfile(profile.id, profile)}
                  style={{ 
                    border: "1px solid #e5e7eb", 
                    borderRadius: 8, 
                    padding: 12, 
                    textAlign: "left",
                    background: "white",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#2563eb";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{profile.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    {[profile.company, profile.role].filter(Boolean).join(" • ") || "정보 없음"}
                  </div>
                  {matchTypes && matchTypes.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {matchTypes.map((type) => (
                        <span
                          key={type}
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "#fef3c7",
                            color: "#92400e",
                            fontWeight: 500,
                          }}
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  )}
                  {typeof similarity === "number" ? (
                    <div style={{ fontSize: 11, marginTop: 6, color: "#6b7280" }}>
                      유사도: {Math.abs(similarity).toFixed(3)}
                    </div>
                  ) : typeof distance === "number" ? (
                    <div style={{ fontSize: 11, marginTop: 6, color: "#6b7280" }}>
                      유사도: {Math.abs(1 - distance).toFixed(3)}
                    </div>
                  ) : null}
                  <p style={{ marginTop: 8, fontSize: 12, color: "#4b5563", lineHeight: 1.4 }}>
                    {(profile.intro || profile.work || profile.hobby || "").slice(0, 80)}
                    {((profile.intro || profile.work || profile.hobby || "").length > 80) && "..."}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {resolvedUserId && (introPickProfiles.length > 0 || workPickProfiles.length > 0 || hobbyPickProfiles.length > 0) && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>AI 추천</h2>
          <div style={{ display: "grid", gap: 24 }}>
            {introPickProfiles.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  자기소개가 비슷한 사람들
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {introPickProfiles.map(p => (
                    <button 
                      key={p.id} 
                      style={{ 
                        border: "1px solid #e5e7eb", 
                        borderRadius: 8, 
                        padding: 12, 
                        textAlign: "left",
                        background: "white",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }} 
                      onClick={() => openProfile(p.id, p)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#2563eb";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{p.company} • {p.role}</div>
                      {p.intro && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>
                          {(p.intro || "").slice(0, 60)}{p.intro.length > 60 ? "..." : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {workPickProfiles.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  일/직업이 비슷한 사람들
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {workPickProfiles.map(p => (
                    <button 
                      key={p.id} 
                      style={{ 
                        border: "1px solid #e5e7eb", 
                        borderRadius: 8, 
                        padding: 12, 
                        textAlign: "left",
                        background: "white",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }} 
                      onClick={() => openProfile(p.id, p)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#2563eb";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{p.company} • {p.role}</div>
                      {p.work && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>
                          {(p.work || "").slice(0, 60)}{p.work.length > 60 ? "..." : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {hobbyPickProfiles.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  취미/관심사가 비슷한 사람들
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {hobbyPickProfiles.map(p => (
                    <button 
                      key={p.id} 
                      style={{ 
                        border: "1px solid #e5e7eb", 
                        borderRadius: 8, 
                        padding: 12, 
                        textAlign: "left",
                        background: "white",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }} 
                      onClick={() => openProfile(p.id, p)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#2563eb";
                        e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#e5e7eb";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{p.company} • {p.role}</div>
                      {p.hobby && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>
                          {(p.hobby || "").slice(0, 60)}{p.hobby.length > 60 ? "..." : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
      </div>
    </section>
  )}

  {resolvedUserId && likedProfiles.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>내가 좋아요를 누른 사람들</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
            {likedProfiles.map(p => (
              <button 
                key={p.id} 
                style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, textAlign: "left" }} 
                onClick={() => openProfile(p.id, p)}
              >
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: .7 }}>{p.company} • {p.role}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>모임 멤버</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
          {profiles.map((p) => (
            <div key={p.id} onClick={() => openProfile(p.id, p)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={p.name || "avatar"}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      objectFit: "cover",
                      background: "#f3f4f6",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#6b7280",
                    }}
                  >
                    {p.name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <Inline value={p.name} onChange={(v) => patchProfile(p.id, { name: v })} bold />
                  <div style={{ fontSize: 12, opacity: .7 }}>
                    <Inline value={[p.company, p.role].filter(Boolean).join(" • ")} onChange={(v) => {
                      const [company, role] = v.split("•").map(s => s.trim());
                      patchProfile(p.id, { company, role });
                    }} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 14 }}>
                {p.intro && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>메인 자기소개</div>
                    <div style={{ fontSize: 13 }}>{(p.intro || "").slice(0, 120)}{p.intro && p.intro.length > 120 ? "..." : ""}</div>
                  </div>
                )}
                {p.work && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>일 / 직업</div>
                    <div style={{ fontSize: 13 }}>{(p.work || "").slice(0, 80)}{p.work && p.work.length > 80 ? "..." : ""}</div>
                  </div>
                )}
                {p.hobby && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>취미 / 관심사</div>
                    <div style={{ fontSize: 13 }}>{(p.hobby || "").slice(0, 80)}{p.hobby && p.hobby.length > 80 ? "..." : ""}</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <TagRow tags={p.tags || []} onChange={(tags) => patchProfile(p.id, { tags })} />
                <Like
                  isOn={likedIds.has(p.id)}
                  onToggle={(on) => toggleLike(p.id, on)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {selected && <ProfileModal profile={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Inline({ value, onChange, bold }: { value: string; onChange: (v: string) => void; bold?: boolean }) {
  return (
    <input defaultValue={value} onBlur={(e) => e.target.value !== value && onChange(e.target.value)} style={{ border: "none", borderBottom: "1px solid transparent", outline: "none", fontWeight: bold ? 600 : 400 }} />
  );
}
function InlineArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea defaultValue={value} rows={3} onBlur={(e) => e.target.value !== value && onChange(e.target.value)} style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }} />
  );
}
function TagRow({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [local, setLocal] = useState(tags);
  useEffect(() => setLocal(tags), [tags]);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {local.map((t, i) => (
        <span key={i} style={{ fontSize: 12, background: "#f3f4f6", padding: "2px 6px", borderRadius: 6 }}>{t}</span>
      ))}
      <input placeholder="+tag" style={{ fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, padding: "2px 6px" }} onKeyDown={(e) => {
        if (e.key === "Enter") {
          const v = (e.target as HTMLInputElement).value.trim();
          if (v) { const next = [...local, v]; setLocal(next); onChange(next); (e.target as HTMLInputElement).value = ""; }
        }
      }} />
    </div>
  );
}
function Like({ isOn, onToggle }: { isOn: boolean; onToggle: (on: boolean) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(!isOn); }}
      style={{ fontSize: 14, color: isOn ? "#ef4444" : "#9ca3af" }}
    >
      ♥
    </button>
  );
}
async function upsertEmbedding(profileId: string, intro?: string, work?: string, hobby?: string) {
  await fetch("/api/embeddings/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      profile_id: profileId, 
      intro: intro || "",
      work: work || "",
      hobby: hobby || ""
    }),
  });
}
