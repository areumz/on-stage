import type { TrackRow } from "@/lib/types";

export type SwapDirection = "up" | "down";

// 위/아래 버튼의 경계 판정(맨 위로 "위로", 맨 아래로 "아래로")과 클릭한 트랙의 swap 상대를
// 찾는 로직이 같아서 한 곳에 모음. no 기준 정렬 후 인접 쌍을 찾고, 경계거나 id가 없으면 null.
export function neighborSwap(tracks: TrackRow[], id: string, direction: SwapDirection): [TrackRow, TrackRow] | null {
  const sorted = [...tracks].sort((a, b) => a.no - b.no);
  const index = sorted.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= sorted.length) return null;

  return [sorted[index], sorted[targetIndex]];
}
