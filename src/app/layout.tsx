import type { Metadata } from "next";
import { Geist, Playfair_Display, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const notoSerifKr = Noto_Serif_KR({ variable: "--font-noto-serif-kr", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "STAGE.ONE",
  description: "팬이 보는 무대와, 관계자가 만드는 무대.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${playfair.variable} ${notoSerifKr.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
