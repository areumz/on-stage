"use client";

import { useState } from "react";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import type { ApiError } from "@/lib/director/api";
import { SEQUENCE_NAME_MAX } from "@/lib/director/format";
import { FEEDBACK_LIMIT } from "@/lib/director/limits";
import { checkName } from "@/lib/director/rename";
import { DEFAULT_FEEDBACK_TEXT, barPercent, cameraLabel, groupIssues, issueSectionCount, timeRange } from "@/lib/director/review";
import type { Issue, ReviewInterrupt } from "@/lib/python/contract";
import { DISCARD_CONFIRM, errorCopyFor } from "@/lib/python/errors";

type Props = {
  interrupt: ReviewInterrupt;
  badge: string;
  feedbackCount: number;
  submitting: boolean;
  error: ApiError | null;
  onFeedback: (text: string, targets: number[]) => void;
  onApprove: (name?: string) => void; // 이름을 적었을 때만 name 을 넘긴다
  onDiscard: () => void;
};

const AMBER = "#E8A23B";
const ROSE = "#F0708F"; // 어두운 배경에서 4.5:1 이상

function WarnIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M8 2 1.5 13.5h13L8 2Z" />
      <path d="M8 6.5v3.2M8 11.7v.1" />
    </svg>
  );
}
function RetryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.8-4.1M13.5 2.5v3h-3" />
    </svg>
  );
}

function IssueChip({ issue }: { issue: Issue }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg border px-2.5 py-1 text-xs" style={{ color: ROSE, borderColor: `${ROSE}66`, background: `${ROSE}1a` }}>
      <span className="mt-0.5"><WarnIcon /></span>
      <span>{issue.message}</span>
    </p>
  );
}

export default function SequenceReview(props: Props) {
  // 새 interruptId 가 오면 카드별 입력을 비운다
  return <Inner key={props.interrupt.interruptId} {...props} />;
}

