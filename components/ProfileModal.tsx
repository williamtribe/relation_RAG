"use client";
export default function ProfileModal({ profile, onClose }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "white", width: 600, maxHeight: "80vh", overflowY: "auto", borderRadius: 8, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>{profile.name}</h3>
            <div style={{ opacity: .7, marginTop: 4 }}>{profile.company} • {profile.role}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 0, width: 32, height: 32 }}>✕</button>
        </div>
        
        {profile.intro && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>메인 자기소개</h4>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{profile.intro}</p>
          </div>
        )}
        
        {profile.work && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>일 / 직업</h4>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{profile.work}</p>
          </div>
        )}
        
        {profile.hobby && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>취미 / 관심사</h4>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6 }}>{profile.hobby}</p>
          </div>
        )}
        
        {profile.tags && profile.tags.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {profile.tags.map((tag: string, i: number) => (
              <span key={i} style={{ fontSize: 12, background: "#f3f4f6", padding: "4px 8px", borderRadius: 6 }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}