import type { Metadata } from "next";
import { Geist, Playfair_Display, Noto_Serif_KR } from "next/font/google";
import HydrationSignal from "@/components/common/HydrationSignal";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const notoSerifKr = Noto_Serif_KR({ variable: "--font-noto-serif-kr", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "STAGE.ONE",
  description: "팬이 보는 무대와, 관계자가 만드는 무대.",
};

// 구형 브라우저가 앱 번들 파싱 자체에 실패하면(예: 최신 문법) 리액트가 아예 못 켜져서
// hydration이 안 되고, 에러 바운더리를 포함한 어떤 리액트 컴포넌트도 이 상황을 잡을 수 없다.
// 그래서 Next가 번들링하는 코드보다 먼저 실행되는 순수 인라인 스크립트로 안전망을 둔다 —
// ES5만 써서 이 스크립트 자체가 파싱 실패할 여지를 없앤다. HydrationSignal이 정상 마운트되면
// window.__appHydrated가 true가 되어 이후의 무관한 런타임 에러에는 반응하지 않는다.
const HYDRATION_GUARD_SCRIPT = `(function () {
  var shown = false;
  function showFallback() {
    if (window.__appHydrated || shown) return;
    shown = true;
    var el = document.createElement("div");
    el.id = "browser-support-banner";
    el.setAttribute("style",
      "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
      "background:#1a1533;color:#fff;padding:14px 20px;" +
      "font-family:-apple-system,BlinkMacSystemFont,sans-serif;" +
      "font-size:14px;text-align:center;line-height:1.5;");
    el.textContent = "이 브라우저에서는 일부 콘텐츠가 정상적으로 표시되지 않을 수 있습니다. " +
      "Chrome 최신 버전 또는 Safari 16.4 이상에서 다시 시도해주세요.";
    if (document.body) document.body.insertBefore(el, document.body.firstChild);
  }
  window.addEventListener("error", showFallback);
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${playfair.variable} ${notoSerifKr.variable} h-full antialiased`}
    >
      <head>
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: HYDRATION_GUARD_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <HydrationSignal />
        {children}
      </body>
    </html>
  );
}
