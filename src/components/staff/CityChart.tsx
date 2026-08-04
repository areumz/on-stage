"use client";

import { Bar, BarChart, LabelList, Tooltip, XAxis, YAxis } from "recharts";

// color: 선택된 아티스트의 시그니처 컬러. 단일 시리즈라 색이 데이터를 인코딩하지 않고
// 정체성만 나타내므로, 선택기의 색 점과 같은 값을 쓴다 — 여기만 brand 고정이면 따로 놈.
export default function CityChart({
  data,
  color,
}: {
  data: { city: string; rate: number }[];
  color: string;
}) {
  return (
    // accessibilityLayer는 Recharts 3 기본값 — svg가 role="application"/tabIndex=0을 가짐.
    // 그래서 이름(aria-label)이 반드시 필요하고, 방향키 탐색 결과는 Tooltip이 읽어줌.
    <BarChart responsive className="h-[260px]" data={data} margin={{ top: 24, right: 0, bottom: 0, left: 0 }} aria-label="도시별 예매율">
      <XAxis dataKey="city" tickLine={false} axisLine={false} tick={{ fontSize: 12, className: "fill-gray-600" }} />
      {/* 값을 막대 위에 직접 적으므로 Y축 눈금은 없앤다 */}
      <YAxis hide domain={[0, 100]} />
      <Tooltip cursor={{ fill: "transparent" }} formatter={(v) => [`${v}%`, "예매율"]} />
      <Bar dataKey="rate" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24}>
        <LabelList dataKey="rate" position="top" formatter={(v) => `${v}%`} fontSize={12} className="fill-gray-600" />
      </Bar>
    </BarChart>
  );
}
