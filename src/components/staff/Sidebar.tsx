"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { label: "대시보드", href: "/staff/dashboard" },
  { label: "투어 일정", href: "/staff/tours" },
  { label: "무대 연출", href: "/staff/stage" },
  { label: "아티스트", href: "/staff/artists" },
  { label: "티켓 현황", href: "/staff/tickets" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-surface-2">
      <div className="px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-6 rounded-md bg-brand" />
          <span className="font-bold text-gray-900">STAGE.ONE</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">관계자 전용</p>
      </div>
      <nav aria-label="관계자 메뉴" className="mt-2 flex flex-col">
        {MENU.map((m) => {
          const active = pathname === m.href;
          return (
            <Link
              key={m.href}
              href={m.href}
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
    </aside>
  );
}
