"use client";

import { Canvas } from "@react-three/fiber";
import { Component, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
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
  children,
  ...canvasProps
}: ComponentProps<typeof Canvas> & { className?: string; fallback?: ReactNode; children: ReactNode }) {
  const webglOk = useHasWebGL();
  const fallbackNode = fallback === undefined ? <DefaultFallback className={className} /> : fallback;

  if (!webglOk) return fallbackNode;

  return (
    <SceneErrorBoundary fallback={fallbackNode}>
      <Canvas className={className} {...canvasProps}>
        {children}
      </Canvas>
    </SceneErrorBoundary>
  );
}
