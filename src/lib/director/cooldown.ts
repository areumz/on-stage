// 쿨다운 순수 계산 — 타이머와 분리해 테스트한다.
// 경과를 tick 횟수가 아닌 시각 차로 계산해, 백그라운드 탭에서 setInterval 이 늦어져도 정확하다.

export function remainingSeconds(total: number | undefined, startedAt: number, now: number): number {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(0, (total ?? 0) - elapsed);
}

export function cooldownLabel(label: string, remaining: number): string {
  return remaining > 0 ? `${label} (${remaining}초 후)` : label;
}
