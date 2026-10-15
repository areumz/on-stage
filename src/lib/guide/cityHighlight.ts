// 도시 강조 요청. 투어 페이지의 TourSection이 구독하고, 에이전트 액션(highlightCity)이 발행한다.
// 지속되는 상태가 아니라서(이미 열린 투어 페이지에서만 실행) 모듈에 값을 남기지 않는다.
type Listener = (slug: string, code: string) => void;
const listeners = new Set<Listener>();

export function requestHighlight(slug: string, code: string): void {
  listeners.forEach((l) => l(slug, code));
}

export function subscribeHighlight(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
