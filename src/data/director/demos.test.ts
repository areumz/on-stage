import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateSequence } from "@/lib/director/sequenceValidate";
import demos from "./demos.json";

// 데모 곡의 예시 연출 JSON 을 손으로 고쳐도 저장 규칙(계약서 §4.5)과 구간·항목 짝이 깨지지 않게 지킨다.
describe.each(demos.map((d) => [d.file] as const))("데모 %s", (file) => {
  const data = JSON.parse(readFileSync(`src/data/director/${file}.sequence.json`, "utf8"));
  const { sections, items } = data.result;

  it("구간과 연출 항목이 순서·라벨·시간까지 같다", () => {
    expect(items).toHaveLength(sections.length);
    items.forEach((it: { sectionLabel: string; startSec: number; endSec: number }, i: number) => {
      expect([it.sectionLabel, it.startSec, it.endSec]).toEqual([sections[i].label, sections[i].startSec, sections[i].endSec]);
    });
  });

  it("저장 검증(0초 시작, 곡 길이로 끝, 이어짐, transitionMs 범위)을 통과한다", () => {
    const r = validateSequence(items, data.durationSec, "#9F77DD");
    expect(r).toMatchObject({ ok: true });
  });

  it("구간 이름은 1~40자다", () => {
    for (const s of sections) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.label.length).toBeLessThanOrEqual(40);
    }
  });
});
