// 시퀀스 재생용 순수 함수. 컴포넌트·오디오와 분리해 경계값을 테스트로 고정한다.
import type { SequenceItem } from "@/lib/python/contract";
import { defaultStageState, type SpotState, type StageState } from "@/lib/stageState";

// 경계는 다음 구간. 음수·마지막 끝 이후는 양 끝 구간으로 clamp. 빈 배열은 -1.
export function sectionIndexAt(items: SequenceItem[], tSec: number): number {
  if (items.length === 0) return -1;
  for (let i = items.length - 1; i > 0; i--) if (tSec >= items[i].startSec) return i;
  return 0;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

// #rgb 는 #rrggbb 로 확장. 파싱할 수 없으면 null.
function parseHex(h: string): number[] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h);
  if (!m) return null;
  const x = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
}

// 잘못된 입력이면 목표 색(b)을 그대로 돌려줘 NaN 색이 3D 로 새지 않게 한다.
export function lerpHex(a: string, b: string, f: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return b;
  return "#" + pa.map((c, i) => Math.round(lerp(c, pb[i], f)).toString(16).padStart(2, "0")).join("");
}

function lerpSpot(a: SpotState, b: SpotState, f: number): SpotState {
  return {
    on: a.on || b.on,
    intensity: lerp(a.on ? a.intensity : 0, b.on ? b.intensity : 0, f),
    angle: lerp(a.angle, b.angle, f),
    penumbra: lerp(a.penumbra, b.penumbra, f),
  };
}

// f=1 이면 목표 객체를 그대로 돌려줘 "정확히 같은 값"과 참조 유지를 함께 보장한다.
export function lerpState(a: StageState, b: StageState, f: number): StageState {
  if (f >= 1) return b;
  return {
    color: lerpHex(a.color, b.color, f),
    spots: { left: lerpSpot(a.spots.left, b.spots.left, f), center: lerpSpot(a.spots.center, b.spots.center, f), right: lerpSpot(a.spots.right, b.spots.right, f) },
    camera: f >= 0.5 ? b.camera : a.camera,
    smoke: { density: lerp(a.smoke.density, b.smoke.density, f), color: lerpHex(a.smoke.color, b.smoke.color, f) },
  };
}

// 전환 중이 아니면 items[i].state 참조를 그대로 반환(React 재렌더 방지).
// 빈 items 는 던지지 않고 기본 상태를 돌려준다(컴포넌트는 빈 items 를 렌더하지 않는다).
// transitionMs 는 구간 길이로 clamp — 범위 밖 입력이 구간 경계에서 점프를 만들지 않게.
export function stateAt(items: SequenceItem[], tSec: number): StageState {
  const i = sectionIndexAt(items, tSec);
  if (i < 0) return defaultStageState("#ffffff");
  const cur = items[i];
  const dur = Math.min(cur.transitionMs, (cur.endSec - cur.startSec) * 1000);
  if (i === 0 || dur <= 0) return cur.state;
  const elapsedMs = (tSec - cur.startSec) * 1000;
  if (elapsedMs >= dur) return cur.state;
  return lerpState(items[i - 1].state, cur.state, easeInOut(Math.max(0, elapsedMs) / dur));
}

// 에너지 곡선을 count 개 막대(구간 평균)로 줄이고 최댓값 기준 0~1 로 정규화.
export function energyBars(curve: number[], count: number): number[] {
  if (curve.length === 0 || count <= 0) return [];
  const bars = Array.from({ length: count }, (_, k) => {
    const from = Math.floor((k * curve.length) / count);
    const to = Math.max(from + 1, Math.floor(((k + 1) * curve.length) / count));
    const part = curve.slice(from, Math.min(to, curve.length));
    return part.reduce((s, v) => s + v, 0) / part.length;
  });
  const max = Math.max(...bars);
  return max > 0 ? bars.map((v) => v / max) : bars.map(() => 0);
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
