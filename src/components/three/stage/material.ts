// react-hooks/immutability 가 훅이 돌려준 three 객체를 프레임 콜백에서 직접 고치는 걸 막아서, 값 갱신은 이 헬퍼로 할 것
export const setOpacity = (m: { opacity: number }, v: number) => {
  m.opacity = v;
};

