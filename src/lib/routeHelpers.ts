// RLS가 막은 UPDATE/DELETE는 예외가 아니라 0행 처리로 돌아온다 — 그대로 성공 응답을 주면 권한
// 없는 시도가 성공한 것처럼 보인다. API 라우트마다 이 0행 판정을 각자 다시 쓰다 보면 언젠가
// 한 곳에서 빠뜨려 권한 없는 쓰기가 조용히 성공한 것처럼 보이는 사고로 이어질 수 있어서 헬퍼함수로 분리.

export function forbiddenIfNoRows(data: unknown[] | null): Response | null {
  if (!data || data.length === 0) return Response.json({ error: "forbidden" }, { status: 403 });
  return null;
}
