"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import SectionConfirm from "@/components/director/SectionConfirm";
import type { ApiError } from "@/lib/director/api";
import type { ConfirmSectionsInterrupt, SectionInput } from "@/lib/python/contract";

// dev 전용 쇼케이스. 메인이 나중에 지운다.
const s = (label: string, startSec: number, endSec: number, mood = "") => ({ label, startSec, endSec, mood });
const curve = (n: number) => Array.from({ length: n }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i / 9)));

const normal: ConfirmSectionsInterrupt = {
  interruptId: "i-normal", kind: "confirm_sections", durationSec: 100.4, energyCurve: curve(101),
  sections: [s("intro", 0, 12, "차분하게 시작하는 은은한 분위기"), s("verse", 12, 37), s("chorus", 37, 67, "폭발적이고 화려한 파티 분위기"), s("outro", 67, 100.4, "벅차오르는 절정과 파워풀한 마무리")],
};
const bad: ConfirmSectionsInterrupt = {
  ...normal, interruptId: "i-bad",
  sections: [s("intro", 0, 12, "차분한 분위기"), s("verse", 12, 37), s("chorus", 37, 67, "폭발적인 분위기"), s("bridge", 67, 73), s("outro", 73, 100.4, "마무리")],
};
const twelve: ConfirmSectionsInterrupt = {
  ...normal, interruptId: "i-12", durationSec: 240, energyCurve: curve(240),
  sections: Array.from({ length: 12 }, (_, i) => s(["intro", "verse", "chorus", "outro"][i % 4], i * 20, (i + 1) * 20, i % 3 ? "분위기" : "")),
};

const server422: ApiError = { code: "invalid_sections", status: 422, message: "구간 4은(는) 8초 이상이어야 해요 (지금 6초)" };
const CASES = {
  정상: { interrupt: normal, submitting: false, error: null },
  "8초 미만 오류": { interrupt: bad, submitting: false, error: server422 },
  "제출 중": { interrupt: normal, submitting: true, error: null },
  "구간 12개": { interrupt: twelve, submitting: false, error: null },
  "일반 오류": { interrupt: normal, submitting: false, error: { code: "internal_error", status: 500 } as ApiError },
};

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  const [key, setKey] = useState<keyof typeof CASES>("정상");
  const [sent, setSent] = useState<SectionInput[] | null>(null);
  const c = CASES[key];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CASES) as (keyof typeof CASES)[]).map((k) => (
          <button key={k} type="button" aria-pressed={k === key} onClick={() => { setKey(k); setSent(null); }}
            className={`rounded-full border px-3 py-1 text-xs ${k === key ? "border-brand bg-brand/20 text-white" : "border-white/20 text-white/80"}`}>
            {k}
          </button>
        ))}
      </div>
      <SectionConfirm {...c} badge="burn it up · AURORA" onSubmit={setSent} />
      {sent && <pre className="overflow-x-auto rounded-xl bg-bg-dark-2 p-4 text-xs text-white/80">{JSON.stringify(sent, null, 2)}</pre>}
    </div>
  );
}
