"use client";
import { useEffect, useMemo, useState } from "react";
import ProfileModal from "./ProfileModal";

type Profile = {
  id: string;
  name: string;
  company?: string;
  role?: string;
  intro?: string;
  tags?: string[];
  avatar_url?: string;
  updated_at?: string;
};
type SearchMatch = {
  id: string;
  name: string;
  company?: string;
  role?: string;
  intro?: string;
};
type VectorMatch = { profile_id: string; distance?: number };

export default function ProfileGrid({ currentUserName }: { currentUserName: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [aiPickIds, setAiPickIds] = useState<string[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [resolvedUserId, setResolvedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [useVector, setUseVector] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [vectorMatches, setVectorMatches] = useState<VectorMatch[]>([]);
  const [selfDraft, setSelfDraft] = useState({
    name: "",
    company: "",
    role: "",
    intro: "",
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
      body: JSON.stringify({ profile_id: resolvedUserId, limit: 6 })
    });
    if (!r.ok) return;
    const j = await r.json();
    const ids = Array.isArray(j.ids)
      ? j.ids
      : ((j.data || []).map((x: any) => x.profile_id));
    setAiPickIds(ids);
  }
  useEffect(() => { fetchProfiles(); }, []);
  useEffect(() => { fetchAIPicks(); }, [resolvedUserId]);
  useEffect(() => { fetchLikes(); }, [resolvedUserId]);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);
  const selfProfile = resolvedUserId ? profileMap.get(resolvedUserId) || null : null;

  useEffect(() => {
    if (!currentUserName.trim()) {
      setResolvedUserId("");
      return;
    }
    const normalized = currentUserName.trim().toLowerCase();
    const matched = profiles.find((p) => (p.name || "").trim().toLowerCase() === normalized);
    setResolvedUserId(matched?.id || "");
  }, [currentUserName, profiles]);

  useEffect(() => {
    if (selfProfile) {
      setSelfDraft({
        name: selfProfile.name || "",
        company: selfProfile.company || "",
        role: selfProfile.role || "",
        intro: selfProfile.intro || "",
        tagsText: (selfProfile.tags || []).join(", "),
      });
    } else if (currentUserName) {
      setSelfDraft((draft) => ({
        ...draft,
        name: currentUserName,
      }));
    }
  }, [selfProfile?.id, selfProfile?.updated_at, currentUserName]);

  const aiPickProfiles = aiPickIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is Profile => Boolean(p))
    .slice(0, 6);

  const vectorMatchProfiles = vectorMatches.reduce<{ profile: Profile; distance?: number }[]>(
    (acc, { profile_id, distance }) => {
      const profile = profileMap.get(profile_id);
      if (profile) acc.push({ profile, distance });
      return acc;
    },
    []
  );

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
    if (!resolvedUserId) return;
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
    if (!res.ok) {
      await fetchLikes();
    }
  }

  function parseTags(text: string) {
    return text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function saveBasicProfile() {
    const baseName = (selfDraft.name || currentUserName).trim();
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
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "프로필 생성 실패");
        const newId = data?.data?.id;
        if (newId) {
          setResolvedUserId(newId);
        }
        await fetchProfiles();
        await fetchAIPicks();
      }
      setBasicSuccess("기본 정보가 저장되었습니다.");
    } catch (err: any) {
      setBasicError(err?.message || "저장 실패");
    } finally {
      setBasicSaving(false);
    }
  }

  async function saveIntroProfile() {
    const introText = selfDraft.intro.trim();
    if (!introText) {
      setIntroError("소개를 입력해 주세요.");
      return;
    }
    setIntroSaving(true);
    setIntroError(null);
    setIntroSuccess(null);

    try {
      if (selfProfile && resolvedUserId) {
        if ((selfProfile.intro || "").trim() === introText) {
          setIntroSuccess("소개가 이미 최신입니다.");
          setIntroSaving(false);
          return;
        }
        await patchProfile(resolvedUserId, { intro: introText });
      } else {
        const baseName = (selfDraft.name || currentUserName).trim();
        if (!baseName) throw new Error("먼저 이름을 입력해 주세요.");
        const payload = {
          name: baseName,
          company: selfDraft.company.trim(),
          role: selfDraft.role.trim(),
          intro: introText,
          tags: parseTags(selfDraft.tagsText),
        };
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "프로필 생성 실패");
        const newId = data?.data?.id;
        if (newId) {
          setResolvedUserId(newId);
          await upsertEmbedding(newId, introText);
        }
        await fetchProfiles();
        await fetchAIPicks();
      }
      setIntroSuccess("소개/임베딩이 업데이트되었습니다.");
    } catch (err: any) {
      setIntroError(err?.message || "저장 실패");
    } finally {
      setIntroSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>내 정보</h2>
        {!currentUserName && (
          <p style={{ marginTop: 8, color: "#6b7280" }}>
            상단에서 이름을 입력하면 내 정보를 등록하거나 수정할 수 있습니다.
          </p>
        )}
        {currentUserName && (
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
            <label style={{ fontSize: 14 }}>
              소개
              <textarea
                value={selfDraft.intro}
                onChange={(e) => setSelfDraft((d) => ({ ...d, intro: e.target.value }))}
                rows={5}
                style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
              />
            </label>
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
              {searchMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => setSelected(profileMap.get(match.id) || null)}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, textAlign: "left" }}
                >
                  <div style={{ fontWeight: 600 }}>{match.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {[match.company, match.role].filter(Boolean).join(" • ")}
                  </div>
                  <p style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>
                    {(match.intro || "").slice(0, 80)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        {useVector && vectorMatchProfiles.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>벡터 추천 결과</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {vectorMatchProfiles.map(({ profile, distance }) => (
                <button
                  key={profile.id}
                  onClick={() => setSelected(profile)}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, textAlign: "left" }}
                >
                  <div style={{ fontWeight: 600 }}>{profile.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {[profile.company, profile.role].filter(Boolean).join(" • ")}
                  </div>
                  {typeof distance === "number" && (
                    <div style={{ fontSize: 12, marginTop: 4, color: "#6b7280" }}>
                      거리: {distance.toFixed(3)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>AI 픽</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
          {aiPickProfiles.map(p => (
              <button key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, textAlign: "left" }} onClick={() => setSelected(p)}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: .7 }}>{p.company} • {p.role}</div>
              </button>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>모임 멤버</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 8 }}>
          {profiles.map(p => (
            <div key={p.id} onClick={() => setSelected(p)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, background: "#eee" }} />
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
                <InlineArea value={p.intro || ""} onChange={(v) => patchProfile(p.id, { intro: v })} />
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
  async function upsertEmbedding(profileId: string, intro?: string) {
    if (!intro) return;
    await fetch("/api/embeddings/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: profileId, intro }),
    });
  }
