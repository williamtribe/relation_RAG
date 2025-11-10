"use client";
export default function ProfileModal({ profile, onClose }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "white", width: 600, borderRadius: 8, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{profile.name}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div style={{ opacity: .7, marginTop: 4 }}>{profile.company} • {profile.role}</div>
        <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{profile.intro}</p>
      </div>
    </div>
  );
}