"use client";

import { RoundedBox } from "@react-three/drei";
import type { PropKey } from "@/lib/stage/scene";

// 연단 윗면 y=0.8. 중앙(스포트라이트·무대 중심)을 비우고 가장자리/뒤쪽에 둔다.
// 단순 primitive 만 쓰고 castShadow 는 켜지 않는다(외부 모델 파일 없음).
//
// 소품은 무대 가장자리라 스포트라이트가 거의 닿지 않고(전체 조명 ambient 0.15) 밝은 배경 앞에서 검은 실루엣이나
// 납작한 색 덩어리로 보였다. 그래서 (1) 약한 자체 발광으로 색을 살리고 (2) 소품마다 작은 보조 조명(범위 제한)을 둬서
// 면마다 밝기가 달라 입체감이 보이게 한다. 보조 조명은 소품이 켜져 있을 때만 씬에 올라간다.
const SHELL = "#6a58b8"; // 몸통(보라)
const CAB = "#34305e"; // 앰프 캐비닛
const GRILLE = "#1e1b3a"; // 앰프 그릴
const HEAD = "#efeaff"; // 드럼 헤드
const CHROME = "#d2cfe8"; // 하드웨어
const GOLD = "#e3bd5c"; // 심벌

type V3 = [number, number, number];

function Mat({ color, metal = false, glow = 0.18 }: { color: string; metal?: boolean; glow?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={metal ? 0.75 : 0.1}
      roughness={metal ? 0.3 : 0.55}
      emissive={color}
      emissiveIntensity={glow}
    />
  );
}

// 헤드(얇은 원판)와 림(토러스)을 얹은 북 한 개. 축은 Y.
function Shell({ r, h, pos, tilt = 0 }: { r: number; h: number; pos: V3; tilt?: number }) {
  return (
    <group position={pos} rotation={[tilt, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, h, 24]} />
        <Mat color={SHELL} />
      </mesh>
      <mesh position={[0, h / 2 + 0.004, 0]}>
        <cylinderGeometry args={[r * 0.97, r * 0.97, 0.012, 24]} />
        <Mat color={HEAD} glow={0.3} />
      </mesh>
      <mesh position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, 0.012, 8, 28]} />
        <Mat color={CHROME} metal />
      </mesh>
      <mesh position={[0, -h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r, 0.012, 8, 28]} />
        <Mat color={CHROME} metal />
      </mesh>
    </group>
  );
}

// from → to 를 잇는 가는 원통(스탠드·다리)
function Pole({ from, to, r = 0.012 }: { from: V3; to: V3; r?: number }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const len = Math.hypot(dx, dy, dz);
  const rotZ = -Math.atan2(dx, dy);
  const rotX = Math.atan2(dz, Math.hypot(dx, dy));
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]} rotation={[rotX, 0, rotZ]}>
      <cylinderGeometry args={[r, r, len, 8]} />
      <Mat color={CHROME} metal />
    </mesh>
  );
}

