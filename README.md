# STAGE.ONE

A dual-perspective platform for a fictional entertainment label — the stage fans see, and the stage staff build.

팬이 보는 무대와, 관계자가 만드는 무대 — 가상의 엔터테인먼트 레이블을 위한 두 시점의 플랫폼.

---

## 데모 / Demo

배포 후 이 자리에 Vercel 데모 링크가 추가될 예정입니다.

> **Live demo:** _coming soon (will be added after Vercel deployment)_

---

## 소개 / Introduction

**STAGE.ONE**은 가상의 엔터테인먼트 레이블을 배경으로, 하나의 플랫폼을 두 개의 시점으로 구현한 인터랙티브 웹 프로젝트입니다. 화면 상단의 A/B 탭으로 두 세계를 오갈 수 있습니다.

- **A탭 · Fans** — 팬이 보는 무대. 어두운 조명과 궤도 비주얼, 셰이더, 스크롤 애니메이션으로 몰입감을 준다. 레이블 메인의 3중 궤도에서 아티스트를 선택하면, 거대한 타이포와 셰이더 배경으로 시작하는 아티스트별 투어 페이지로 이동한다.
- **B탭 · Staff** — 관계자가 만드는 무대. 밝은 톤의 대시보드로, 로그인 후 티켓 판매·예매율 같은 지표를 확인하고 3D 무대 연출 툴에서 조명과 카메라 앵글을 직접 조작할 수 있다.

탭을 전환할 때 무드가 극적으로 반전되는 것 자체가 이 프로젝트의 핵심 데모 포인트입니다.

STAGE.ONE reimagines a single label platform through two lenses, switched via an A/B tab in the header. The **A tab (Fans)** is a dark, immersive world built on orbiting 3D visuals, shaders, and scroll-driven storytelling — starting from a label-wide orbit view and drilling into per-artist tour pages. The **B tab (Staff)** is a bright, professional dashboard behind a login wall, where staff review ticket/booking metrics and control a 3D stage-lighting tool. The deliberate mood reversal between tabs is the project's central demo moment.

---

## 기술 스택 / Tech Stack

이 프로젝트는 다음 스택으로 구성되어 있습니다.

| 영역 | 선택 |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| 3D | React Three Fiber + drei (Three.js) |
| Chart | Recharts |
| 데이터 (1차) | mock JSON + Next.js API Routes |
| 테스트 | Vitest (로직 레이어 전용) |
| 배포 | Vercel |
| Node | v22 (`.nvmrc`) |

The stack: Next.js 16 (App Router) with strict TypeScript, Tailwind CSS v4, React Three Fiber + drei for all 3D scenes, Recharts for the staff dashboard, and mock JSON served through Next.js API Routes for data (phase 1). Logic-layer code is covered by Vitest; the app targets Node 22 and deploys to Vercel.

---

## 로컬 실행 / Local Development

Node 22가 필요합니다(`.nvmrc` 참고). 아래 순서로 실행합니다.

```bash
git clone https://github.com/areumz/on-stage.git
cd on-stage
nvm use
npm install
npm run dev
```

