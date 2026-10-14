import type { Step } from "@/components/director/ProgressCard";

// 분석·연출 시작 진행 화면의 문구와 단계. 퍼센트가 아니라 단계 목록으로만 보여 준다.
export type AnalysisPhase = "waking" | "queued" | "running" | "done" | "creating";

export type AnalysisView = { headline: string; sub: string; hint: string; eta: string; steps: Step[] };

const mk = (labels: string[], nowAt: number): Step[] =>
  labels.map((label, i) => ({ label, state: i < nowAt ? "done" : i === nowAt ? "now" : "todo" }));

// progress 는 0.1 → 0.4 → 1.0 단계 값. null·음수·NaN 은 아직 모르는 것으로 보고 첫 단계로 둔다.
function runningStage(progress: number | null): number {
  if (progress === null || !(progress >= 0.4)) return 1;
  return progress >= 1 ? 3 : 2;
}

export function analysisView(phase: AnalysisPhase, progress: number | null): AnalysisView {
  switch (phase) {
    case "waking":
      return {
        eta: "처음 한 번만 최대 약 10초",
        headline: "서버를 깨우는 중이에요",
        sub: "잠시 쉬고 있던 서버가 켜지고 있어요. 처음 한 번만 오래 걸리고, 그다음부터는 바로 응답해요.",
        hint: "곡을 고르는 동안 미리 깨워 두면 이 화면을 건너뛸 수 있어요.",
        steps: mk(["서버 켜는 중", "분석 요청 보내기", "분석"], 0),
      };
    case "queued":
      return {
        eta: "앞 곡이 끝나면 바로 시작",
        headline: "순서를 기다리는 중이에요",
        sub: "지금 다른 곡을 분석하고 있어요. 끝나면 바로 이어서 시작해요.",
        hint: "동시에 분석할 수 있는 곡은 1개예요. 앞 작업이 길면 수십 초 이상 기다릴 수 있어요.",
        steps: mk(["다른 곡 분석 중", "내 곡 순서 기다리는 중", "분석 시작"], 0),
      };
    case "running":
      return {
        eta: "보통 수 초~수십 초 (5분 곡은 1분 안팎)",
        headline: "곡을 분석하고 있어요",
        sub: "음원을 내려받아 구간, 박자, 에너지를 분석하고 있어요. 곡이 길수록 조금 더 걸려요.",
        hint: "진행 상황은 자동으로 갱신돼요.",
        steps: mk(["분석 요청 접수", "음원 내려받기", "구간·박자·에너지 분석", "결과 정리"], runningStage(progress)),
      };
    case "done":
      return {
        eta: "연출은 버튼을 눌러야 시작해요",
        headline: "분석이 끝났어요",
        sub: "구간과 박자 분석이 끝났어요. 이제 무대 연출을 만들 수 있어요.",
        hint: "연출을 만들 때는 AI를 사용해서 하루에 쓸 수 있는 횟수가 줄어들어요. 준비되면 눌러 주세요.",
        steps: mk(["분석 요청 접수", "음원 내려받기", "구간·박자·에너지 분석", "결과 정리"], 4),
      };
    case "creating":
      return {
        eta: "처음에는 최대 약 10초",
        headline: "연출 만들기를 시작하고 있어요",
        sub: "서버에 연출 만들기를 요청하는 중이에요. 처음에는 서버가 켜지느라 조금 걸릴 수 있어요.",
        hint: "화면을 그대로 두면 연출 화면으로 자동으로 넘어가요.",
        steps: mk(["서버에 요청 보내기", "분위기 해석", "구간 확인"], 0),
      };
  }
}

// job_not_found 로 분석을 다시 시작하는 것은 시도당 한 번만. POST 는 되는데 GET 이 계속 404 인 경우 무한 반복을 막는다.
export const canRestartJob = (restarts: number) => restarts < 1;

// 초안 삭제가 404 면 이미 다른 곳에서 지워진 것이라 성공으로 본다.
export const deleteAlreadyGone = (status: number) => status === 404;
