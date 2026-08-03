"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Header from "@/components/common/Header";

export default function LoginPage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    });
    if (res.ok) router.push("/staff/dashboard");
    else setError(true);
  }

  return (
    <main className="flex min-h-screen flex-col bg-surface-1 text-gray-900">
      <Header />
      <div className="flex flex-1 items-start justify-center pt-16">
        <form onSubmit={onSubmit} className="w-96 rounded-2xl border border-gray-200 bg-surface-2 p-8 shadow-sm">
          <p className="text-center text-lg font-semibold">🔒 관계자 로그인</p>
          <p className="mt-1 text-center text-sm text-gray-500">투어 운영 및 무대 연출 시스템</p>
          <label htmlFor="staff-id" className="mt-8 block text-sm text-gray-600">아이디</label>
          <input
            id="staff-id"
            name="id"
            autoComplete="username"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="staff.id"
            className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand"
          />
          <label htmlFor="staff-password" className="mt-4 block text-sm text-gray-600">비밀번호</label>
          <input
            id="staff-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-brand"
          />
          {error && <p className="mt-3 text-sm text-red-500">아이디 또는 비밀번호가 올바르지 않습니다.</p>}
          <button type="submit" className="mt-6 w-full rounded-lg bg-brand py-3 font-medium text-white hover:opacity-90">
            로그인
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">Demo account · admin / 1234</p>
        </form>
      </div>
    </main>
  );
}
