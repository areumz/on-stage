# ON-STAGE — 설계 문서 (Design Document)

> 팬이 보는 무대와, 관계자가 만드는 무대.
> 하나의 엔터테인먼트 레이블 플랫폼을 두 개의 시점(A/B탭)으로 구현하는 인터랙티브 웹 프로젝트.

- **상태**: 설계 승인 완료 (v1.0)
- **다음 단계**: 이 문서를 승인된 설계로 간주하고 `writing-plans`부터 진행
- **목업**: `docs/mockups/`에 화면별 참고 이미지 포함. 각 목업은 정적 HTML로 그린 레이아웃 참고용이며,
  궤도·씬 등 3D 요소는 이미지 그대로가 아니라 R3F로 재구현한다 (각 화면 섹션에 구분 명시).
  아직 목업이 없는 화면(무대 연출 툴, 앨범/갤러리 섹션 등)은 동일 디자인 시스템 톤 안에서 자유롭게 구성한다.

---

## 1. 프로젝트 개요

가상의 엔터테인먼트 레이블 **STAGE.ONE**의 통합 플랫폼.
상단 A/B 탭 전환으로 두 개의 세계를 오간다.

| | A탭 · Fans | B탭 · Staff |
|---|---|---|
| 사용자 | 팬 (Public) | 관계자 (Private, 로그인) |
| 무드 | 어두운 무대 조명, 몰입형 | 밝은 SaaS 대시보드, 프로페셔널 |
| 핵심 기술 | Three.js(R3F) 비주얼, 셰이더, 스크롤 애니메이션 | 데이터 fetch 구조, 차트, 3D 무대 연출 툴 |

탭 전환 시 무드가 극적으로 반전되는 것 자체가 핵심 데모 포인트.

---

## 2. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| Framework | Next.js (App Router) | `create-next-app@latest`, `src/` 디렉토리 사용 |
| Language | TypeScript | strict 모드 |
| Styling | Tailwind CSS | R3F 씬 외부 UI |
| 3D | Three.js + React Three Fiber + drei | **처음부터 R3F로 작성** (바닐라 → 리팩토링 금지) |
| Chart | Recharts | B탭 대시보드 |
| 데이터 (1차) | mock JSON + Next.js API Routes | 클라이언트는 API Routes 경유로 fetch |
| 데이터/인증 (2차) | Supabase (Auth + DB) | 1차는 하드코딩 로그인 |
| 배포 | Vercel | |
| Node | v22 | `.nvmrc` 커밋 |
| License | MIT | |

---

## 3. 라우팅 / 폴더 구조

```
src/
├── app/
│   ├── layout.tsx              # 공통 레이아웃 (A/B 탭 토글 포함)
│   ├── page.tsx                # A탭: 레이블 메인 (궤도)
│   ├── artists/[slug]/page.tsx # A탭: 아티스트 투어 페이지
│   ├── staff/
│   │   ├── login/page.tsx      # B탭: 로그인
│   │   ├── dashboard/page.tsx  # B탭: 대시보드
│   │   └── stage/page.tsx      # B탭: 무대 연출 3D 툴 (풀스크린)
│   └── api/
│       ├── artists/route.ts    # 아티스트/투어 데이터
│       └── metrics/route.ts    # 대시보드 지표 데이터
├── components/
│   ├── common/                 # 탭 토글, 헤더 등
│   ├── fans/                   # A탭 전용 (Orbit, HeroTypo, TourSection …)
│   ├── staff/                  # B탭 전용 (Sidebar, MetricCard, CityChart …)
│   └── three/                  # R3F 씬/오브젝트 (양 탭 공용)
├── data/                       # mock JSON (artists.json, metrics.json)
├── lib/                        # 유틸, fetch 헬퍼, 타입
└── docs/                       # 설계 문서 및 구현 계획
```

- A/B 탭 토글은 전 화면 공통 헤더에 상시 노출 (`A · Fans` / `B · Staff`)
- B탭 진입 시 미로그인 상태면 `/staff/login`으로 리다이렉트

---

## 4. A탭 (Fans) 상세 설계

### 4.1 레이블 메인 — 궤도 (`/`)

**목업**: [`mockups/a-depth1-orbit.png`](./mockups/a-depth1-orbit.png)

> 목업은 정적 HTML로 그린 참고용 레이아웃이다. 실제 구현에서 궤도·노드는 R3F로 대체하고,
> 헤더/토글/하단 티커는 목업과 동일하게 일반 UI(Tailwind)로 구현한다.

