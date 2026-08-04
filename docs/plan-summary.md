# ON-STAGE 1차 구현 계획 — 요약

> 이 문서는 `docs/plan.md`(superpowers `writing-plans`로 생성한 상세 구현 계획)의 요약본이다.
> 태스크 단위 목표와 설계 판단을 보여주기 위한 것으로, 실행용 코드/명령어는 원본에만 있다.

**Goal**: 가상 레이블 STAGE.ONE 플랫폼 1차 — A탭(팬: 궤도 메인 + 아티스트 스크롤 스토리) + B탭(관계자: 로그인/대시보드/무대 연출 3D 툴)을 Vercel 배포까지 완성한다.

**Architecture**: Next.js App Router 단일 앱. 데이터는 mock JSON → Route Handlers(`/api/*`) 경유로만 클라이언트에 전달. 3D는 섹션별 독립 R3F Canvas, 인증은 하드코딩 계정 + 쿠키 + 라우트 가드.

**Tech Stack**: Next.js(App Router), TypeScript strict, Tailwind CSS, React Three Fiber + drei, Recharts, Vitest(로직 테스트 전용).

---

## Global Constraints (모든 태스크에 적용)

- TypeScript strict 모드
- 3D는 처음부터 R3F로 작성 (바닐라 → 리팩토링 금지)
- 클라이언트는 API Routes 경유로 조회 (mock 데이터 직접 import 금지)
- **TDD는 로직 레이어만** (인증, API Routes, 데이터 변환). 비주얼 레이어(R3F/셰이더/레이아웃)에 형식적 테스트 생성 금지 — 브라우저 시각 검증으로 대체
- 1차는 데스크톱 기준 (반응형은 2차)
- Out of Scope (선제 구현 금지): 완전한 인증 시스템, i18n, 모바일 반응형, 실 결제/예매, 백엔드 서버 분리
- 커밋 컨벤션: Conventional Commits

---

## Task 목록

### Task 1 — 프로젝트 세팅
`src/` 구조 정리, 디자인 토큰 등록, 폰트(영문/한글 세리프) 추가, Vitest 세팅. 이후 모든 태스크의 기반이 되는 작업.

### Task 2 — 타입 + mock 데이터 + API Routes (TDD)
`Artist`, `Metrics` 타입 정의 및 mock JSON 작성. `/api/artists`, `/api/metrics` Route Handler를 TDD로 구현. 클라이언트는 이 API를 통해서만 데이터에 접근한다.

### Task 3 — 공통 헤더
A/B 탭 토글과 로고 헤더를 모든 화면에서 공용으로 쓸 수 있게 컴포넌트화.

### Task 4 — A탭 레이블 메인 (궤도)
`docs/mockups/a-depth1-orbit.png` 기반. 궤도 R3F 씬 + 하단 NOW 티커. 아티스트 노드 클릭 시 투어 페이지로 이동.

### Task 5 — 아티스트 투어 페이지 Hero
`docs/mockups/a-depth2-hero.png` 기반. 거대 세리프 타이포 + 셰이더 배경. 아티스트별 시그니처 컬러 반영.

### Task 6 — 스크롤 스토리
`docs/mockups/a-depth2-scroll-tour.png` 기반. 투어 도시 궤도 → 트랙 리스트 → 갤러리로 이어지는 스크롤 섹션 구현.

### Task 7 — B탭 로그인 + 인증 가드 (TDD)
`docs/mockups/b-login.png` 기반. 하드코딩 계정 검증 로직과 라우트 가드를 TDD로 구현. 미로그인 시 대시보드 접근 차단.

### Task 8 — B탭 대시보드
`docs/mockups/b-dashboard.png` 기반. 사이드바(메뉴 5개 — 대시보드만 실 화면, 무대 연출은 Task 9 자리표시, 나머지 3개는 Coming soon), 메트릭 카드 3종, 도시별 예매 차트(Recharts). 설계 보완으로 아티스트 선택기를 추가해 6팀의 지표를 전환할 수 있게 했다 — 선택 상태를 URL 쿼리(`?artist=`)에 두어 대시보드가 서버 컴포넌트로 남는다.

### Task 9 — 무대 연출 3D 툴
`docs/mockups/b-stage.png` 기반. R3F 무대 씬 + 우측 컨트롤 패널(조명 프리셋, 조명 on/off, 카메라 앵글 전환).

### Task 10 — README + 배포 + 완료 기준 점검
전체 품질 게이트(테스트/린트/빌드) 통과 확인 → README 작성(영문 요약 + 한국어 본문 + Development Process 섹션) → Vercel 배포 → 완료 기준 최종 점검.

---

## 계획 검증 노트 (Self-Review)

writing-plans 단계에서 계획 자체를 설계 문서와 대조 검증한 기록.

**스펙 커버리지**: 설계 문서 8장의 1차 범위 5개 항목이 Task 1~10에 빠짐없이 매핑되는지 확인.

**의도적 해석**: 설계 문서에 명시되지 않아 계획 단계에서 판단이 필요했던 지점들 — 예를 들어 도시 노드 클릭 시 "상세 화면"은 설계에 별도 라우트가 없어 섹션 내 정보 표시로 최소 구현하기로 함. 이런 판단은 구현자가 임의로 바꾸지 않도록 계획에 명시해 고정.

**알려진 함정 재확인**: 프레임워크 버전 관련 주의사항(동적 라우트 파라미터 처리 방식, 라우트 가드 파일 위치 등)을 각 태스크에 다시 한번 연결해 실수 방지.

---
