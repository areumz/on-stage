import ProgressCard from "@/components/director/ProgressCard";
import { analysisView, type AnalysisPhase } from "@/lib/director/analysisSteps";

export default function AnalysisProgress({
  phase,
  progress,
  onCreate,
}: {
  phase: AnalysisPhase;
  progress: number | null;
  onCreate?: () => void;
}) {
  const v = analysisView(phase, progress);
  return (
    <ProgressCard {...v}>
      {phase === "done" && (
        <button
          type="button"
          onClick={onCreate}
          className="self-start rounded-full bg-brand px-6 py-3 text-sm font-semibold text-bg-dark hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          연출 만들기 →
        </button>
      )}
    </ProgressCard>
  );
}