function Cymbal({ pos, r, tilt = 0.12 }: { pos: V3; r: number; tilt?: number }) {
  return (
    <group position={pos} rotation={[tilt, 0, 0.05]}>
      <mesh>
        <cylinderGeometry args={[r, r * 0.96, 0.012, 28]} />
        <Mat color={GOLD} metal glow={0.3} />
      </mesh>
      <mesh position={[0, 0.006, 0]}>
        <sphereGeometry args={[r * 0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color={GOLD} metal glow={0.3} />
      </mesh>
    </group>
  );
}

const KNOBS = [-0.35, -0.175, 0, 0.175, 0.35];
const CORNERS: V3[] = [
  [-0.5, 0.03, 0.28],
  [0.5, 0.03, 0.28],
  [-0.5, 1.22, 0.28],
  [0.5, 1.22, 0.28],
];

function Amp() {
  return (
    <group position={[-3.2, 0.8, -1.2]} rotation={[0, 0.3, 0]}>
      {/* 캐비닛 */}
      <RoundedBox args={[1.05, 1.25, 0.6]} radius={0.04} smoothness={3} position={[0, 0.65, 0]}>
        <Mat color={CAB} />
      </RoundedBox>
      {/* 윗면 컨트롤 띠 + 노브 + 손잡이 */}
      <mesh position={[0, 1.17, 0.2]}>
        <boxGeometry args={[0.95, 0.12, 0.2]} />
        <Mat color={GRILLE} />
      </mesh>
      {KNOBS.map((x) => (
        <mesh key={x} position={[x, 1.14, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.05, 12]} />
          <Mat color={CHROME} metal />
        </mesh>
      ))}
      <mesh position={[0, 1.3, 0]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.13, 0.015, 8, 16, Math.PI]} />
        <Mat color={CHROME} metal />
      </mesh>
      {/* 스피커 그릴 + 콘 */}
      <mesh position={[0, 0.5, 0.305]}>
        <planeGeometry args={[0.86, 0.82]} />
        <Mat color={GRILLE} glow={0.1} />
      </mesh>
      <mesh position={[0, 0.5, 0.31]}>
        <circleGeometry args={[0.3, 28]} />
        <Mat color={SHELL} glow={0.12} />
      </mesh>
      <mesh position={[0, 0.5, 0.315]}>
        <circleGeometry args={[0.1, 20]} />
        <Mat color={GRILLE} glow={0.1} />
      </mesh>
      <mesh position={[0, 0.5, 0.312]}>
        <ringGeometry args={[0.3, 0.325, 28]} />
        <Mat color={CHROME} metal />
      </mesh>
      {/* 로고 판 */}
      <mesh position={[0, 0.08, 0.306]}>
        <planeGeometry args={[0.28, 0.05]} />
        <Mat color={GOLD} metal glow={0.25} />
      </mesh>
      {/* 모서리 보호대 */}
      {CORNERS.map((p) => (
        <mesh key={p.join()} position={p}>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <Mat color={CHROME} metal />
        </mesh>
      ))}
    </group>
  );
}

const FLOOR_TOM_LEGS = [0, 2.094, 4.188];

function Drum() {
  return (
    <group position={[2.55, 0.8, -1.15]}>
      {/* 베이스 드럼: 축이 Z 라 눕혀서 그린다. 앞면은 헤드와 림 */}
      <group position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.44, 0.44, 0.58, 28]} />
          <Mat color={SHELL} />
        </mesh>
        <mesh position={[0, 0.292, 0]}>
          <cylinderGeometry args={[0.425, 0.425, 0.012, 28]} />
          <Mat color={HEAD} glow={0.3} />
        </mesh>
        <mesh position={[0, 0.295, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.44, 0.016, 8, 32]} />
          <Mat color={CHROME} metal />
        </mesh>
        <mesh position={[0, -0.292, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.44, 0.016, 8, 32]} />
          <Mat color={CHROME} metal />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 0.13, 20]} />
          <Mat color={SHELL} glow={0.15} />
        </mesh>
      </group>
      {/* 랙 탐 둘 + 받침대 */}
      <Pole from={[0, 0.88, -0.05]} to={[0, 1.0, -0.05]} r={0.016} />
      <Shell r={0.2} h={0.2} pos={[-0.27, 1.05, -0.02]} tilt={0.22} />
      <Shell r={0.2} h={0.2} pos={[0.27, 1.05, -0.02]} tilt={0.22} />
      {/* 플로어 탐 + 다리 3개 */}
      <Shell r={0.28} h={0.4} pos={[0.85, 0.62, 0.15]} />
      {FLOOR_TOM_LEGS.map((a) => (
        <Pole
          key={a}
          from={[0.85 + Math.cos(a) * 0.25, 0.42, 0.15 + Math.sin(a) * 0.25]}
          to={[0.85 + Math.cos(a) * 0.3, 0, 0.15 + Math.sin(a) * 0.3]}
          r={0.014}
        />
      ))}
      {/* 스네어 + 스탠드 */}
      <Shell r={0.2} h={0.13} pos={[-0.72, 0.72, 0.3]} tilt={0.08} />
      <Pole from={[-0.72, 0, 0.3]} to={[-0.72, 0.64, 0.3]} r={0.014} />
      {/* 하이햇 */}
      <Pole from={[-1.1, 0, -0.1]} to={[-1.1, 1.0, -0.1]} />
      <Cymbal pos={[-1.1, 0.98, -0.1]} r={0.18} tilt={0.02} />
      <Cymbal pos={[-1.1, 1.01, -0.1]} r={0.18} tilt={0.02} />
      {/* 크래시 */}
      <Pole from={[1.1, 0, -0.45]} to={[1.1, 1.5, -0.45]} />
      <Cymbal pos={[1.1, 1.52, -0.45]} r={0.3} tilt={0.18} />
      {/* 의자 */}
      <Pole from={[0, 0, -0.75]} to={[0, 0.5, -0.75]} r={0.02} />
      <mesh position={[0, 0.54, -0.75]}>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 20]} />
        <Mat color={CAB} />
      </mesh>
    </group>
  );
}

function Mic() {
  return (
    <group position={[-1.1, 0.8, 1.1]}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 20]} />
        <Mat color={CHROME} metal />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.4, 8]} />
        <Mat color={CHROME} metal />
      </mesh>
      <mesh position={[0, 1.44, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.1, 10]} />
        <Mat color={CHROME} metal />
      </mesh>
      <mesh position={[0, 1.53, 0]}>
        <sphereGeometry args={[0.07, 14, 14]} />
        <Mat color={GRILLE} glow={0.25} />
      </mesh>
    </group>
  );
}

// 보조 조명은 소품이 하나라도 있으면 세 개를 항상 마운트하고 intensity 만 바꾼다.
// 조명 개수가 바뀌면 three 가 조명을 받는 모든 재질의 셰이더를 다시 컴파일해서 토글할 때 화면이 멈칫한다.
// (소품이 하나도 없는 상태 ↔ 있는 상태를 오갈 때만 한 번 컴파일된다)
const FILL_LIGHTS: { key: PropKey; pos: V3; on: number }[] = [
  { key: "amp", pos: [-2.1, 3.0, 0.34], on: 9 },
  { key: "drum", pos: [2.15, 3.2, 0.75], on: 9 },
  { key: "mic", pos: [-0.7, 3.0, 2.3], on: 5 },
];

export default function StageProps({ props }: { props: readonly PropKey[] }) {
  return (
    <>
      {props.length > 0 &&
        FILL_LIGHTS.map((l) => <pointLight key={l.key} position={l.pos} intensity={props.includes(l.key) ? l.on : 0} distance={6} decay={2} />)}
      {props.includes("amp") && <Amp />}
      {props.includes("drum") && <Drum />}
      {props.includes("mic") && <Mic />}
    </>
  );
}
