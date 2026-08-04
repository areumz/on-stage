"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function CityChart({ data }: { data: { city: string; rate: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      {/* accessibilityLayer는 Recharts 3 기본값 — svg가 role="application"/tabIndex=0을 갖는다.
          그래서 이름(aria-label)이 반드시 필요하고, 방향키 탐색 결과는 Tooltip이 읽어준다. */}
      <BarChart data={data} margin={{ top: 24, right: 0, bottom: 0, left: 0 }} aria-label="도시별 예매율">
        <XAxis dataKey="city" tickLine={false} axisLine={false} tick={{ fontSize: 12, className: "fill-gray-600" }} />
        {/* 값을 막대 위에 직접 적으므로 Y축 눈금은 없앤다 */}
        <YAxis hide domain={[0, 100]} />
        <Tooltip cursor={{ fill: "transparent" }} formatter={(v) => [`${v}%`, "예매율"]} />
        <Bar dataKey="rate" fill="var(--color-brand)" radius={[4, 4, 0, 0]} maxBarSize={24}>
          <LabelList dataKey="rate" position="top" formatter={(v) => `${v}%`} fontSize={12} className="fill-gray-600" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
