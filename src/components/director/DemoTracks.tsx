import Link from "next/link";
import { listDemos } from "@/lib/director/demo";

// 업로드 화면 오른쪽의 데모 곡 영역. 미리 분석된 곡을 AI 없이 바로 재생한다.
const ART = [
  "linear-gradient(145deg, #9F77DD, #1a1a22)",
  "linear-gradient(145deg, #D4537E, #1a1a22)",
];

export default function DemoTracks() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">데모 곡</p>
        <h2 className="text-lg font-bold">미리 분석된 곡으로 바로 체험</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
          분석 결과가 이미 준비돼 있어서 AI를 부르지 않고 바로 열려요. 기다림이나 하루 한도와 상관없이 체험할 수 있어요.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {listDemos().map((d, i) => (
          <li key={d.slug}>
            <Link
              href={`/staff/director/demo/${d.slug}`}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true" className="h-[72px] w-[72px] shrink-0 rounded-2xl" style={{ background: ART[i % ART.length] }} />
              <span className="min-w-0 grow">
                <span className="block truncate text-base font-bold">{d.title}</span>
                <span className="mt-2 inline-flex rounded-full border border-[#34C759]/25 bg-[#34C759]/10 px-2.5 py-1 text-[11.5px] font-semibold text-[#34C759]">
                  미리 분석됨
                </span>
              </span>
              <span className="shrink-0 text-[13px] font-semibold">열기 →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
