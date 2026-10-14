// 검토 화면의 순수 보조 함수. 화면은 이 결과를 그대로 그리기만 한다.
import type { Issue } from "@/lib/python/contract";
import type { StageState } from "@/lib/stageState";

export const DEFAULT_FEEDBACK_TEXT = "이 구간을 다시 만들어 주세요"; // 서버가 text 1자 이상을 요구해서

// idx 가 구간 번호인 경고는 그 구간에, null(또는 범위 밖)은 곡 전체로 모은다.
export function groupIssues(issues: Issue[], count: number): { bySection: Issue[][]; whole: Issue[] } {
  const bySection: Issue[][] = Array.from({ length: count }, () => []);
  const whole: Issue[] = [];
  for (const i of issues) {
    if (i.idx !== null && Number.isInteger(i.idx) && i.idx >= 0 && i.idx < count) bySection[i.idx].push(i);
    else whole.push(i);
  }
  return { bySection, whole };
}

export function issueSectionCount(issues: Issue[], count: number): number {
  return groupIssues(issues, count).bySection.filter((l) => l.length > 0).length;
}

// 조명 막대 %. 꺼져 있으면 0, 값은 0~1000 으로 가둔다.
export function barPercent(spot: { on: boolean; intensity: number }): number {
  if (!spot.on || !Number.isFinite(spot.intensity)) return 0;
  return Math.round(Math.min(1000, Math.max(0, spot.intensity)) / 10);
}

const CAMERA_KO: Record<StageState["camera"], string> = { front: "정면", audience: "객석", top: "위에서" };
export function cameraLabel(camera: StageState["camera"]): string {
  return `${CAMERA_KO[camera] ?? camera} (${camera})`;
}

export function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
export function timeRange(startSec: number, endSec: number): string {
  return `${formatSec(startSec)}–${formatSec(endSec)}`;
}
