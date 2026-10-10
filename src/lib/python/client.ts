// Python 서비스 호출. route handler(서버)에서만 쓴다.
// INTERNAL_API_KEY 는 NEXT_PUBLIC_ 이 아니라서 클라이언트 번들에 들어가지 않는다 — 실수로 import 해도 undefined 다.
// 로그에는 메서드·경로·상태만 남긴다. 요청·응답 본문(서명 URL 포함)은 절대 남기지 않는다.
import type { AnalyzeBody, ResumeBody, RunBody, RunContext } from "@/lib/python/contract";

// 콜드 스타트가 약 10초라 30초 이상으로 잡는다
const TIMEOUT_MS = 35_000;

export class PythonError extends Error {
  constructor(
    readonly status: number, // 우리가 클라이언트에 줄 HTTP 상태 힌트. 연결 실패·5xx 는 502
    readonly code: string, // Python 의 detail 코드, 또는 not_configured / connection_failed / bad_gateway / invalid_request
    readonly detail?: string, // Python 이 준 message (invalid_sections 등). 사용자에게 보여 줘도 되는 문구
  ) {
    super(code);
  }
}

type Init = { method?: "GET" | "POST"; body?: unknown; auth?: boolean };

export async function pythonFetch<T>(path: string, init: Init = {}): Promise<T> {
  const base = process.env.PYTHON_SERVICE_URL;
  const key = process.env.INTERNAL_API_KEY;
  const auth = init.auth ?? true;
  const method = init.method ?? "GET";
  if (!base || (auth && !key)) {
    console.error("[python] PYTHON_SERVICE_URL / INTERNAL_API_KEY 가 설정되지 않았다 (.env.local 확인)");
    throw new PythonError(500, "not_configured");
  }

  const headers: Record<string, string> = {};
  if (auth) headers["X-Internal-Key"] = key!;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(new URL(path, base), {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    console.error(`[python] ${method} ${path} -> 연결 실패·시간 초과`);
    throw new PythonError(502, "connection_failed");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown; message?: unknown } | null;
    const code = typeof body?.detail === "string" ? body.detail : Array.isArray(body?.detail) ? "invalid_request" : "bad_gateway";
    const message = typeof body?.message === "string" ? body.message : undefined;
    console.error(`[python] ${method} ${path} -> ${res.status} ${code}`);
    // 5xx 와 모르는 응답은 클라이언트 쪽에서는 모두 502 로 본다. 401(키 불일치)은 서버 설정 오류라 500.
    const status = res.status === 401 ? 500 : res.status >= 500 || code === "bad_gateway" ? 502 : res.status;
    throw new PythonError(status, res.status === 401 ? "internal_error" : code, message);
  }
  return (await res.json()) as T;
}

const seg = encodeURIComponent;

export const python = {
  health: () => pythonFetch<{ status: string }>("/health", { auth: false }),
  startAnalyze: (jobId: string, audioUrl: string) =>
    pythonFetch<AnalyzeBody>("/analyze", { method: "POST", body: { jobId, audioUrl } }),
  getAnalyze: (jobId: string) => pythonFetch<AnalyzeBody>(`/analyze/${seg(jobId)}`),
  startRun: (threadId: string, context: RunContext) =>
    pythonFetch<RunBody>("/runs", { method: "POST", body: { threadId, context } }),
  getRun: (threadId: string) => pythonFetch<RunBody>(`/runs/${seg(threadId)}`),
  resume: (threadId: string, body: ResumeBody) =>
    pythonFetch<RunBody>(`/runs/${seg(threadId)}/resume`, { method: "POST", body }),
};
