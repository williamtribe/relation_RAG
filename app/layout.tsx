import type { ReactNode } from "react";

export const metadata = { title: "낙성대 회동" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 40, fontFamily: "sans-serif" }}>{children}</body>
    </html>
  );
}
