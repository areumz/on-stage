import type { NextConfig } from "next";

const supabaseHost = new URL(process.env.SUPABASE_URL!).hostname;

const nextConfig: NextConfig = {
  // 홈 디렉토리에 있는 다른 package-lock.json 때문에 작업 루트가 잘못 추론된다
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
