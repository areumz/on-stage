import Link from "next/link";
import TabToggle from "@/components/common/TabToggle";
import { getStaffRole } from "@/lib/data";

// 무대 연출 디렉터 화면 공통 껍데기. /staff/stage 처럼 콘솔 사이드바 밖의 다크 화면이다.
// /staff/* 로그인 가드는 src/proxy.ts 가 이미 맡는다.
export default async function DirectorLayout({ children }: { children: React.ReactNode }) {
  const { label: roleLabel } = await getStaffRole();
  return (
    <main className="min-h-screen bg-bg-dark text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-12 md:py-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <Link href="/staff/dashboard" className="text-sm text-white/60 hover:text-white">
            ← 대시보드 <span className="text-white/90">/ 무대 연출 디렉터</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="shrink-0 whitespace-nowrap text-xs text-white/50">{roleLabel}</span>
            <TabToggle dark />
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
