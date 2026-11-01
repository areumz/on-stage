// 실제 음원이 있는 아티스트만 — slug → 트랙 번호 → public 경로.
// ponytail: 정적 매핑이라 B탭에서 트랙 번호를 바꾸면 어긋남. 음원이 늘면 tracks에 audio 컬럼 추가
export const MUSIC: Record<string, Record<number, string>> = {
  echo: {
    1: "/music/echo/01.우리의 푸른 계절 (Our Season of Youth).mp3",
    2: "/music/echo/02.Strawberry Cake.mp3",
    3: "/music/echo/03.하루의 끝.mp3",
  },
};
