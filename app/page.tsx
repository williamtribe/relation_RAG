"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const ProfileGrid = dynamic(() => import("../components/ProfileGrid"), {
  ssr: false,
});

export default function Page() {
  const [currentUserName, setCurrentUserName] = useState("");

  return (
    <div>
      <h1>Relation RAG</h1>
      <div style={{ margin: "16px 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 14, flex: "1 1 280px" }}>
          내 이름
          <input
            value={currentUserName}
            onChange={(e) => setCurrentUserName(e.target.value)}
            placeholder="예: 홍길동"
            style={{ width: "100%", marginTop: 4, border: "1px solid #e5e7eb", borderRadius: 6, padding: 8 }}
          />
        </label>
        <p style={{ fontSize: 13, color: "#6b7280", maxWidth: 340 }}>
          입력한 이름과 프로필 목록을 매칭해 내 정보를 자동으로 찾거나 새 프로필을 만들 수 있습니다.
        </p>
      </div>
      <ProfileGrid currentUserName={currentUserName.trim()} />
    </div>
  );
}
