"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const MENU = [
  { label: "대시보드", href: "/staff/dashboard" },
  { label: "투어 일정", href: "/staff/tours" },
  { label: "무대 연출", href: "/staff/stage" },
  { label: "아티스트", href: "/staff/artists" },
  { label: "티켓 현황", href: "/staff/tickets" },
];

async function handleLogout() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/staff/login";
}

// 데스크톱 <aside>와 모바일 드로워 패널이 공유하는 내용 — 메뉴·로그아웃을 두 군데서
// 따로 유지하지 않는다. onNavigate는 드로워에서 링크 클릭 시 드로워를 닫는 용도(데스크톱은 불필요).
function SidebarNav({ roleLabel, pathname, onNavigate }: { roleLabel: string; pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-md bg-brand" />
          <span className="font-bold text-gray-900">STAGE.ONE</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">관계자 전용 · {roleLabel}</p>
      </div>
      <nav aria-label="관계자 메뉴" className="mt-2 flex flex-col">
        {MENU.map((m) => {
          const active = pathname === m.href;
          return (
            <Link
              key={m.href}
              href={m.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`border-l-4 px-6 py-3 text-sm ${
                active
                  ? "border-brand bg-brand/10 font-medium text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              {m.label}
            </Link>
          );
        })}
      </nav>
      <button type="button" onClick={handleLogout} className="mt-auto px-6 py-4 text-left text-sm text-gray-500 hover:text-gray-900">
        로그아웃
      </button>
    </>
  );
}

export default function Sidebar({ roleLabel }: { roleLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* md 미만: 햄버거 헤더 바 */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-surface-2 px-4 py-3 md:hidden">
        <span className="font-bold text-gray-900">STAGE.ONE</span>
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
            <path d="M3 5h14v1.5H3V5zm0 4.25h14v1.5H3v-1.5zM3 13.5h14V15H3v-1.5z" />
          </svg>
        </button>
      </div>

      {/* md 미만: 오버레이 드로워 */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface-2">
            <SidebarNav roleLabel={roleLabel} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* md 이상: 기존 고정 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-gray-200 bg-surface-2 md:flex">
        <SidebarNav roleLabel={roleLabel} pathname={pathname} />
      </aside>
    </>
  );
}