- 최상단: 좌측 로고 배지(`STAGE.ONE`), 우측 A/B 탭 토글 — 모든 화면 공통, 고정 위치
- 중앙: 3중 동심원 궤도. 중심에 레이블명 + 소속 아티스트 수(`6 artists · est. 2020`)
- 궤도 위 아티스트 노드 6개, 각각 원형 아바타(이니셜) + 하단 이름 라벨
  - 목업 상 배치: AURORA(상단), VELVET(좌상), NOVA(우), HALO(좌), LUMEN(좌하), ECHO(우하)
  - 노드 크기는 랭크에 따라 미세하게 다름 (AURORA가 가장 큼 → 메인 아티스트 강조 의도)
- 좌하단: `HOVER · CLICK TO ENTER` 안내 텍스트 (인터랙션 힌트)
- 하단 바: 구분선 아래 가로 티커. `● NOW` 배지 + 아티스트별 소식 텍스트가 좌→우로 나열
- 인터랙션
  - 궤도 자동 회전 (useFrame)
  - 아티스트 노드 hover: 스케일 업 + 이름 노출
  - 클릭: 해당 아티스트 투어 페이지로 전환 (레이캐스터)

### 4.2 아티스트 투어 페이지 — 거대 타이포 (`/artists/[slug]`)

**목업**: [`mockups/a-depth2-hero.png`](./mockups/a-depth2-hero.png) (Hero 영역),
[`mockups/a-depth2-scroll-tour.png`](./mockups/a-depth2-scroll-tour.png) (스크롤 2번째 섹션)

> Hero의 배경은 목업에선 단색이지만 실제로는 셰이더로 대체. 투어 궤도(2번째 섹션)의
> 궤도/노드도 4.1과 마찬가지로 R3F로 대체, 텍스트·배지·CTA는 Tailwind로 구현.

**Hero 섹션 레이아웃** (목업 기준)
- 좌상단 브레드크럼 `← 레이블 / AURORA`, 우상단 A/B 탭 토글 (공통 헤더)
- 중앙 정렬: 상태 배지(`● World Tour 2026 · 24 cities`) → 거대 세리프 영문(`AURORA`) → 한글 서브(`오로라 월드투어`, 브랜드 컬러)
- CTA 2개 가로 배치: 채워진 버튼(`투어 일정 보기 →`) + 아웃라인 버튼(`앨범 듣기`)
- 하단 스탯 3열(`24 cities / 12 countries / 8 tracks`), 그 아래 `SCROLL ↓` 안내

**섹션 02 · 투어 궤도 레이아웃** (목업 기준)
- 좌측: 라벨(`SECTION 02 · TOUR`) + 헤드라인(`24개 도시가 궤도 위에 펼쳐집니다`) + 설명 문구
- 우측: 소형 이중 궤도, 중심에 연도(`2026`), 궤도 위 도시 노드(SEO/TYO/LA/LDN) 배치
- 좌-우 2열 구성, 텍스트가 항상 좌측 고정이고 궤도 비주얼만 스크롤에 반응해 회전

**스크롤 스토리 전체 구성** (Scroll based animation 적용)
  1. Hero (거대 타이포)
  2. 투어 도시 궤도 섹션 (도시 노드 회전, 클릭 시 상세) — 목업 있음
  3. 앨범/트랙 리스트 — 목업 없음, Hero/섹션2와 동일 톤(다크 + 브랜드 컬러 포인트)으로 자유 구성
  4. 갤러리 — 목업 없음, 동일 톤으로 자유 구성

### 4.3 A탭 데이터

- `data/artists.json`: slug, 이름(영/한), 컬러, 셰이더 테마, 투어 도시 목록, 앨범/트랙, 스탯
- 클라이언트는 `/api/artists` 경유로 조회한다 (mock 데이터 직접 import 금지)

---

## 5. B탭 (Staff) 상세 설계

### 5.1 로그인 (`/staff/login`)

**목업**: [`mockups/b-login.png`](./mockups/b-login.png)

> A탭과 달리 밝은 톤(`--surface-1/2`). 헤더의 A/B 토글은 공통이나 배경·카드 색상이 B탭 전용 라이트 팔레트로 전환됨.

