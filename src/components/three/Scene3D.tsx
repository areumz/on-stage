"use client";

import { Canvas } from "@react-three/fiber";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

// 모듈 스코프에 한 번만 캐싱
// 기존에 캔버스와 WebGL 컨텍스트를 계속 새로 만드는 현상 (실측: 스크롤 20회에 여분의 컨텍스트 요청 5회)
// 눈에 보이는 캔버스 3개보다 실제 소모되는 컨텍스트가 훨씬 많아져 브라우저의 동시 WebGL 컨텍스트
// 한도를 쉽게 넘기고, "Too many active WebGL contexts"로 기존 렌더링 캔버스가 밀려나는 현상 생김
//  WebGL 가용 여부는 세션 중 안 바뀌니 한 번 계산한 값을 재사용
let cachedHasWebGL: boolean | null = null;
function hasWebGL(): boolean {
  if (cachedHasWebGL !== null) return cachedHasWebGL;
  try {
    const canvas = document.createElement("canvas");
    cachedHasWebGL = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    cachedHasWebGL = false;
  }
  return cachedHasWebGL;
}

function noopSubscribe() {
  return () => {};
}

// WebGL 가용 여부는 세션 중 안 바뀌니 subscribe는 no-op — 클라이언트에서 한 번만 읽으면 된다.
// SSR엔 canvas API가 없어 getServerSnapshot으로 낙관적 기본값(true)을 준다. useEffect에서
// setState로 뒤늦게 보정하는 방식은 hydration 직후 리렌더를 유발해 린트가 지적한다 —
// useSyncExternalStore가 서버/클라이언트 스냅샷을 구분해 주는 게 이 문제의 정석 해법이다.
function useHasWebGL(): boolean {
  return useSyncExternalStore(noopSubscribe, hasWebGL, () => true);
}

function DefaultFallback({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-8 text-center text-sm text-white/50 ${className ?? ""}`}>
      3D 콘텐츠를 표시할 수 없습니다. 최신 브라우저(Chrome, Safari 16.4+ 등)로 다시 시도해주세요.
    </div>
  );
}

// 브라우저가 GPU 자원 압박 등으로 WebGL 컨텍스트를 일시적으로 잃었다가 스스로 복구하는 경우 대비
// 기본 동작대로 두면 캔버스에 브라우저가 그리는 깨진 아이콘이 뜨는데, 고장으로 보일 수 있으므로 아래 문구 노출
function ContextLostOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-dark/80 p-8 text-center text-sm text-white/70">
      일시적으로 3D 콘텐츠를 표시할 수 없습니다. 잠시 후 다시 시도해주세요.
    </div>
  );
}

// webglcontextlost는 JS 에러를 던지지 않는 캔버스 DOM 이벤트라 SceneErrorBoundary로는 못 잡는다.
// preventDefault()를 반드시 호출해야 브라우저가 나중에 webglcontextrestored로 복구를 시도한다 —
// 안 부르면 컨텍스트가 영구히 죽은 채로 남는다.
//
// 300ms 유예를 둔다 — 브라우저가 순간적으로 컨텍스트를 놓쳤다 곧바로 되찾는 경우(예: 짧은 GPU
// 자원 경합)까지 전부 문구로 띄우면 오히려 거슬린다. 이 유예 시간 안에 restored가 오면 문구를
// 아예 안 띄운다. 실제로 몇 초 이상 이어지는 경우에만 사용자에게 알린다.
const SHOW_DELAY_MS = 300;

function useCanvasContextLoss(canvasRef: React.RefObject<HTMLCanvasElement | null>): boolean {
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onLost = (e: Event) => {
      e.preventDefault();
      timer = setTimeout(() => setLost(true), SHOW_DELAY_MS);
    };
    const onRestored = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      setLost(false);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      if (timer) clearTimeout(timer);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [canvasRef]);
  return lost;
}

// WebGL 사전 체크로 못 거른 런타임 실패(셰이더 컴파일 에러 등)에 대한 안전망
class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error("3D 씬 렌더링 실패:", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// R3F의 Canvas를 그대로 대체해서 쓰는 안전판. WebGL을 못 만들거나(사전 체크) 렌더 중 에러가
// 나면(에러 바운더리) 3D 대신 fallback을 보여준다 — 화면이 조용히 비어 고장난 것처럼 보이는
// 대신 이유를 알린다. Safari 15.6 등 구형 브라우저를 지원 범위에 넣는 건 아니고, 실패를
// 눈에 보이게만 만든다. fallback을 안 주면 기본 안내 문구, null을 주면 조용히 아무것도 안 보임
// (장식용 효과처럼 실패해도 다른 콘텐츠에 지장이 없는 경우용).
export default function Scene3D({
  className,
  fallback,
  notifyContextLoss = false,
  children,
  ...canvasProps
}: ComponentProps<typeof Canvas> & {
  className?: string;
  fallback?: ReactNode;
  /** 컨텍스트 손실 감지·복구 처리(감싸는 div, resize 오버라이드, ContextLostOverlay 문구)
   *  기본 false — 이 기능을 만들기 전과 동일한, 아무것도 안 하는 구조로 렌더
   *  배경/장식용 씬(히어로·오빗·갤러리 먼지 등)은 이 처리 x
   *  B탭에서 조작 중인 콘텐츠(무대 연출 툴)만 켬. */
  notifyContextLoss?: boolean;
  children: ReactNode;
}) {
  const webglOk = useHasWebGL();
  const fallbackNode = fallback === undefined ? <DefaultFallback className={className} /> : fallback;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Hook 규칙상 조건부로 호출할 수 없어 항상 부른다. notifyContextLoss가 꺼져 있으면 아래에서
  // canvasRef를 Canvas에 연결하지 않으므로 canvas가 계속 null이라 이 훅은 그냥 아무 일도 안 한다.
  const contextLost = useCanvasContextLoss(canvasRef);

  if (!webglOk) return fallbackNode;

  if (!notifyContextLoss) {
    return (
      <SceneErrorBoundary fallback={fallbackNode}>
        <Canvas className={className} {...canvasProps}>
          {children}
        </Canvas>
      </SceneErrorBoundary>
    );
  }

  return (
    <div className="relative h-full w-full bg-bg-dark">
      <SceneErrorBoundary fallback={fallbackNode}>
        {/* R3F Canvas는 기본적으로 스크롤할 때마다 컨테이너 크기를 다시 재는데(react-use-measure의
            scroll:true), 무대 연출 툴 패널은 스크롤로 실제 크기가 바뀌지 않으니 필요 없다. 그
            재측정이 슬라이더 드래그 때와 같은 <Canvas> 재구성을 다시 유발해 스크롤 중
            webglcontextlost가 나는 걸 확인했다 — 꺼서 막는다 */}
        <Canvas ref={canvasRef} className={className} resize={{ scroll: false }} {...canvasProps}>
          {children}
        </Canvas>
      </SceneErrorBoundary>
      {contextLost && <ContextLostOverlay />}
    </div>
  );
}
