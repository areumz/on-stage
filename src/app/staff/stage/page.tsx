import Link from "next/link";

// ponytail: Task 9(무대 연출 3D 툴)가 이 자리를 실제 R3F 씬 + 컨트롤 패널로 교체한다.
// 브레드크럼 구조는 설계 5.3 그대로라 Task 9에서 그대로 살아남는다.
export default function StagePage() {
  return (
    <main className="flex min-h-screen flex-col bg-bg-dark text-white">
      <div className="flex items-center justify-between px-8 py-5">
        <Link href="/staff/dashboard" className="text-sm text-white/60 hover:text-white">
          ← 대시보드 <span className="text-white/90">/ 무대 연출</span>
        </Link>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="h-16 w-16 rounded-full bg-brand/60 ring-8 ring-brand/20" />
        <h1 className="mt-8 text-2xl font-bold">무대 연출 3D 툴</h1>
        <p className="mt-3 text-white/70">
          조명 프리셋 · 스팟 on/off · 카메라 앵글 컨트롤이 들어올 자리입니다.
        </p>
        <p className="mt-1 text-sm text-brand-soft">다음 태스크에서 구현 예정</p>
      </div>
    </main>
  );
}
