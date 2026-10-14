import ProgressCard, { type Step } from "@/components/director/ProgressCard";

type Phase = "queued" | "mood" | "generating" | "saving";

const COPY: Record<Phase, { headline: string; sub: string; hint: string; eta?: string; steps: Step[] }> = {
  mood: {
    headline: "곡의 분위기를 듣고 있어요",
    sub: "AI가 음원을 들으면서 구간마다 분위기를 적고 있어요. AI가 붐비면 조금 더 걸려요.",
    hint: "용량이 큰 곡(15MiB 이상)이나 AI가 못 적은 구간은 분위기가 비어 있어요. 괜찮아요, 다음 화면에서 직접 적을 수 있어요.",
    eta: "최대 약 40초",
    steps: [
      { label: "구간 분석 결과 받기", state: "done" },
      { label: "AI가 분위기 해석 중", state: "now" },
      { label: "구간 확인 화면 준비", state: "todo" },
    ],
  },
  generating: {
    headline: "무대 연출을 만들고 있어요",
    sub: "구간마다 AI가 연출을 만들고 있어요. 구간이 많거나 AI가 붐비면 더 걸려요.",
    hint: "끝나면 검토 화면이 열려요. 기다리는 동안 이 화면을 그대로 둬도 돼요.",
    eta: "2~4분 정도 걸릴 수 있어요",
    steps: [
      { label: "승인 내용 반영", state: "done" },
      { label: "구간별 연출 생성", state: "now" },
      { label: "검토 준비", state: "todo" },
    ],
  },
  saving: {
    headline: "연출을 저장하고 있어요",
    sub: "승인한 연출을 내 계정에 저장하는 중이에요. 끝나면 바로 재생할 수 있어요.",
    hint: "화면을 닫아도 괜찮아요. 저장에 실패하면 다시 시도할 수 있어요 (승인 후 24시간 안).",
    eta: "곧 끝나요",
    steps: [
      { label: "승인", state: "done" },
      { label: "결과 확인", state: "done" },
      { label: "내 계정에 저장", state: "now" },
    ],
  },
  queued: {
    headline: "순서를 기다리는 중이에요",
    sub: "지금 다른 작업을 처리하고 있어요. 끝나면 바로 이어서 시작해요.",
    hint: "동시에 처리할 수 있는 작업 수가 정해져 있어요. 앞 작업이 길면 조금 더 기다릴 수 있어요.",
    steps: [
      { label: "앞 작업 처리 중", state: "now" },
      { label: "내 작업 순서 기다리는 중", state: "todo" },
      { label: "시작", state: "todo" },
    ],
  },
};

export default function RunProgress({ phase }: { phase: Phase }) {
  return <ProgressCard {...COPY[phase]} />;
}
