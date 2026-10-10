// 연출 이름: "곡 제목 · 10월 8일". 날짜는 승인한 날(초안이면 만든 날). 서버 시간대와 상관없이 한국 날짜로 보인다.
export function sequenceName(trackTitle: string, isoDate: string): string {
  const date = new Date(isoDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
  return `${trackTitle} · ${date}`;
}
