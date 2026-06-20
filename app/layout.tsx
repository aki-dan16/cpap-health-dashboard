import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

// [34] 日本語フォント Noto Sans JP
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

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
    <html
      lang="ja"
      className={`${notoSansJp.variable} h-full antialiased`}
    >
      <body className={`${notoSansJp.className} min-h-full bg-[#0f0f0f] text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
