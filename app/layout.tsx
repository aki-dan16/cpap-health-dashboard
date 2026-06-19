import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CPAP Health Dashboard",
  description: "CPAP治療・血液検査・体重の統合ヘルスダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-[#0f0f0f] text-gray-100">{children}</body>
    </html>
  );
}