function Inner({ interrupt, badge, feedbackCount, submitting, error, onFeedback, onApprove, onDiscard }: Props) {
  const { confirm, dialog } = useConfirm();
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [seqName, setSeqName] = useState(""); // 선택 입력: 비우면 기본 이름(곡 제목 · 날짜 시간)
  const [nameError, setNameError] = useState<string | null>(null);
  const { items, issues } = interrupt;
  const exhausted = feedbackCount >= FEEDBACK_LIMIT;
  const { bySection, whole } = groupIssues(issues, items.length);
  const issueCount = issueSectionCount(issues, items.length);
  const copy = error ? errorCopyFor(error.code) : null;

  function approve() {
    const check = checkName(seqName);
    if (!check.ok) return setNameError(check.message);
    setNameError(null);
    onApprove(check.name ?? undefined); // 비어 있으면 name 을 보내지 않는다
  }

  async function discard() {
    if (!(await confirm(`${DISCARD_CONFIRM.title} ${DISCARD_CONFIRM.body}`, { confirmLabel: DISCARD_CONFIRM.confirm, cancelLabel: DISCARD_CONFIRM.cancel }))) return;
    onDiscard();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 text-white md:px-8 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-white/60">연출 만들기 · 확인 2/2</p>
          <h1 className="mt-1 text-2xl font-bold">검토 및 피드백</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-bg-dark-2 px-3 py-1.5 text-white/70">{badge}</span>
          <span
            className="rounded-full border px-3 py-1.5 font-medium"
            style={exhausted ? { color: ROSE, borderColor: `${ROSE}66` } : { color: AMBER, borderColor: `${AMBER}66` }}
          >
            다시 생성 {feedbackCount}/{FEEDBACK_LIMIT}
          </span>
        </div>
      </header>

      {copy && (
        <div role="alert" className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: `${ROSE}66`, background: `${ROSE}1a` }}>
          <p className="font-medium text-white">{copy.headline}</p>
          <p className="mt-0.5 text-white/70">{error?.code === "invalid_targets" && error.message ? error.message : copy.sub}</p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {items.map((item, i) => {
          const mine = bySection[i];
          const warned = mine.length > 0;
          const fid = `fb-${interrupt.interruptId}-${i}`;
          return (
            <section key={i} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-bg-dark-2 p-4" style={warned ? { borderColor: `${ROSE}55` } : undefined}>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-[3px] border border-white/20" style={{ background: item.state.color }} aria-hidden="true" />
                <h2 className="text-sm font-semibold">{item.sectionLabel}</h2>
                <span className="ml-auto text-xs text-white/60">{timeRange(item.startSec, item.endSec)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
                {(["left", "center", "right"] as const).map((k) => (
                  <div key={k} className="h-1 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full" style={{ width: `${barPercent(item.state.spots[k])}%`, background: item.state.color }} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/60">
                카메라 {cameraLabel(item.state.camera)} · 스모크 {Math.round(item.state.smoke.density * 100)}%
              </p>
              <p className="rounded-lg bg-white/5 px-3 py-2 text-sm" style={{ color: warned ? AMBER : "rgba(255,255,255,0.9)" }}>
                {item.rationale}
              </p>
              {mine.map((m, k) => <IssueChip key={k} issue={m} />)}
              <label htmlFor={fid} className="sr-only">{item.sectionLabel} 피드백</label>
              <input
                id={fid}
                type="text"
                maxLength={500}
                value={texts[i] ?? ""}
                disabled={submitting || exhausted}
                onChange={(e) => setTexts((t) => ({ ...t, [i]: e.target.value }))}
                placeholder={exhausted ? "다시 생성을 모두 써서 입력할 수 없어요" : "피드백을 남겨주세요 (선택)"}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/60 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60"
              />
              <button
                type="button"
                disabled={submitting || exhausted}
                onClick={() => onFeedback(texts[i]?.trim() || DEFAULT_FEEDBACK_TEXT, [i])}
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RetryIcon />
                {exhausted ? "다시 생성 횟수를 모두 썼어요" : "이 구간 다시 생성"}
              </button>
            </section>
          );
        })}

        <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/20 p-4">
          <h2 className="text-sm font-semibold">곡 전체</h2>
          <p className="text-xs text-white/60">어느 한 구간에 속하지 않는 경고는 여기에 모여요.</p>
          {whole.length > 0 ? (
            whole.map((w, k) => <IssueChip key={k} issue={w} />)
          ) : (
            <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60">지금은 곡 전체에 대한 경고가 없어요.</p>
          )}
        </section>
      </div>

      <footer className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-white/60">
          {issueCount > 0 ? (
            <>
              {items.length}개 구간 중 <strong style={{ color: ROSE }}>{issueCount}개</strong>에 확인이 필요한 이슈가 있어요
            </>
          ) : (
            <>{items.length}개 구간 모두 확인이 필요한 이슈가 없어요</>
          )}
          {" · "}
          {exhausted ? "다시 생성을 모두 썼어요. 승인하거나 새로 만들어 주세요." : `이 연출에서 다시 생성은 ${FEEDBACK_LIMIT}번까지 할 수 있어요.`}
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="seq-name" className="text-xs font-semibold text-white/70">연출 이름 (선택)</label>
          <input
            id="seq-name"
            value={seqName}
            onChange={(e) => setSeqName(e.target.value)}
            disabled={submitting}
            placeholder="비우면 곡 제목 · 날짜 시간"
            aria-describedby="seq-name-help"
            aria-invalid={!!nameError}
            className="min-h-10 w-full rounded-lg border border-white/25 bg-transparent px-3 text-base text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60 md:max-w-md md:text-sm"
          />
          <p id="seq-name-help" className="text-xs text-white/60">{SEQUENCE_NAME_MAX}자까지 · 나중에 내 연출에서 바꿀 수 있어요</p>
          {nameError && <p role="alert" className="text-sm text-rose-300">{nameError}</p>}
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <button
            type="button"
            disabled={submitting}
            onClick={discard}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            이 초안 버리고 새로 만들기
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={approve}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            전체 승인 →
          </button>
        </div>
      </footer>
      {dialog}
    </div>
  );
}
