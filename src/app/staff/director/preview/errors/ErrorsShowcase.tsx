"use client";

import { useState } from "react";
import ErrorPanel from "@/components/director/ErrorPanel";
import { ERROR_COPY } from "@/lib/python/errors";

export default function ErrorsShowcase() {
  const keys = Object.keys(ERROR_COPY);
  const [code, setCode] = useState(keys[0]);
  const [last, setLast] = useState("(없음)");
  const [busy, setBusy] = useState(false);
  const [since, setSince] = useState(() => Date.now());

  return (
    <main className="min-h-screen bg-bg-dark p-4 text-white md:p-8">
      <div className="mb-6 flex flex-wrap gap-2">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === code}
            onClick={() => {
              setCode(k);
              setSince(Date.now());
            }}
            className={`rounded-full px-3 py-1.5 text-xs ${k === code ? "bg-brand text-white" : "border border-white/25 text-white/70"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={busy} onChange={(e) => setBusy(e.target.checked)} /> busy
      </label>
      <button type="button" onClick={() => setSince(Date.now())} className="mb-4 rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white/80">
        같은 오류 다시 발생
      </button>
      <ErrorPanel code={code} since={since} busy={busy} onAction={setLast} />
      <p className="mt-4 text-sm text-white/70">마지막 action: {last}</p>
    </main>
  );
}
