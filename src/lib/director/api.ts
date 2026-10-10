// 브라우저에서 우리 route handler 를 부르는 헬퍼. Python 은 여기서 직접 부르지 않는다(서버 라우트가 중계한다).
// 항상 Result 를 돌려주고 예외를 던지지 않는다. 오류 코드는 src/lib/python/errors.ts 의 errorKeyFor 로 문구를 찾는다.
import type { AnalyzeStatus, Interrupt, ResumeBody, RunStatus } from "@/lib/python/contract";

export type ApiError = {
  code: string; // 서버가 준 error 코드. 연결 실패는 connection_failed
  status: number; // HTTP 상태, 연결 실패는 0
  message?: string; // invalid_sections 등에서 사용자에게 보여 줘도 되는 문구
  draftId?: string | null; // draft_exists 일 때 이미 있는 초안 id
};
export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// 분석 진행. progress 는 단계 값(0.1 → 0.4 → 1.0)이라 퍼센트로 쓰지 않는다. error 일 때는 무시한다.
export type AnalysisPoll = { status: AnalyzeStatus; progress: number | null; error: string | null };

// 연출 진행. approved 는 승인되어 저장까지 끝난 상태(폴링 종료)다.
export type SequencePoll = {
  status: RunStatus | "approved";
  interrupt?: Interrupt | null;
  error?: string | null;
  feedbackCount?: number;
};

export type ResumeAck = { status: RunStatus; feedbackCount: number };

async function call<T>(url: string, init?: RequestInit): Promise<Result<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: { code: "connection_failed", status: 0 } };
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      error: {
        code: typeof body?.error === "string" ? body.error : "internal_error",
        status: res.status,
        message: typeof body?.message === "string" ? body.message : undefined,
        draftId: body?.draftId,
      },
    };
  }
  return { ok: true, data: body as T };
}

const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

// 업로드 화면에 들어올 때 부른다. 서버를 미리 깨워 둘 뿐이라 결과는 무시해도 된다.
export const warmup = () => call<{ ok: true }>("/api/python/warmup");

export const startAnalysis = (trackId: string) => call<AnalysisPoll>(`/api/audio-tracks/${trackId}/analyze`, post());
export const pollAnalysis = (trackId: string) => call<AnalysisPoll>(`/api/audio-tracks/${trackId}/analyze`);

export const createSequence = (audioTrackId: string) => call<{ id: string; status: RunStatus }>("/api/sequences", post({ audioTrackId }));
export const pollSequence = (id: string) => call<SequencePoll>(`/api/sequences/${id}`);
export const resumeSequence = (id: string, body: ResumeBody) => call<ResumeAck>(`/api/sequences/${id}/resume`, post(body));
export const retrySequence = (id: string) => call<ResumeAck>(`/api/sequences/${id}/retry`, post());
// 초안 버리기와 저장된 연출 삭제가 같은 호출이다
export const deleteSequence = (id: string) => call<void>(`/api/sequences/${id}`, { method: "DELETE" });