- 헤더는 A탭과 동일 구조(로고 + A/B 토글)이나 배경이 밝은 톤으로 전환 — 탭 전환 시 무드 반전을 로그인 화면부터 시작
- 화면 중앙에 단일 카드: 자물쇠 아이콘 + 타이틀(`관계자 로그인`) + 서브텍스트(`투어 운영 및 무대 연출 시스템`)
- 아이디/비밀번호 입력 필드 세로 배치, 하단에 채워진 버튼(`로그인`)
- 카드 최하단: 데모 계정 안내를 작은 muted 텍스트로 표기
- 1차: 하드코딩 계정 (예: `admin / 1234`)
- 로그인 성공 시 `/staff/dashboard` 이동, 실패 시 인라인 에러
- 2차 고도화: Supabase Auth로 교체 (OAuth2 플로우 문서화 포함)

### 5.2 대시보드 (`/staff/dashboard`)

**목업**: [`mockups/b-dashboard.png`](./mockups/b-dashboard.png)

- 좌측 고정 사이드바(로고 + "관계자 전용" 라벨 + 메뉴 5개), 우측 메인 콘텐츠 영역
- 사이드바 메뉴 (5): 대시보드 / 투어 일정 / 무대 연출 / 아티스트 / 티켓 현황
  - 현재 메뉴(대시보드)는 좌측 액센트 보더 + 연한 배경으로 활성 표시
  - 1차 구현 범위: 대시보드만 실 화면, 나머지는 라우팅 + 빈 화면(Coming soon)
- 메인 상단: 타이틀(`대시보드`) + 서브텍스트(`AURORA 월드투어 2026 · 실시간`), 우측에 A/B 토글
- 메트릭 카드 3종을 가로 그리드로: 총 티켓 판매 / 평균 예매율 / 다음 공연 D-day (각 카드에 보조 지표 한 줄 포함)
- 하단 2열 그리드
  - 좌: "도시별 예매 현황" 막대 차트 카드 (밝은 톤, Recharts로 대체)
  - 우: "무대 연출" 카드 — 다크 톤으로 반전(A탭 무드 미리보기), 하단에 `미리보기` / `열기 →` 버튼 2개. `열기` 클릭 시 `/staff/stage` 진입
- 모든 수치는 `/api/metrics` 경유 fetch (mock JSON 기반)

### 5.3 무대 연출 3D 툴 (`/staff/stage`)

**목업**: [`mockups/b-stage.png`](./mockups/b-stage.png)

> 좌측 무대(연단+배경패널+조명 콘)는 목업에선 정적 도형이지만 실제로는 R3F 씬으로 대체.
> 우측 컨트롤 패널은 Tailwind로 구현하고, 조작 시 좌측 R3F 씬에 실시간 반영되어야 한다.

- 상단: 브레드크럼(`← 대시보드 / 무대 연출`) + 우측 현재 셋업 배지(예: `서울 · 고척돔 셋업`)
- 좌측(가변 폭): R3F 뷰포트. 무대 연단 + 배경 패널 위로 좌/중앙/우 3개 스포트라이트가 원뿔로 비춤
  - 좌하단에 `DRAG TO ORBIT · SCROLL TO ZOOM` 조작 안내 텍스트
- 우측(고정 폭 패널): 컨트롤 3그룹, 세로 스택
  1. **조명 프리셋** — 컬러 스와치 3개(아티스트 시그니처 컬러와 동일 팔레트), 선택된 것은 흰 테두리로 표시
  2. **조명 전원** — 개별 스팟(Left/Center/Right) on/off 토글 스위치, 라벨 텍스트
  3. **카메라 앵글** — 프리셋 버튼 3개(정면/객석뷰/탑뷰), 선택된 것은 채워진 배경으로 표시
- 1차 컨트롤 범위 (최소 기능)
  - 조명 색상 변경 (2~3 프리셋)
  - 조명 on/off 토글
  - 카메라 앵글 프리셋 전환
- 2차 고도화: 스모그/파티클, 조명 각도 세밀 조절, 프리셋 저장

---

## 6. 디자인 시스템

> 아래 표는 스펙 정의이며, 구현 시 `tailwind.config.ts` theme에 토큰으로 등록해 코드가 단일 진실 공급원이 되도록 한다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `bg-dark` | #0E0A1F / #13102A | A탭 배경 |
| `brand` | #9F77DD | 레이블 브랜드 컬러, CTA |
| `brand-soft` | #C7B3F0 | 보조 텍스트, 배지 |
| Artist colors | #7F77DD / #D4537E / #378ADD / #1D9E75 / #BA7517 | 아티스트별 시그니처 |
| 타이포 (Hero) | 세리프 계열 대형 | A탭 거대 타이포 |
| 타이포 (UI) | 산세리프 | 본문/B탭 |

