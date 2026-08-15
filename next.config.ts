import type { NextConfig } from "next";

const supabaseHost = new URL(process.env.SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  // 홈 디렉토리에 있는 다른 package-lock.json 때문에 작업 루트가 잘못 추론된다
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }],
  },
  // three의 배포 파일이 ES2022 static 블록 등 최신 문법을 그대로 포함하고 있어 Next의 컴파일
  // 파이프라인을 거치지 않으면 구형 브라우저에서 파싱 자체가 깨진다. Next 16 기본 지원 최저선인
  // Safari 16.4+에도 안전망이 되는 저비용 수정이라 넣는다.
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
