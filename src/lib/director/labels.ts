// 구간 label 의 표시용 한글 이름. Python 이 자동으로 붙이는 값은 intro · verse · chorus · outro 네 개고,
// 사람이 고친 값은 자유 문자열이다(예: bridge, 드롭). 모르는 값은 그대로 보여 준다.
// 표시에만 쓴다 — Python 으로 보내는 값은 원래 label 이다(사용자가 고치지 않았다면 그대로).
const KO: Record<string, string> = { intro: "인트로", verse: "버스", chorus: "코러스", outro: "아웃트로" };

export function labelKo(label: string): string {
  return Object.hasOwn(KO, label) ? KO[label] : label;
}