이후 [http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

Requires Node 22 (see `.nvmrc`). Clone the repo, run `nvm use`, then `npm install` and `npm run dev`, and open [http://localhost:3000](http://localhost:3000).

---

## 데모 계정 / Demo Account

B탭(`/staff/login`)은 로그인이 필요합니다. 아래 데모 계정으로 접속할 수 있습니다.

- **ID**: `admin`
- **Password**: `1234`

1차 범위에서는 하드코딩된 계정으로 인증하며, 2차에서 Supabase Auth로 교체할 계획입니다.

The B tab (`/staff/login`) requires authentication. Use `admin` / `1234` to sign in. This is a hardcoded demo account for phase 1 — planned to be replaced by Supabase Auth in phase 2.

---

## 개발 프로세스 / Development Process

이 프로젝트는 [Superpowers](https://github.com/obra/superpowers) 워크플로우를 따라 AI 에이전트와 협업해 만들었습니다. 다만 각 단계의 결과물을 그대로 받아들이지 않고, 설계와 코드를 실제로 검증하고 판단하는 과정을 거쳤습니다.

진행 순서는 다음과 같습니다.

1. **brainstorming** — 요구사항과 화면 구조를 정리해 설계 문서([docs/design.md](docs/design.md))로 승인
2. **writing-plans** — 승인된 설계를 태스크 단위 구현 계획으로 분해
3. **executing-plans** — 태스크를 순서대로 실행하되, 태스크마다 사람이 확인하는 체크포인트를 둠
4. **TDD** — 인증 로직, API Routes, 데이터 변환 등 로직 레이어는 RED-GREEN-REFACTOR로 구현하고, R3F 씬·셰이더·레이아웃 같은 비주얼 레이어는 형식적인 테스트 대신 브라우저 시각 검증으로 확인
5. **코드 리뷰** — 매 태스크마다 리뷰를 거쳐 실제 문제(예: 지표 조회 함수가 URL 값으로 객체를 그대로 인덱싱해 프로토타입 체인을 타던 버그, 로그인 성공 후 라우터 캐시로 인해 로그인 화면으로 되돌아가던 버그)를 찾아 고침
6. **CI** — PR마다 자동 스캔이 실행되어 최종 안전망 역할

품질 관리는 두 도구를 병행했습니다. **Ponytail**은 과잉 구현을 정리하는 역할로, 예를 들어 91줄짜리 커스텀 파티클 셰이더(파티클 220개)를 drei의 `Sparkles`로 교체해 16줄로 줄인 것처럼 필요 이상 복잡해진 코드를 걷어냈습니다. **react-doctor**는 로컬 작성 단계와 CI 양쪽에 설치해, 접근성·번들 크기·아키텍처 이슈를 자동으로 스캔했습니다.

각 태스크에서 실제로 무엇을 검증하고 무엇을 고쳤는지는 [docs/plan-summary.md](docs/plan-summary.md)에 태스크별로 기록되어 있습니다. 예를 들어 명암비를 눈대중이 아니라 실측해 보니 Tailwind v4의 `oklch` 표기 때문에 계산값이 왜곡되는 함정을 발견해 바로잡은 것처럼, 결과물이 아니라 검증 과정 자체를 남기려 했습니다.

This project was built by pairing with an AI agent through the [Superpowers](https://github.com/obra/superpowers) workflow — brainstorming → writing-plans → executing-plans → TDD → code review → CI. AI-authored output wasn't accepted as-is: each task went through review and hands-on verification (browser checks for the visual/R3F layer, automated tests for the logic layer), which caught real issues along the way, including a metrics-lookup function that indexed an object directly with a URL-supplied key — letting requests walk the prototype chain — and a post-login redirect loop caused by stale router cache. **Ponytail** kept the implementation from growing unnecessarily complex (e.g., replacing a 91-line custom particle shader — 220 particles, hand-rolled coordinates — with drei's 16-line `Sparkles`), and **react-doctor** ran both locally and in CI as an automated safety net for accessibility, bundle size, and architecture issues. The design rationale lives in [docs/design.md](docs/design.md); task-by-task verification notes — what was actually checked and fixed at each step — live in [docs/plan-summary.md](docs/plan-summary.md).

---

## 폴더 구조 / Folder Structure

핵심 디렉토리 구성은 다음과 같습니다.

```
src/
├── proxy.ts              # B탭 인증 가드
├── app/
│   ├── page.tsx          # A탭: 레이블 메인 (궤도)
│   ├── artists/[slug]/   # A탭: 아티스트 투어 페이지
│   ├── staff/
│   │   ├── login/        # B탭: 로그인
│   │   ├── stage/        # B탭: 무대 연출 3D 툴
│   │   └── (console)/    # B탭: 사이드바 공유 라우트 그룹 (대시보드 등)
│   └── api/               # /api/artists, /api/metrics, /api/login
├── components/
│   ├── common/            # 헤더, A/B 탭 토글
│   ├── fans/               # A탭 전용 컴포넌트
│   ├── staff/               # B탭 전용 컴포넌트
│   └── three/                # R3F 씬 (양 탭 공용)
├── data/                     # mock JSON
└── lib/                      # 타입, 데이터 조회, 인증 로직
```

The core layout: `app/` holds routes for both tabs (fans pages, `staff/` for login/dashboard/stage), `components/` splits shared, per-tab, and R3F-specific pieces, `data/` holds the mock JSON, and `lib/` holds types, data access, and auth logic.

---

## 알려진 제한사항 / Known Limitations

1차 범위는 다음을 의도적으로 포함하지 않습니다.

- 완전한 회원가입/비밀번호 재설정 없는 하드코딩 로그인 (`admin` / `1234`)
- 다국어(i18n) 미지원
- 모바일 반응형 미지원 (데스크톱 기준)
- 실제 결제/예매 기능 없음
- 백엔드 서버 분리 없음
- B탭 사이드바 5개 메뉴 중 대시보드만 실 화면, 나머지(투어 일정/아티스트/티켓 현황)는 Coming soon
- 무대 연출 툴은 조명 프리셋·on/off·카메라 앵글 전환만 지원 (스모그, 세밀 조명 조절, 프리셋 저장 없음)

Phase 1 deliberately excludes: a full auth system (login is hardcoded), i18n, mobile responsiveness (desktop-only), real payments/booking, and a separate backend. In the B tab, only the dashboard menu is a real screen — the rest are "coming soon" — and the stage tool covers only lighting presets, on/off toggles, and camera-angle presets.

### 2차 로드맵 / Phase 2 Roadmap

- Supabase Auth + DB로 전환 (하드코딩 로그인 제거)
- 무대 연출 툴 고도화 (스모그·파티클, 세밀 조명 조절, 프리셋 저장)
- 반응형 대응
- B탭 사이드바 잔여 메뉴 실 화면 구현
- 셰이더 심화 (아티스트별 차별화 확대)
- 갤러리 이미지 정교화 (일부 아티스트는 AI 생성 이미지 등으로 교체 검토)

자세한 배경은 [docs/design.md](docs/design.md) 8장을 참고하세요.

Planned for phase 2: switching to Supabase Auth + DB, richer stage-tool controls (smoke/particles, fine lighting adjustment, saved presets), responsive layouts, filling out the remaining staff sidebar screens, deeper per-artist shader variation, and refined gallery imagery. See section 8 of [docs/design.md](docs/design.md) for details.

---

## 라이선스 / License

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.

This project is licensed under the [MIT License](LICENSE).
