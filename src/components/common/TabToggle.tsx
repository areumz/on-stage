"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TabToggle({ dark = false }: { dark?: boolean }) {
  const isStaff = usePathname().startsWith("/staff");
  const isFans = !isStaff;
  const base = "px-4 py-1.5 text-sm transition-colors";
  const active = "bg-brand text-white";
  const idle = dark
    ? "text-white/60 hover:text-white"
    : "text-gray-600 hover:text-gray-900";

  return (
    <div
      className={`flex items-center overflow-hidden rounded-full border ${
        dark ? "border-white/30" : "border-gray-300"
      }`}
    >
      <Link
        href="/"
        aria-current={isFans ? "true" : undefined}
        className={`${base} ${isFans ? active : idle}`}
      >
        A · Fans
      </Link>
      <Link
        href="/staff/dashboard"
        aria-current={isStaff ? "true" : undefined}
        className={`${base} ${isStaff ? active : idle}`}
      >
        B · Staff
      </Link>
    </div>
  );
}
