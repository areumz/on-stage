export default function MetricCard({
  title,
  value,
  sub,
  positive,
}: {
  title: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  // positive를 넘기지 않으면 중립 — 도시 수·공연장처럼 방향성이 없는 설명이다.
  // 색만으로 방향을 알리지는 않는다. delta 문구의 ▲▼가 같은 정보를 글자로도 전한다.
  const tone =
    positive === undefined ? "text-gray-600" : positive ? "text-emerald-700" : "text-red-700";

  return (
    <div className="rounded-xl border border-gray-200 bg-surface-2 p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className={`mt-1 text-sm ${tone}`}>{sub}</p>
    </div>
  );
}
