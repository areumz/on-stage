import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 디렉토리에 있는 다른 package-lock.json 때문에 작업 루트가 잘못 추론된다
  turbopack: { root: process.cwd() },
};

export default nextConfig;