- A탭: 다크 + 네온 포인트, 무대 조명 무드
- B탭: 라이트 + 카드 기반, 데이터 가독성 우선
- 반응형은 2차 범위 (1차는 데스크톱 기준)

---

## 7. 개발 워크플로우

### 7.1 프로세스 (Superpowers 기반)

```
[설계]  이 문서 = 승인된 설계 (brainstorming 완료)
[계획]  writing-plans        → docs/plan.md 생성
[구현]  executing-plans      → 배치 실행 + 사람 체크포인트
        (subagent-driven-development는 사용하지 않음)
[품질]  TDD (범위 한정, 아래 7.2)
        requesting-code-review → /ponytail-review (과잉 구현 정리)
        verification-before-completion
[머지]  finishing-a-development-branch → PR 생성
        react-doctor CI 스캔 (자동) → 이슈 시 receiving-code-review 루프 → merge
```

### 7.2 TDD 적용 범위

| 레이어 | TDD | 검증 방법 |
|---|---|---|
| 로직: 인증 로직, API Routes, 데이터 변환, 상태 관리 | ✅ RED-GREEN-REFACTOR | 자동 테스트 |
| 비주얼: R3F 씬, 셰이더, 애니메이션, 레이아웃 | ❌ 테스트 강제 금지 | 시각 검증 (브라우저 확인) |

> 구현 에이전트 주의: 비주얼 레이어에 형식적 테스트를 생성하지 말 것.

### 7.3 품질 도구

- **Ponytail**: 상시 활성 (full 모드) + PR 전 `/ponytail-review`
- **React Doctor**:
  - 로컬 스킬 설치 (`npx react-doctor@latest install`) — 작성 단계 예방
  - CI 설치 (`npx react-doctor@latest ci install`) — PR 자동 스캔 + 코멘트 (최종 안전망)
- **Playwright**: 비주얼 레이어(R3F/셰이더/레이아웃) 시각 검증에 사용. TDD 대상이 아닌 화면을
  headless 브라우저로 실제 렌더링해 스크린샷으로 대조한다 (`npm install -D playwright`).
- 커밋 컨벤션: Conventional Commits (`feat:` `fix:` `chore:` …)

### 7.4 문서화

- README에 "Development Process" 섹션: AI 협업 워크플로우 명시
- 2차에서 Supabase Auth 도입 시 OAuth2 인증 플로우 문서 추가

---

## 8. 구현 범위

### 1차 (배포까지)

- 프로젝트 세팅 (.nvmrc, CI, 워크플로우 도구)
- A/B 탭 공통 레이아웃 및 전환
- A탭: 레이블 메인 궤도, 아티스트 투어 페이지(거대 타이포 + 셰이더 배경 + 스크롤 스토리)
- B탭: 로그인(하드코딩), 대시보드(메트릭 카드 + 차트), 무대 연출 3D 씬(최소 기능)
- Vercel 배포, README 정리

### 2차 (고도화)

- Supabase Auth + DB 전환 (하드코딩 제거)
- 무대 연출 툴 고도화 (스모그, 세밀 조명, 프리셋)
- 반응형 대응
- 사이드바 잔여 메뉴 실 화면 구현
- 셰이더 심화 (아티스트별 차별화 확대)

---

## 9. 범위 제외 (1차 기준 명시적 Out of Scope)

- 실제 회원가입/비밀번호 재설정 등 완전한 인증 시스템
- 다국어(i18n)
- 모바일 반응형
- 실 결제/예매 기능
- 백엔드 서버 분리 (API Routes로 충분)

> 구현 에이전트 주의: 위 항목을 선제적으로 구현하지 말 것 (YAGNI).

---

## 10. 완료 기준 (1차)

- [ ] Vercel 배포 URL에서 A탭 전체 플로우 동작 (궤도 → 아티스트 → 스크롤 스토리)
- [ ] B탭 로그인 → 대시보드 → 무대 씬 진입 동작
- [ ] 모든 화면 데이터가 API Routes 경유로 로드
- [ ] react-doctor CI 통과 (error 레벨 0)
- [ ] README에 프로젝트 소개(영문 요약 + 한국어 본문) + Development Process 섹션