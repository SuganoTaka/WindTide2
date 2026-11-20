import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WindTide — 潮見帖フォーキャスト",
  description:
    "全国3,925の漁港・港湾を選び、風（風向・風速・突風）と潮位（タイドグラフ・満干潮・潮回り）を週間・月間で確認。CSV・PDFで持ち出せる予報アプリです。",
  keywords: ["漁港", "潮汐", "タイドグラフ", "風予報", "満潮", "干潮", "潮回り"],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ecefe6",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
