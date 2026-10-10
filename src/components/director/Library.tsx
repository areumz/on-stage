"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm } from "@/components/staff/ConfirmDialog";
import { deleteSequence, type Result } from "@/lib/director/api";
import { sequenceName } from "@/lib/director/format";
import { groupByTrack } from "@/lib/director/library";
import { APPROVED_LIMIT, FEEDBACK_LIMIT } from "@/lib/director/limits";
import type { AudioTrackSummary, SequenceSummary } from "@/lib/director/types";
import { useAutoDismiss } from "@/lib/hooks";
import { DISCARD_CONFIRM, errorCopyFor } from "@/lib/python/errors";

// 분석용 headline 을 쓰면 삭제 실패에도 "분석에 실패했어요"가 나와서 삭제 전용 문구를 둔다.
function deleteErrorMessage(code: string): string {
  if (code === "unauthorized" || code === "connection_failed") return errorCopyFor(code).headline;
  return "삭제하지 못했어요. 잠시 뒤에 다시 시도해 주세요";
}

const STATUS_LABEL = { pending: "분석 대기", running: "분석 중", done: "분석 완료", error: "분석 오류" } as const;
const btn =
  "rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtn = "rounded-full border border-rose-400/60 px-4 py-1.5 text-sm font-medium text-rose-300 hover:bg-rose-400/10 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  tracks: AudioTrackSummary[];
  sequences: SequenceSummary[];
  // 쇼케이스에서 실제 API 를 부르지 않기 위한 주입점
  onDelete?: (id: string) => Promise<Result<void>>;
};

export default function Library({ tracks, sequences, onDelete = deleteSequence }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  // refresh 가 끝날 때까지 pending 을 유지해, 지워진 행이 되살아나 한 번 더 눌리는 일과 동시 삭제를 막는다.
  const [busy, startTransition] = useTransition();
  useAutoDismiss(error, setError, null);

  const groups = groupByTrack(tracks, sequences);

  async function remove(id: string, message: string, confirmLabel: string) {
    if (!(await confirm(message, { confirmLabel }))) return;
    startTransition(async () => {
      const res = await onDelete(id);
      // 404 는 이미 지워진 것이라 조용히 성공으로 보고 목록만 새로고침한다.
      if (!res.ok && res.error.status !== 404) return setError(deleteErrorMessage(res.error.code));
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="library-title" className="w-full text-white">
      <h2 id="library-title" className="text-2xl font-bold">내 연출</h2>
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-white/70">아직 만든 연출이 없어요. 곡을 올려 첫 연출을 만들어 보세요.</p>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(({ track, drafts, approved }) => {
            const full = approved.length >= APPROVED_LIMIT;
            const analyzed = track.analysis_status === "done";
            return (
              <section key={track.id} aria-label={track.title} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mr-1 text-lg font-semibold">{track.title}</h2>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">{STATUS_LABEL[track.analysis_status]}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80">
                    저장된 연출 {approved.length}/{APPROVED_LIMIT}
                  </span>
                  <span className="ml-auto">
                    {full ? (
                      <button type="button" disabled className={btn}>+ 새 연출 만들기</button>
                    ) : (
                      <Link href={`/staff/director/tracks/${track.id}`} className="inline-block rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-bg-dark hover:opacity-90 focus-visible:outline-2 focus-visible:outline-white">
                        {analyzed ? "+ 새 연출 만들기" : "분석 이어서 보기"}
                      </Link>
                    )}
                  </span>
                </div>
                {full && <p className="text-sm text-white/70">저장된 연출이 5개예요. 오래된 연출을 지우면 새로 만들 수 있어요.</p>}

                {drafts.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-amber-400/10 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-300">
                        만들던 초안 · 다시 생성 {d.feedbackCount}/{FEEDBACK_LIMIT}
                      </p>
                      <p className="text-sm text-white/70">{track.title} · 한 곡에는 만드는 중인 연출을 하나만 둘 수 있어요.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/staff/director/sequences/${d.id}`} className={btn}>이어서 하기</Link>
                      <button type="button" disabled={busy} onClick={() => remove(d.id, `${DISCARD_CONFIRM.title} ${DISCARD_CONFIRM.body}`, "버리기")} className={btn}>
                        버리기
                      </button>
                    </div>
                  </div>
                ))}

                {approved.map((s) => {
                  const name = sequenceName(s.trackTitle, s.approvedAt ?? s.createdAt);
                  return (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-bg-dark-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{name}</p>
                        <p className="text-sm text-white/70">구간 {s.sectionCount}개 · 다시 생성 {s.feedbackCount}회</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/staff/director/sequences/${s.id}`} className={btn}>열기</Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => remove(s.id, `“${name}” 연출을 삭제할까요? 삭제하면 되돌릴 수 없어요. 곡당 저장 가능 개수(${APPROVED_LIMIT}개)에서 1개가 줄어들어요.`, "삭제")}
                          className={dangerBtn}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-xs text-white/60">삭제하면 되돌릴 수 없어요. 데모 곡은 목록에 없고 항상 볼 수 있어요.</p>
      {dialog}
    </section>
  );
}
