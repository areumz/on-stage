import type { ReactNode } from "react";

// 분석·연출 진행 화면이 같이 쓰는 카드. 진행은 퍼센트가 아니라 단계 문구로 보여 준다:
// 분석 progress 는 0.1 → 0.4 → 1.0 단계 값이고 연출(/runs)에는 progress 가 아예 없어서 막대를 그리면 오래 멈춘 것처럼 보인다.

export type StepState = "done" | "now" | "todo";
export type Step = { label: string; state: StepState };

export function ScreenHeader({ eyebrow, title, badge }: { eyebrow: string; title: string; badge?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {badge && <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70">{badge}</span>}
    </div>
  );
}

function StepDot({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span aria-hidden="true" className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#34C759] text-bg-dark">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    );
  }
  if (state === "now") {
    return (
      <span aria-hidden="true" className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand text-bg-dark">
        <span className="h-2 w-2 rounded-full bg-current" />
      </span>
    );
  }
  return <span aria-hidden="true" className="h-[22px] w-[22px] shrink-0 rounded-full bg-white/10" />;
}

const STEP_LABEL: Record<StepState, string> = { done: "완료", now: "진행 중", todo: "대기" };

export default function ProgressCard({
  headline,
  sub,
  hint,
  eta,
  steps,
  children,
}: {
  headline: string;
  sub: string;
  hint?: string;
  eta?: string;
  steps: Step[];
  children?: ReactNode; // 버튼 같은 동작 자리
}) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
      {/* 문구가 바뀌면 스크린리더가 한 번 읽는다. 단계 목록은 읽지 않게 이 영역 밖에 둔다. */}
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {eta && <p className="self-end text-[12.5px] text-white/60">{eta}</p>}
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{headline}</h2>
        <p className="max-w-2xl text-[15px] leading-relaxed text-white/70">{sub}</p>
      </div>

      <ol className="flex flex-col gap-2.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3">
            <StepDot state={s.state} />
            <span className={`text-sm ${s.state === "todo" ? "text-white/60" : "text-white"}`}>
              {s.label}
              <span className="sr-only"> — {STEP_LABEL[s.state]}</span>
            </span>
          </li>
        ))}
      </ol>

      {children}

      {hint && <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] leading-relaxed text-white/70">{hint}</p>}
    </section>
  );
}
