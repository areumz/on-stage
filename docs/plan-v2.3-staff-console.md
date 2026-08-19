# ON-STAGE 2차 구현 계획 2.3 — B탭 잔여 메뉴 (Implementation Plan v2.3)

> 2차 고도화는 항목마다 별도 계획 문서를 갖는다. 번호는 [`docs/design-v2.md`](./design-v2.md) 3장의
> 시퀀싱(2.1~2.5)을 따른다. 이 문서는 **2.3 B탭 잔여 메뉴**만 다룬다.

**Goal:** `/staff/tours`·`/staff/artists`·`/staff/tickets` stub 3개를 실 화면으로 바꾼다 — `shows` CRUD,
아티스트 편집 + `tracks` CRUD(기존 갤러리 관리와 한 페이지), 공연별 판매율 조회 전용 테이블. 데모
계정은 세 화면 모두 읽기 전용으로 본다.

**Architecture:** 쓰기 경로는 전부 4.5의 역할 스코프 RLS(`app_metadata.role = 'owner'`)에 의존한다 —
API 라우트는 인가 로직을 직접 짜지 않고 RLS가 막은 0행 삭제/수정을 403으로 번역만 한다
(`gallery/[id]/route.ts`·`stage-presets/[id]/route.ts`의 기존 패턴 그대로). 화면은 전부 서버 컴포넌트가
초기 데이터를 읽고, 편집 UI만 클라이언트 컴포넌트로 쪼갠다(`ArtistSelect`/`?artist=slug` 패턴 유지).
트랙 순서변경만 예외적으로 클라이언트 쪽에 작은 순수 함수(`neighborSwap`)가 필요해 TDD 대상이다.

**Tech Stack:** Next.js 16.2.12 / React 19.2.4 / `@supabase/supabase-js` · `@supabase/ssr` / vitest
(node 환경)

**승인된 설계:** [`docs/design-v2.md`](./design-v2.md) **7장**(7.1~7.7). 이 계획은 그 문서를 구현
단위로 쪼갠 것이며, 타입 정의·API 계약·RLS 스코프 판단의 **단일 진실 공급원은 design-v2.md다.**
4·5장과 동일한 문서 관리 방침을 따른다.

**브랜치:** `feat/staff-console` (`feat/stage-tools` 기준으로 이미 생성됨 — 4·5장 완료 상태 위에서 시작)

---

## Global Constraints

모든 Task에 적용된다. 이 절의 요구사항은 각 Task의 완료조건에 암묵적으로 포함된다.

### 훈련 데이터와 다른 부분 (반드시 준수)

- **Next 16 — 동적 라우트의 `params`는 `Promise`다.** `src/app/api/gallery/[id]/route.ts`처럼
  `{ params }: { params: Promise<{ id: string }> }`로 받는다 (Task 3, 5, 6).
- **Tailwind v4 — `tailwind.config.ts`가 없다.** 디자인 토큰은 `src/app/globals.css`의 `@theme`에 있다.

### 프로젝트 규칙

- **`artists`/`tracks`/`shows` 쓰기는 4.5의 역할 스코프 RLS(`app_metadata.role = 'owner'`)에 전적으로
  의존한다.** 이 계획에서 마이그레이션을 추가하지 않는다 — 정책은 4장에서 이미 존재.
- **Supabase 키는 전부 서버 전용.** 신규 라우트도 `createServerSupabase()` 경유, service role은
  쓰지 않는다 (§4.5 원칙 유지).
- **TDD 대상은 `src/lib/trackOrder.ts`(`neighborSwap`) 하나뿐이다.** 나머지(`data.ts` 쿼리 래퍼,
  API 라우트, UI 컴포넌트)는 이 저장소의 기존 관행대로 자동화 테스트를 만들지 않고 브라우저/curl
  수동 검증으로 확인한다(§9.1, `gallery`·`stage-presets` 라우트에 테스트 파일이 없는 것과 동일).
- **서버 검증은 필드 존재 확인 + 숫자 캐스팅 정도로 얕게 유지한다.** zod 등 검증 라이브러리를
  새로 들이지 않는다(§7.6). `capacity > 0`, `unique` 제약은 DB가 최종 방어선.
- **`/staff/stage`는 `(console)` 라우트 그룹 밖에 그대로 둔다.** §7 브레인스토밍에서 이동안을 검토했다가
  되돌린 결정이며, 이 계획에서 다시 꺼내지 않는다.
- **트랙 순서변경은 `PATCH` 두 번이 아니라 임시값 경유 3단계다.** `unique(artist_id, no)` 제약 때문에
  직접 swap하면 항상 `23505(Postgres 중복값 에러)`가 난다 — design-v2.md §7.3 참고 (Task 7).
- 커밋 컨벤션: Conventional Commits (`feat:` `fix:` `test:` `docs:` `refactor:`), 소문자 명령형.

### 범위 밖 (선제 구현 금지)

design-v2.md §10을 그대로 따른다. 특히 이 계획에서 손이 갈 만한 것:

- `tracks`를 소유 스코프(`created_by`)로 바꾸는 것 — §7.1에서 검토 후 기각(순서변경과 충돌)
- `tracks.no` 숫자 직접 입력 UI — §7.3에서 명시적으로 기각
- 아티스트 생성·삭제 — 시드가 만든 6명 고정, 편집(`PATCH`)만
- `orbit`/`angle`/`size`/`slug`/`name`/`stat_tracks` 편집 — A탭 레이아웃·지표 파생에 관여, §7 원안
  필드 목록에 없음
- 셰이더 파라미터가 A탭 히어로에 실제로 반영되는 것 — 8장 몫. 이 계획은 입력 UI와 저장까지만
- 드래그 앤 드롭 순서변경, 감사 로그, 소프트 삭제, 되돌리기

---

## 파일 구조 (최종 목표)

```
src/
├── lib/
│   ├── data.ts                        # 수정 — getShows/getArtistRow/getTracks/getShowStatusList 추가,
│   │                                   #        getStaffRoleLabel → getStaffRole (Task 2, 3, 5, 6, 8)
│   ├── trackOrder.ts                  # 신규 — neighborSwap 순수 함수 (Task 1)
│   └── trackOrder.test.ts             # 신규 — TDD (Task 1)
├── components/staff/
│   ├── ToursManager.tsx               # 신규 (Task 4)
│   ├── ArtistEditForm.tsx             # 신규 (Task 7)
│   └── TracksManager.tsx              # 신규 (Task 7)
└── app/
    ├── staff/(console)/
    │   ├── layout.tsx                  # 수정 — getStaffRole() 호출로 전환 (Task 2)
    │   ├── tours/page.tsx               # 수정 — stub → 구현 (Task 4)
    │   ├── artists/page.tsx             # 수정 — 편집 폼 + tracks 섹션 추가, 갤러리 섹션 유지 (Task 7)
    │   └── tickets/page.tsx             # 수정 — stub → 구현 (Task 8)
    └── api/
        ├── shows/route.ts               # 신규 — POST (Task 3)
        ├── shows/[id]/route.ts          # 신규 — PATCH/DELETE (Task 3)
        ├── artists/[id]/route.ts        # 신규 — PATCH (Task 5)
        ├── tracks/route.ts              # 신규 — POST (Task 6)
        └── tracks/[id]/route.ts         # 신규 — PATCH/DELETE (Task 6)
```

---

## Task 순서와 의존관계

```
Task 1  neighborSwap 순수 함수 (TDD)          ─┐
Task 2  getStaffRole() 전환                    ─┤
Task 3  /staff/tours 백엔드 (shows)            ─┴─→ Task 4  /staff/tours UI
Task 5  /staff/artists 편집 백엔드 (artists)    ─┐
Task 6  tracks 백엔드                          ─┴─→ Task 7  /staff/artists UI (Task 1도 선행)
Task 8  /staff/tickets (독립, 백엔드+UI 통합)
   ↓ (전체 선행)
Task 9  완료 기준 검증 · 문서 갱신
```

Task 1·2는 서로 독립이며 나머지 전부의 전제조건이다 — Task 1(`neighborSwap`)은 Task 7의 트랙
순서변경 버튼이, Task 2(`getStaffRole`)는 Task 4·7의 편집 게이팅이 그대로 가져다 쓴다. Task 3→4,
5·6→7처럼 백엔드와 프론트를 분리한 이유는 5장 계획과 같다 — 한쪽이 막혀도 다른 쪽 리뷰·머지를
막지 않는다. Task 8(티켓 현황)은 편집 UI가 없어 게이팅도 필요 없으므로 완전히 독립적으로 아무
때나 진행 가능하다. Task 9는 §11 7장 완료 기준을 마지막에 한 번에 모아 확인한다.

---

### Task 1: `neighborSwap` 순수 함수 (TDD)

**Files:**
- Create: `src/lib/trackOrder.ts`
- Create: `src/lib/trackOrder.test.ts`

**Interfaces:**
- Produces: `type SwapDirection = "up" | "down"`
- Produces: `neighborSwap(tracks: TrackRow[], id: string, direction: SwapDirection): [TrackRow, TrackRow] | null`
  — Task 7의 `TracksManager`가 버튼 `disabled` 판정과 클릭 핸들러 양쪽에서 재사용한다.

**왜**: design-v2.md §7.3. 위/아래 버튼의 경계 판정(맨 위 트랙의 "위로", 맨 아래 트랙의 "아래로"
비활성화)과 "클릭한 트랙과 swap할 상대를 찾기"는 같은 로직이라 한 곳에 모은다. `no` 기준으로
정렬한 뒤 인접 쌍을 찾고, 경계이거나 `id`를 못 찾으면 `null`을 반환한다.

**주의**:
1. `tracks` 배열이 이미 `no` 순으로 정렬돼 있다고 가정하지 않는다 — 함수 내부에서 정렬부터 한다.
   호출부(`getTracks`)가 정렬해서 넘기더라도, 이 함수 자체의 정확성이 그 가정에 기대면 안 된다.
2. 반환값은 `[클릭한 트랙, 상대 트랙]` 순서를 유지한다 — Task 7이 "클릭한 트랙의 원래 `no`"와
   "상대 트랙의 원래 `no`"를 순서대로 꺼내 쓴다.
3. 이 함수는 네트워크·상태를 다루지 않는다(순수 함수) — `no` 값을 실제로 바꾸는 3단계 `PATCH`
   시퀀스는 Task 7의 컴포넌트 몫이다.

- [ ] **Step 1: 실패하는 테스트 작성** — 케이스: 가운데 트랙을 위로(이전 트랙과 짝) · 가운데 트랙을
      아래로(다음 트랙과 짝) · 맨 위 트랙을 위로(`null`) · 맨 아래 트랙을 아래로(`null`) · 존재하지
      않는 `id`(`null`) · `no` 순서가 뒤섞여 입력돼도 정렬 후 계산(가운데 트랙 기준 정상 동작).
      각 케이스에 왜 존재하는지 한국어 주석 한 줄
- [ ] **Step 2: 테스트 실패 확인** — Run: `npm test`. Expected: FAIL (`trackOrder.ts`가 아직 없음)
- [ ] **Step 3: `trackOrder.ts` 최소 구현** — 위 Interfaces·주의 그대로
- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test`. Expected: PASS
- [ ] **Step 5: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- Step 1의 6개 케이스가 전부 통과한다
- `npm test` 통과
- `neighborSwap`이 네트워크 호출·`fetch`·React 상태를 참조하지 않는다(순수성)

---

### Task 2: `getStaffRole()` 전환

**Files:**
- Modify: `src/lib/data.ts` (`getStaffRoleLabel` → `getStaffRole`)
- Modify: `src/app/staff/(console)/layout.tsx`

**Interfaces:**
- Consumes: 기존 `createServerSupabase()`
- Produces: `getStaffRole(): Promise<{ isOwner: boolean; label: "관리자" | "게스트" }>` — Task 4·7이
  `isOwner`를 편집 컴포넌트에 내려주는 데 쓴다. `label`은 기존 `getStaffRoleLabel()`과 동일한 값.

**왜**: design-v2.md §7.5. 지금 `getStaffRoleLabel()`은 표시용 문자열만 반환해 Task 4·7이 데모 계정
게이팅에 쓸 boolean이 없다. 기존 판정 로직(`user?.app_metadata?.role === "owner"`)은 그대로 두고
반환 모양만 확장한다.

**주의**:
1. `Sidebar.tsx` 자체는 고치지 않는다 — `roleLabel: string` prop 그대로 받는다. 호출부인
   `layout.tsx`가 `const { label } = await getStaffRole();`로 바꾸고 `<Sidebar roleLabel={label} />`은
   그대로 둔다.
2. `getStaffRoleLabel`이라는 이름을 쓰는 다른 호출부가 없는지 확인한다 —
   `grep -rn "getStaffRoleLabel" src`로 `layout.tsx` 한 곳만 나와야 정상(있으면 그 시점에 이 함수
   전체가 아니라 이름만 바뀌는 리네임이므로 하나만 나온다).

- [ ] **Step 1: `data.ts`에서 `getStaffRoleLabel` → `getStaffRole`로 변경**, 반환 타입을
      `{ isOwner: boolean; label: "관리자" | "게스트" }`로 확장
- [ ] **Step 2: `layout.tsx` 호출부 수정** — `getStaffRole()` 호출 후 `label`만 꺼내 `Sidebar`에 전달
- [ ] **Step 3: `grep -rn "getStaffRoleLabel" src`로 잔여 참조 0건 확인**
- [ ] **Step 4: `npm run build` 통과 확인**
- [ ] **Step 5: 브라우저 검증** — 데모 계정으로 아무 `/staff/*` 화면 로그인 → 사이드바 상단에 "게스트"
      표시 확인. 오너 계정으로도 로그인해 "관리자" 표시 확인
- [ ] **Step 6: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- `npm run build` 통과
- `grep -rn "getStaffRoleLabel" src` 0건
- 데모/오너 두 계정 모두 사이드바 라벨이 정상 표시된다

---

### Task 3: `/staff/tours` 백엔드 — `shows` CRUD API

**Files:**
- Modify: `src/lib/data.ts` (`getShows` 추가)
- Create: `src/app/api/shows/route.ts`
- Create: `src/app/api/shows/[id]/route.ts`

**Interfaces:**
- Consumes: 기존 `getArtistId(supabase, slug)`, `createServerSupabase()`
- Produces:
  - `getShows(slug: string): Promise<ShowRow[]>` — `show_date` 오름차순
  - `POST /api/shows` body `{ artistSlug: string; cityCode: string; cityName: string; country: string; venue: string; showDate: string; capacity: number; featured?: boolean }`
    → `201 { id: string }` / 중복(`unique(artist_id,city_code,show_date)`, `23505`) → `409 { error: "duplicate" }` /
    권한 없음(RLS `WITH CHECK` 거부, `42501`) → `403 { error: "forbidden" }`
  - `PATCH /api/shows/[id]` body는 위 필드 중 바꿀 것만 부분 전송(camelCase 키 그대로) →
    `200 {}` / `403 { error: "forbidden" }` / 중복 시 `409`
  - `DELETE /api/shows/[id]` → `204` / `403 { error: "forbidden" }`

**왜**: design-v2.md §7.2. `shows`는 4.5의 역할 스코프 RLS로 이미 막혀 있어 이 Task는 그 위에 API만
얹는다. 마이그레이션 추가 없음.

**주의**:
1. **동적 라우트 `params`는 `Promise`다** — `gallery/[id]/route.ts`와 동일하게
   `{ params }: { params: Promise<{ id: string }> }`.
2. **`getShows`는 `getGalleryImages`와 동일 패턴이다** — `getArtistId` → `eq(artist_id)` →
   `order(show_date)`. 아티스트를 못 찾으면 빈 배열(gallery와 동일, 404를 던지지 않는다).
3. **POST/PATCH 둘 다 `23505` → 409로 번역한다** — `stage-presets` POST의 중복 처리와 같은 패턴.
4. **PATCH는 body에 있는 키만 업데이트한다** — camelCase 키(`cityCode` 등)를 snake_case 컬럼으로
   매핑하는 whitelist를 두고, `capacity`는 `Number()`로 캐스팅한다. whitelist에 없는 키는 무시한다
   (예상 밖 필드를 그대로 DB 컬럼명으로 오인해 update하는 사고 방지).
5. **DELETE는 `gallery/[id]/route.ts`와 동일한 패턴이다** — 소유자 재확인 코드 없이 RLS가 게이트,
   0행이면 403(그대로 204를 주면 RLS가 막은 시도가 성공한 것처럼 보인다). PATCH도 같은 이유로
   0행이면 403.
6. **POST의 RLS 거부는 DELETE/PATCH의 "0행"과 다른 모양으로 온다.** `gallery`/`stage-presets`는
   소유 스코프라 서버가 `created_by`/`user_id`를 세션값으로 항상 채우므로 `WITH CHECK`가 걸릴 일이
   없었지만, `shows`는 역할 스코프(`app_metadata.role = 'owner'`)라 데모 계정처럼 로그인은 했지만
   오너가 아닌 세션이 insert를 시도하면 Postgres가 **행을 조용히 0개 넣는 게 아니라 에러를 던진다**
   (SQLSTATE `42501`, "new row violates row-level security policy"). 그러니 `insert` 결과의
   `error.code === "42501"`을 `23505`와 나란히 명시적으로 분기해 `403`으로 번역한다 — 이 분기가
   없으면 데모 계정의 정상적인 권한 거부가 `500`(서버 오류)으로 잘못 보고된다.

- [ ] **Step 1: `getShows` 구현** — `data.ts`에 추가
- [ ] **Step 2: `POST /api/shows` 구현** — 세션 확인 → 401, body 필드 존재 확인 → 400, `capacity`
      캐스팅 실패/0 이하 → 400, `getArtistId` → 404, insert, `23505` → 409, **`42501` → 403**
- [ ] **Step 3: `PATCH /api/shows/[id]` 구현** — 세션 확인 → 401, whitelist 매핑, 빈 patch → 400,
      update + 0행 → 403, `23505` → 409
- [ ] **Step 4: `DELETE /api/shows/[id]` 구현** — 세션 확인 → 401, delete + 0행 → 403
- [ ] **Step 5: API 수동 검증** (`next build && next start -p 3001`, 포트 3000은 손대지 않음.
      `.env.local`의 `SEED_OWNER_EMAIL`/`SEED_OWNER_PASSWORD`로 `/api/login` 로그인 후 세션 쿠키로
      curl) — 타임스탬프가 들어간 고유 `cityCode`로 테스트 공연을 만들고 마지막에 직접 지워 실
      데이터를 남기지 않는다:
      1. `POST` 신규 → `201 { id }`
      2. 같은 `artistSlug`+`cityCode`+`showDate`로 재`POST` → `409 { error: "duplicate" }`
      3. `PATCH`로 `capacity`만 변경 → `200 {}`, 이후 `getShows` 재조회로 값 반영 확인
      4. 존재하지 않는 id `PATCH`/`DELETE` → `403`
      5. 방금 만든 id `DELETE` → `204`
      6. 데모 계정 세션으로 같은 `POST`/`PATCH`/`DELETE` 시도 → 전부 `403`. `POST`는 "주의" 6번의
         `42501` 분기가 실제로 타는지 확인(분기가 없으면 `500`으로 잘못 나가므로, 이 케이스가
         `403 { error: "forbidden" }`으로 정확히 나오는지가 이 Step의 핵심 확인 대상이다)
- [ ] **Step 6: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- Step 5의 시나리오 전부가 기대한 상태 코드를 반환한다
- `npm run build` 통과
- `grep -rn "SERVICE_ROLE" src/app/api/shows` 0건
- 테스트에 쓴 공연 데이터가 남아있지 않다(Step 5-5 확인)

---

### Task 4: `/staff/tours` 프론트엔드

**Files:**
- Create: `src/components/staff/ToursManager.tsx`
- Modify: `src/app/staff/(console)/tours/page.tsx` (stub 전체 교체)

**Interfaces:**
- Consumes: Task 3의 `getShows`/`POST /api/shows`/`PATCH·DELETE /api/shows/[id]`, Task 2의
  `getStaffRole`, 기존 `getArtist`/`getArtists`(`data.ts`), 기존 `ArtistSelect`(`basePath="/staff/tours"`)
- Props: `ToursManager({ artistSlug, shows, isOwner }: { artistSlug: string; shows: ShowRow[]; isOwner: boolean })`

**왜**: design-v2.md §7.2. 아티스트별 스코프(다른 세 화면과 동일), 테이블 인라인 행 편집(모달 없음).

**주의**:
1. **테이블 인라인 행 편집** — "편집" 클릭 시 그 행이 input으로 바뀌고 "저장"/"취소". 맨 아래
   "+ 공연 추가" 행. 별도 모달/다이얼로그 컴포넌트를 새로 만들지 않는다.
2. **에러 표시·자동 소거 패턴은 `GalleryManager.tsx`를 그대로 따른다** — `useState<string|null>`
   + `useEffect`로 3초 뒤 `setError(null)`.
3. **삭제 confirm은 `useConfirm()`(`ConfirmDialog.tsx`)을 재사용한다** — `window.confirm` 금지
   (기존 원칙, `GalleryManager`가 이미 이렇게 바꾼 이력 있음).
4. **`isOwner=false`면 편집·삭제·추가 버튼과 입력 필드에 `disabled` + 안내 문구
   (`title="관리자만 편집할 수 있습니다"`)를 건다.** 폼 자체는 숨기지 않고 항상 렌더한다(§7.5).
5. **성공 후에는 `router.refresh()`로 서버 컴포넌트 데이터를 다시 읽는다** — 클라이언트 상태에
   낙관적으로 반영하지 않는다(`GalleryManager`/`PresetPanel`과 동일 패턴, 서버가 최종 진실).
6. **필드 컬럼**: 날짜(`type="date"`) · 도시코드 · 도시명 · 국가 · 베뉴 · 수용인원(`type="number" min={1}`)
   · A탭 노출(`featured`, 체크박스).

- [ ] **Step 1: `ToursManager.tsx` 구현** — 목록 렌더, 편집 모드 토글, 저장(`PATCH`)/추가(`POST`)/삭제(`DELETE`)
      핸들러, `isOwner` 게이팅
- [ ] **Step 2: `tours/page.tsx` 교체** — `getArtists`/`getArtist`/`getShows`/`getStaffRole`을
      `Promise.all`로 병렬 조회, `notFound()` 가드, `ArtistSelect` + `ToursManager` 배치
      (`artists/page.tsx`의 기존 페이지 구조를 그대로 참고)
- [ ] **Step 3: `npm run build` 통과 확인**
- [ ] **Step 4: 브라우저 검증** (포트 3001) — 오너 계정: 공연 추가 → 목록에 반영 → 편집 → 저장 →
      값 반영 → 삭제 → 목록에서 사라짐, 전 과정 콘솔 에러 0건. 데모 계정: 모든 편집 버튼이 비활성
      렌더(클릭해도 요청이 안 나가는지 Network 탭으로 확인)
- [ ] **Step 5: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- 오너 계정으로 추가·수정·삭제 전 과정이 브라우저에서 동작한다
- 데모 계정에서 편집 관련 버튼이 전부 비활성 렌더된다
- `npm run build` 통과, 콘솔 에러 0건

---

### 계획 밖 추가: 사이드바 로그아웃 버튼

로그아웃 API는 존재하나 UI가 없어서 추가. `Sidebar.tsx`에 로그아웃 버튼을 붙였다 —
기존 `/api/logout`(4.4에서 이미 존재)을 호출하고, 로그인 페이지(`staff/login/page.tsx`)의 로그인
성공 처리와 동일한 이유로 `window.location.href`(전체 내비게이션)를 써서 `/staff/login`으로 보낸다
— 인증 상태가 바뀌는 순간이라 클라이언트 라우터 캐시를 통째로 버려야 하기 때문이다(`router.push`를
쓰면 캐시된 이전 페이지로 되돌아올 수 있음, 로그인 페이지 주석과 동일 근거). 확인창은 없음 —
로그아웃은 되돌리기 쉬운 동작(재로그인)이라 삭제류와 다르게 `useConfirm()`을 쓰지 않았다.

curl로 실제 세션 흐름 확인: 로그인 → 사이드바에 로그아웃 버튼 렌더 확인 → `POST /api/logout` `200` →
같은 쿠키로 `/staff/dashboard` 재접근 시 `proxy.ts` 가드가 `307`로 `/staff/login`으로 리다이렉트(세션이
실제로 무효화됐음을 의미). `npm run build` 통과.

---

### 계획 밖 추가: `/staff/tours` 표 UX 다듬기 + 같은 날짜 다른 도시 충돌 방지

Task 4 완료 후 직접 화면 테스트하며 나온 후속 수정 사항들.

- "액션" → "수정", "A탭 노출" → "메인 노출" 헤더 문구 조정 (`ToursManager.tsx`)
- 날짜 정렬: 처음엔 표 위 별도 토글 버튼("최신순"/"오래된순")으로 만들었다가, 다가오는 공연 날짜에
  "최신순" 문구가 어색한 것 같아 "날짜" 헤더 옆 화살표(▲/▼) 클릭 토글로 교체
- **버그 발견**: 테스트 중 aurora 아티스트의 같은 날짜(2026-08-22)에 ICN·LA 두 도시 공연이
  동시에 잡혀 있는 걸 발견. 기술적인 버그는 아니지만 설계 누락 — 시드 스크립트의 해시 기반 날짜 분배 공식이 우연히 같은 날로 반올림한
  기존 데이터(51개 공연 중 1건). 한 아티스트가 같은 날 두 도시에 있는 건 물리적으로 불가능한데
  DB 제약 `unique(artist_id, city_code, show_date)`은 도시만 다르면 막지 못한다.
  - 처음엔 제약을 `unique(artist_id, show_date)`로 좁히는 안(같은 도시 회차도 같이 막힘)과 시드
    스크립트 날짜 공식 수정까지 검토했으나, 범위를 좁혀 확정: **DB 제약은 그대로 두고**
    (같은 도시+같은 날짜는 여전히 DB가 막음), **다른 도시+같은 날짜만 API에서 사전 조회로 체크**하는
    쪽으로 결정. 시드 스크립트는 손대지 않음
  - `POST /api/shows`·`PATCH /api/shows/[id]`에 사전 조회 추가: 같은 `artist_id`+`show_date` 행이
    있고 도시도 같으면 `409 { error: "duplicate" }`("회차 추가는 문의 바랍니다" 안내), 도시가
    다르면 `409 { error: "date_conflict" }`. PATCH는 `show_date`/`city_code`가 실제로 바뀌는
    요청에서만 이 조회를 탄다(capacity만 바꾸는 흔한 경우는 건너뜀)
  - 기존 ICN/LA 충돌 데이터는 그대로 둠 — 확인해보니 ICN은 `featured: false`라 A탭 공개 화면
    (`getFeaturedShows` 기반 대시보드 차트 포함)에는 LA만 노출되고 ICN은 애초에 안 보여서, 실사용자
    노출 없는 내부 데이터 흠결로 판단. 앞으로는 이 체크가 재발을 막는다
  - design-v2.md §7.2 API 표와 이 규칙의 근거를 갱신 반영
- curl로 세 시나리오 확인: 다른 도시 같은 날짜 POST → `409 date_conflict` / 같은 도시 같은 날짜
  POST → `409 duplicate` / 겹치지 않는 날짜 POST → `201`(정리 후 삭제). PATCH도 동일 규칙과
  "무관한 필드만 바꾸면 조회 생략" 둘 다 확인. `npm run build` 통과
- **계획 밖 추가**: `cityCode` 입력 중 "ICNㅇ" 같은 오타가 실제로 발생하는 걸 확인해, 텍스트 입력
  대신 드롭다운(기존 `shows`에 있는 도시 조합에서 선택, 선택 시 `cityCode`/`cityName`/`country`
  자동 채움, 한 국가 내 도시가 여러 개 존재할 시 드롭다운)으로 바꿨다. "직접 입력"(새 도시 추가)
  옵션도 같이 뒀다.

  직접 입력 경로에는 형식 검증을 넣지 않았다 — §7.6의 얕은 검증 원칙과 맞지 않고, 드롭다운이
  기본 경로가 된 이상 오타가 날 여지 자체가 크게 줄어 검증의 시급성이 낮다. 직접 입력에서
  오타가 반복되면 그때 재검토한다.

  실제로는 여러 차례 반복하며 다음 형태로 정착했다 (`getKnownLocations()` 신규 — 전 아티스트
  `shows`에서 `city_code`+`venue` 기준 중복 제거, `cityName`/`country`도 함께 반환):
  - 처음 시도한 `<input list>` + `<datalist>`(네이티브 콤보박스)는 브라우저마다 팝업 모양이
    다르고, 값이 이미 옵션과 정확히 일치하면 재클릭해도 목록이 다시 안 뜨는 문제가 실제
    브라우저 테스트에서 나와 기각
  - 최종적으로 `cityCode`/`cityName`/`country`/`venue` 4개 필드 각각 독립된 `<select>`로
    구현 — 클릭하면 항상 전체 목록이 뜨고, 목록 맨 아래 "직접 입력"을 고르면 **4개 필드
    전부** 값이 비워지며 일반 텍스트 인풋으로 전환된다(하나만 전환하면 나머지 select가
    남아 혼란스러워서 전체 전환으로 결정)
  - 4개 필드 중 **어느 것을 먼저 골라도** 같은 규칙으로 나머지를 채운다: 고른 값으로 후보를
    좁혔을 때 정확히 1개로 좁혀지면 나머지 3개를 자동 채움, 2개 이상 남으면(예: 국가로
    "South Korea"를 고르면 서울·부산 등 여러 도시가 남음) 섣불리 아무거나 채우지 않고 그
    필드만 갱신해 다른 select들의 옵션만 좁힌다 — 이 규칙이 없으면 국가만 보고 틀린 도시를
    자동으로 채우는 사고가 난다(실제로 발견됨: "South Korea" 선택 시 부산으로 잘못 채워짐)
  - 이 과정에서 시드/테스트 데이터의 실제 결함도 두 건 더 발견해 직접 수정: `country` 값이
    일부 행에 영문("South Korea") 대신 한글("대한민국")로 들어가 있어 드롭다운에 같은 나라가
    두 옵션으로 갈라져 보였던 것(테스트 중 수기로 입력된 행 2개), 앞서 고친 "ICNㅇ" 오타 행도
    포함

---

### Task 5: `/staff/artists` 편집 백엔드 — `artists` PATCH API

**Files:**
- Modify: `src/lib/data.ts` (`getArtistRow` 추가)
- Create: `src/app/api/artists/[id]/route.ts`

**Interfaces:**
- Produces:
  - `getArtistRow(slug: string): Promise<ArtistRow | undefined>` — 화면용 `Artist` 타입 변환 없이
    원본 컬럼 그대로(셰이더 파라미터 등을 잃지 않기 위함, §7.3)
  - `PATCH /api/artists/[id]` body(부분 전송, camelCase) `{ color?, news?, tourBadge?, tourTitleKo?, tourYear?, shaderPattern?, shaderFreq?, shaderFalloff?, shaderSpeed? }`
    → `200 {}` / `403 { error: "forbidden" }`

**왜**: design-v2.md §7.3. 아티스트는 시드가 만든 6명 고정이라 생성·삭제가 없고 `PATCH`만 필요하다.
편집 대상 필드는 색상·뉴스·투어 배지/명/연도·셰이더 파라미터 4개뿐이다(`slug`/`name`/`orbit`/`angle`/
`size`/`stat_tracks`는 편집 UI에서 뺀다 — A탭 레이아웃·지표 파생에 관여).

**주의**:
1. Task 3의 `shows` PATCH와 동일한 whitelist 매핑 패턴을 쓴다. `tourYear`/`shaderFreq`/`shaderFalloff`/
   `shaderSpeed`는 숫자 캐스팅.
2. 0행 업데이트(RLS 거부) → 403, `gallery`/`shows` PATCH와 동일 패턴.
3. `shaderPattern`은 `"wave" | "ripple" | "grain"` 중 하나만 허용한다는 DB 제약이 없으므로(컬럼은
   `text`), 서버가 이 세 값 중 하나인지 확인하고 아니면 400을 준다 — §7.6의 "얕은 검증" 원칙과
   충돌하지 않는다(타입 확인이지 범위/형식 검증이 아님).

- [ ] **Step 1: `getArtistRow` 구현** — `data.ts`에 추가, `artists` 테이블에서 `slug`로 단건 조회
- [ ] **Step 2: `PATCH /api/artists/[id]` 구현** — 세션 확인 → 401, whitelist 매핑 + 숫자 캐스팅 +
      `shaderPattern` enum 확인 → 400, update + 0행 → 403
- [ ] **Step 3: API 수동 검증** (curl, 오너 세션) — 오너 계정으로 임의 아티스트의 `news`와
      `shaderFreq`(셰이더 파라미터 대표로 하나) 두 필드를 **먼저 현재 값을 조회해 기록**한 뒤 변경 →
      재조회로 두 값 다 반영 확인 → 다시 원래 값으로 `PATCH`해 복구. `shaderPattern`에
      `"wave"`/`"ripple"`/`"grain"`이 아닌 값(예: `"nope"`) → `400` (enum 검증이 실제로 걸리는지
      확인 — "주의" 3번). 데모 계정 세션으로 정상 요청 하나 → `403`
- [ ] **Step 4: `npm run build` 통과 확인**
- [ ] **Step 5: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- Step 3의 오너/데모 시나리오가 기대한 상태 코드를 반환한다
- 실 아티스트 데이터가 검증 전후로 동일하다(원복 확인)
- `npm run build` 통과

---

### Task 6: `tracks` 백엔드 — CRUD API

**Files:**
- Modify: `src/lib/data.ts` (`getTracks` 추가)
- Create: `src/app/api/tracks/route.ts`
- Create: `src/app/api/tracks/[id]/route.ts`

**Interfaces:**
- Produces:
  - `getTracks(slug: string): Promise<TrackRow[]>` — `no` 오름차순
  - `POST /api/tracks` body `{ artistSlug: string; title: string; duration: string; coverFrom: string; coverTo: string }`
    → `201 { id: string }` — `no`는 서버가 현재 최댓값+1로 계산(클라이언트가 보내지 않는다) /
    권한 없음(RLS `WITH CHECK` 거부, `42501`) → `403 { error: "forbidden" }`
  - `PATCH /api/tracks/[id]` body(부분 전송) `{ no?, title?, duration?, coverFrom?, coverTo? }`
    → `200 {}` / `403` / `no` 충돌 시 `409 { error: "duplicate" }`
  - `DELETE /api/tracks/[id]` → `204` / `403`

**왜**: design-v2.md §7.1(소유 스코프 검토·기각 — 역할 스코프 유지)·§7.3. `no`의 서버 계산은
`gallery` POST가 `sort_order`를 `max+1`로 계산하는 것과 동일 패턴.

**주의**:
1. **`no`를 클라이언트가 보내지 않는다** — 신규 트랙은 항상 맨 뒤에 붙는다. 순서를 바꾸는 유일한
   경로는 `PATCH`로 기존 트랙의 `no`를 바꾸는 것(Task 7의 3단계 swap).
2. **`PATCH`의 `no` 변경이 `unique(artist_id, no)`를 위반하면 `23505` → `409`로 번역한다.** Task 7이
   임시값 경유 3단계로 이 라우트를 호출하므로, 이 라우트 자체는 "받은 값으로 그대로 update"만 하면
   된다 — swap 로직을 서버에 넣지 않는다(클라이언트 책임, design-v2.md §7.3 "구현 에이전트 주의").
3. `max+1` 조회는 `gallery/route.ts`의 `sort_order` 계산과 동일하게 `order(no desc).limit(1)`.
4. DELETE/PATCH 0행 → 403, 기존 패턴 그대로.
5. **`POST`의 RLS 거부도 Task 3(`shows`)과 동일하게 `42501` → 403이다** — `tracks`도 역할 스코프라
   데모 계정의 insert는 조용히 실패하지 않고 에러를 던진다. `23505`와 나란히 명시적으로 분기한다.

- [ ] **Step 1: `getTracks` 구현** — `data.ts`에 추가
- [ ] **Step 2: `POST /api/tracks` 구현** — 세션 확인 → 401, body 필드 존재 확인 → 400,
      `getArtistId` → 404, `no` 최댓값+1 계산, insert, **`42501` → 403**
- [ ] **Step 3: `PATCH /api/tracks/[id]` 구현** — 세션 확인 → 401, whitelist 매핑(`no`는 숫자 캐스팅),
      빈 patch → 400, update + 0행 → 403, `23505` → 409
- [ ] **Step 4: `DELETE /api/tracks/[id]` 구현** — 세션 확인 → 401, delete + 0행 → 403
- [ ] **Step 5: API 수동 검증** (curl, 오너 세션) — 타임스탬프 들어간 고유 제목으로 테스트 트랙
      생성 → `no`가 기존 최댓값+1인지 확인 → `PATCH`로 이미 존재하는 다른 트랙의 `no`로 바꿔보기
      → `409` 확인 → 정상 값으로 `PATCH` → `200` → `DELETE` → `204`(테스트 데이터 정리). 데모 계정
      세션으로 동일 `POST`/`PATCH`/`DELETE` → 전부 `403`("주의" 5번의 `42501` 분기가 `POST`에서
      실제로 타는지 포함해 확인)
- [ ] **Step 6: `npm run build` 통과 확인**
- [ ] **Step 7: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- Step 5의 오너/데모 시나리오가 기대한 상태 코드를 반환한다
- 테스트 트랙이 남아있지 않다
- `npm run build` 통과

---

### Task 7: `/staff/artists` 프론트엔드 — 편집 폼 + 트랙 관리

**Files:**
- Create: `src/components/staff/ArtistEditForm.tsx`
- Create: `src/components/staff/TracksManager.tsx`
- Modify: `src/app/staff/(console)/artists/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `neighborSwap`, Task 2의 `getStaffRole`, Task 5의 `getArtistRow`/
  `PATCH /api/artists/[id]`, Task 6의 `getTracks`/`POST /api/tracks`/`PATCH·DELETE /api/tracks/[id]`,
  기존 `getGalleryImages`/`GalleryManager`(무변경, 그대로 재사용)
- Props:
  - `ArtistEditForm({ artist, isOwner }: { artist: ArtistRow; isOwner: boolean })`
  - `TracksManager({ artistSlug, tracks, isOwner }: { artistSlug: string; tracks: TrackRow[]; isOwner: boolean })`

**왜**: design-v2.md §7.3. 세 섹션(편집 폼 · 트랙 · 갤러리)이 한 페이지에 들어간다. 갤러리 섹션은
4장에서 이미 완성돼 있으므로 손대지 않고 그대로 둔다.

**주의**:
1. **`ArtistEditForm`은 테이블이 아니라 폼 섹션이다** — 편집 대상이 레코드 하나뿐이라 인라인 행
   패턴이 아니라 필드가 쭉 나열된 카드 하나. 필드: 색상(`<input type="color">`, `StageControls.tsx`가
   이미 쓰는 패턴 재사용) · NOW 뉴스 · 투어 배지 · 투어명 · 투어 연도(`type="number"`) ·
   셰이더 패턴(`<select>` wave/ripple/grain) · 셰이더 주파수/감쇠/속도(`type="number"`).
2. **`TracksManager`는 `ToursManager`와 같은 테이블 인라인 행 패턴**(no·title·duration·cover_from·
   cover_to + 위/아래 버튼 + 삭제, 맨 아래 "+ 트랙 추가"). `cover_from`/`cover_to`는
   `<input type="color">` 2개(실 커버아트 없이 2스톱 그라디언트로 대체하는 기존 방식).
3. **순서변경은 3단계다.** `neighborSwap(tracks, id, direction)`으로 대상 쌍을 구하고(`null`이면
   그 방향 버튼을 애초에 `disabled`), 아래 순서로 `PATCH /api/tracks/[id]`를 세 번 순차 호출한다:
   ① 클릭한 트랙 → `no: 32767`(임시값, `smallint` 최댓값) ② 상대 트랙 → 클릭한 트랙의 원래 `no`
   ③ 클릭한 트랙 → 상대 트랙의 원래 `no`. 세 호출 중 하나라도 실패하면 즉시 멈추고 에러를 보여준다
   (design-v2.md §7.3 "구현 에이전트 주의" 참고 — 두 번 호출로 직접 swap하면 `unique(artist_id, no)`
   위반).
4. **에러 표시·삭제 confirm·`router.refresh()` 패턴은 Task 4와 동일**(`GalleryManager.tsx` 기준).
5. **`isOwner=false`면 두 컴포넌트 모두 입력·버튼이 `disabled`**(§7.5). 갤러리 섹션은 이미 소유
   스코프라 데모 계정도 그대로 업로드/삭제 가능 — 건드리지 않는다.
6. `artists/page.tsx`는 `getArtist(slug)` 대신 `getArtistRow(slug)`를 쓴다(화면용 `Artist` 타입은
   셰이더 파라미터를 안 갖고 있음). `getArtists()`(아티스트 목록, `ArtistSelect`용)는 계속 화면용
   `Artist[]`를 쓴다 — 이건 바뀌지 않는다.

- [ ] **Step 1: `ArtistEditForm.tsx` 구현**
- [ ] **Step 2: `TracksManager.tsx` 구현** — 3단계 swap 포함
- [ ] **Step 3: `artists/page.tsx` 교체** — `getArtists`/`getArtistRow`/`getTracks`/`getGalleryImages`/
      `getStaffRole`을 `Promise.all`로 병렬 조회, `notFound()` 가드, `ArtistSelect` +
      `ArtistEditForm` + `TracksManager` + 기존 `GalleryManager`(갤러리 섹션 `key={slug}` 리마운트
      주석 유지) 순서로 배치
- [ ] **Step 4: `npm run build` 통과 확인**
- [ ] **Step 5: 브라우저 검증** (포트 3001) — 오너 계정: 색상 변경 후 저장 → 재조회 시 반영,
      **셰이더 패턴을 다른 값으로 select하고 주파수/감쇠/속도 숫자도 바꿔 저장 → 새로고침 후 폼에
      바뀐 값 그대로 표시**(Task 5의 curl 검증은 API 계층만 확인했으므로, 이 Step에서 실제 폼 UI로
      같은 필드가 왕복되는지 별도로 확인한다 — 8장 전까지 A탭 히어로에는 반영 안 됨, 그건 정상),
      트랙 추가 → 목록 맨 뒤에 표시, 트랙을 위로 두 번 옮겨 순서 확인(새로고침 후에도 유지), 트랙
      삭제, 갤러리 섹션이 기존과 동일하게 동작(회귀 확인). 데모 계정: 편집 폼·트랙 섹션 버튼 전부
      비활성, 갤러리 업로드/삭제는 정상 동작(소유 스코프라 그대로 열려 있어야 함)
- [ ] **Step 6: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- 오너 계정으로 아티스트 편집·트랙 추가/순서변경/삭제 전 과정이 브라우저에서 동작한다
- **셰이더 파라미터 4개(`shaderPattern`/`shaderFreq`/`shaderFalloff`/`shaderSpeed`) 전부 폼에서 바꾸고
  저장한 값이 새로고침 후에도 유지된다** — Task 9의 "셰이더 파라미터 저장 확인" 완료조건이 이 조건에
  기댄다
- 트랙 순서변경이 새로고침 후에도 유지된다(3단계 swap이 실제로 DB에 반영됨을 의미)
- 데모 계정에서 편집 폼·트랙 버튼은 비활성, 갤러리 업로드/삭제는 여전히 동작한다(소유 스코프 회귀 없음)
- `npm run build` 통과, 콘솔 에러 0건

---

### 계획 밖 추가 (Task 7 검증 중 발견)

**아티스트 목록 순서 버그**: `getArtists()`가 쓰는 `orderedArtistQuery`가 `tracks`/`shows`/
`gallery_images` 하위 관계만 정렬하고 `artists` 테이블 자체엔 정렬 기준이 없었다. Postgres는 정렬
없이 스캔 순서를 보장하지 않아서, Task 5의 PATCH API 검증(aurora 행을 여러 번 UPDATE)이 물리적
스캔 순서를 흔들어 `ArtistSelect`에서 AURORA가 맨 뒤로 밀리는 게 눈에 띄었다. `orbit`/`angle`/`size`는
A탭 궤도 배치용이라 목록 순서와 안 맞고 `created_at`은 시드가 배치 insert라 6개 다 같은 값 — 정렬에
쓸 기존 컬럼이 없었다. `src/data/artists.json` 원본 배열 순서(aurora·velvet·nova·halo·lumen·echo)를
진실 공급원으로 삼아 `getArtists()`에서 반환 직전에 자바스크립트로 정렬하는 `byArtistDisplayOrder`를
추가했다(`src/lib/data.ts`) — 마이그레이션 없이 DB 스캔 순서와 무관하게 항상 같은 순서를 보장한다.

**투어 배지 "N cities" 박제 버그**: `tour_badge`에 `"● World Tour 2026 · 24 cities"`처럼 도시수가
문자열로 그대로 저장돼 있었다 — 계산되는 게 아니라 시드 시점 값이 박제된 것. 실제 공연 수가
그 뒤로 바뀌면서(이 세션의 검증 작업 포함) 저장된 "24 cities"와 실제 26개가 어긋난 걸 사용자가
A탭 아티스트 페이지 히어로(`artists/[slug]/page.tsx`)에서 직접 발견했다. `TourSection.tsx`는
이미 배지에서 도시수 부분을 잘라내고 자체적으로 실시간 계산해 붙이고 있어 문제가 없었다 — 히어로
쪽만 저장된 문자열을 그대로 노출하고 있었다.

- 사용자가 처음 요청한 방향은 "투어 배지 편집 필드를 배지 텍스트만으로 자르고, 도시수 표기
  여부를 아티스트별 체크박스(on/off)로 두기"였으나, 이는 `artists`에 새 boolean 컬럼이 필요해
  §7 계획의 "마이그레이션 추가 안 함" 제약과 충돌 — 확인 결과 **마이그레이션 없이 항상 실시간
  표시**하는 쪽으로 범위를 좁혀 확정
- DB의 `tour_badge` 6개 전부에서 `/\s*·\s*\d+\s*cities\s*$/` 패턴을 정리해 배지 텍스트만 남김
  (예: `"● World Tour 2026 · 24 cities"` → `"● World Tour 2026"`)
- 처음엔 히어로 배지에 `{artist.tour.badge} · {artist.stats.cities} cities`로 실시간 도시수를 다시
  붙였으나, 사용자가 같은 아티스트 페이지 안에서 히어로 통계 블록("cities: 26")·`TourSection.tsx`의
  자체 표기("4 Cities", featured 도시 기준)와 숫자가 세 군데로 갈라지는 걸 지적 — **배지에는 도시수를
  아예 안 붙이는 쪽으로 되돌림**(`{artist.tour.badge}`만). 통계 블록이 전체 공연 수를, 투어 섹션이
  궤도에 찍히는 featured 도시 수를 이미 각자 정확히 표시하고 있어 배지에 셋째 숫자를 더할 필요가 없었음
- curl로 aurora·halo 배지가 깨끗한 텍스트만 렌더하는지, `TourSection.tsx`의 자체 도시수 표기는
  무변경 회귀 없는지 확인

---

### Task 8: `/staff/tickets` — 조회 전용

**Files:**
- Modify: `src/lib/data.ts` (`getShowStatusList` 추가)
- Modify: `src/app/staff/(console)/tickets/page.tsx` (stub 전체 교체)

**Interfaces:**
- Produces: `getShowStatusList(slug: string): Promise<ShowStatusRow[]>` — `show_status` 뷰를
  `featured` 필터 없이 전체, `show_date` 오름차순

**왜**: design-v2.md §7.4. 편집 UI가 없으므로 클라이언트 컴포넌트를 만들지 않는다 — 서버 컴포넌트가
바로 `<table>`을 렌더한다. 지표 파생의 원천이라 손으로 고칠 수 없게 하는 게 이 화면의 핵심(§7 도입부).

**주의**:
1. `getShowStatusList`는 `getFeaturedShows`(기존, `data.ts`)에서 `.eq("featured", true)` 조건만
   뺀 버전이다 — 나머지 쿼리 구조(`getArtistId` → `show_status` 뷰 조회 → `show_date asc`)는 동일.
2. `isOwner`/`getStaffRole`을 쓰지 않는다 — 이 화면엔 애초에 편집 버튼이 없어 게이팅 대상이 없다.
3. 컬럼: 날짜·도시·베뉴·정원·판매량·예매율(`rate * 100`을 반올림해 `%`로 표시).

- [ ] **Step 1: `getShowStatusList` 구현** — `data.ts`에 추가
- [ ] **Step 2: `tickets/page.tsx` 교체** — `getArtists`/`getArtist`/`getShowStatusList`를
      `Promise.all`로 병렬 조회, `notFound()` 가드, `ArtistSelect` + 읽기 전용 `<table>` 렌더
- [ ] **Step 3: `npm run build` 통과 확인**
- [ ] **Step 4: 브라우저 검증** — 아티스트를 전환하며 테이블 내용이 바뀌는지, 편집 관련 UI가
      전혀 없는지(버튼도 input도 0개) 확인. 데모/오너 계정 둘 다 같은 화면(차이 없음)
- [ ] **Step 5: 검증** — 아래 완료조건 확인 후 보고하고 멈춘다

**완료조건:**
- 아티스트별로 공연 목록이 정확히 표시된다(`getFeaturedShows`가 이미 검증된 것과 같은 `show_status`
  뷰를 쓰므로 값 자체는 4장에서 이미 검증됨 — 이 Task는 "featured 필터 제거"만 확인하면 됨)
- 편집 UI가 전혀 없다(입력·버튼 0개)
- 데모/오너 계정 간 화면 차이가 없다
- `npm run build` 통과

---

### Task 9: 완료 기준 검증 · 문서 갱신

**Files:**
- Modify: `docs/design-v2.md` (§11 7장 체크박스)
- Modify: `README.md` (2차 로드맵 체크박스, 국영문 병기)

**Interfaces:** 없음 (검증·문서화 전담)

**왜**: §11 7장 완료 기준 7개 항목과 Task 1~8 개별 완료조건을 한 번 더 모아 확인하고, §9.2("각
항목의 계획 요약과 검증 노트를 공개 문서로 남긴다")를 README에 반영한다.

- [x] **Step 1: §11 7장 체크리스트 7개 항목 전체 재확인** — 사이드바 5개 전부 실 화면·stub 없음 /
      `/staff/stage` 브레드크럼 유지 / 데모 계정 세 화면 읽기 전용(버튼 비활성 + API 직접 호출도
      403) / 오너의 tours 변경이 tickets·A탭 featured에 반영 / 셰이더 파라미터 저장(반영은 8장 몫)
      확인 / 트랙 순서변경 유지 / tracks·shows 데모 계정 쓰기 시도 403
- [x] **Step 2: `npm test` · `npm run build` 최종 통과 확인**
- [x] **Step 3: `docs/design-v2.md` §11 7장 체크박스를 `[x]`로 갱신**
- [x] **Step 4: `README.md` 갱신** — "2차 로드맵" 항목(194행 부근)에 `[x]` +
      `docs/plan-v2.3-staff-console.md` 링크 추가(`plan-v2.1-supabase.md`/`plan-v2.2-stage-tools.md`
      항목과 같은 형식), "알려진 제한사항"에 B탭 잔여 메뉴가 stub이라는 문구가 있으면 실제 지원
      범위로 갱신하거나 제거, 영문 대응 문단(Known Limitations·Phase 2 progress)도 함께 갱신
- [x] **Step 5: 검증** — 최종 보고 후 멈춘다

**완료조건:**
- §11 7장 체크박스 7개 전부 확인 완료
- README 국문·영문 모두 갱신되고 서로 내용이 어긋나지 않는다
- `npm test` · `npm run build` 통과

**검증 노트 (Step 1~3)**:
- 7개 항목 중 5개(stub 없음·데모 3화면 읽기전용·셰이더 파라미터 저장·트랙 순서변경 유지·
  tracks/shows 데모 쓰기 차단)는 Task 3~8 각각에서 이미 개별 확인된 내용을 재확인
- 이번에 새로 교차 확인한 2개: `/staff/stage` 브레드크럼(코드 미변경 상태에서 살아있는지 재확인 —
  사이드바 없음·`← 대시보드` 링크 정상), tours→tickets·A탭 featured 반영(`featured: true` 공연을
  신규 생성 → `/staff/tickets`와 A탭 아티스트 페이지 featured 도시 목록 양쪽에 실시간 반영 확인 →
  테스트 데이터 삭제로 정리)
- `npm test` 29개 전부 통과, `npm run build` 통과(라우트 전체 정상 생성)

### 계획 밖 추가: Task 9 Step 3 이후 자체 리뷰(code-review + ponytail) 반영

Step 3 완료 시점에 7장 전체 diff로 자체 코드리뷰와 ponytail 리뷰를 돌려 발견한 항목을 사용자
지시대로 선별 반영. 고친 것과 의도적으로 미룬 것을 구분해 기록한다.

**반영함:**
- `TracksManager`의 순서변경(임시값 3단계 swap) 도중 실패 시 부분 반영 상태로 남는 문제 —
  try/catch/finally + 최선 노력 롤백 추가
- `ToursManager`/`TracksManager` 삭제 버튼에 진행 중 상태 가드 없어 중복 클릭 시 중복 요청 가능
  — `busy` 상태로 비활성화
- `PATCH /api/shows/[id]`·`PATCH /api/tracks/[id]`·`PATCH /api/artists/[id]`에 POST와 동등한
  서버측 검증 누락 — capacity 양수, title/duration 비어있지 않음, 숫자 필드 유한값 + shader
  범위(falloff 0~1, speed 0 이상) 각각 추가
- `byArtistDisplayOrder`의 `indexOf` 뺄셈 정렬이 목록에 없는 slug(-1)를 맨 앞으로 보내는 버그 —
  랭크 함수로 교체해 맨 뒤로 가도록 수정
- `ToursManager`에 저장 성공 메시지 상태가 아예 없던 것(`ArtistEditForm`/`TracksManager` 대비
  누락) — `useAutoDismiss` 공유 훅을 새로 만들어 4개 컴포넌트(`GalleryManager` 포함) 전체에 적용,
  `ToursManager`도 함께 맞춤
- API 라우트 7곳(`artists/[id]` PATCH, `shows/[id]` PATCH/DELETE, `tracks/[id]` PATCH/DELETE,
  `gallery/[id]` DELETE, `stage-presets/[id]` DELETE)에 중복돼 있던 "RLS가 막은 쓰기 = 0행 →
  403" 판정을 `src/lib/routeHelpers.ts`의 `forbiddenIfNoRows`로 통합

**의도적으로 미룸 (노트만 남김, 지금 코드 변경 없음):**
- `errorMessageFor`류 에러 메시지 매핑이 `ToursManager`/`TracksManager`/`ArtistEditForm`에 3중
  중복 — 각 컴포넌트가 다루는 상태 코드 조합이 달라(409 유무 등) 통합 시 분기가 더 늘 수 있어 보류
- `toDraft`/`EMPTY_DRAFT` 초기화 보일러플레이트가 3개 매니저 컴포넌트에 반복 — 필드 shape이
  전부 달라 제네릭화하면 오히려 타입이 흐려질 것으로 판단해 보류
- `artists/[id]/route.ts`의 `FIELD_MAP` 기반 patch 빌드 루프가 `shows`/`tracks` 라우트와
  구조적으로 동일 반복 — 3곳 다 필드 목록과 숫자 캐스팅 대상이 달라 공용화 이득이 적어 보류
- 효율성 항목 4건 — `ToursManager`가 draft의 모든 필드 변경마다 날짜충돌 재확인 API를 호출(날짜/
  도시 변경시만 필요), `getArtistId`가 여러 `getX` 함수에서 매번 재조회됨, `getShows`가 페이지별로
  중복 호출됨, `getKnownLocations`가 매 요청마다 전체 `shows` 테이블을 스캔 — 전부 현재 데이터
  규모(데모용 소량)에서는 체감 차이가 없어 스킵. 트래픽/데이터가 늘면 우선순위 재검토
- ponytail 지적: `ToursManager`의 `FieldPicker`/`SELECT_ALL`/`MANUAL_ALL`이 지금은 구현체가
  하나뿐이라 yagni로 볼 수 있음 — 도시/국가/베뉴 3필드가 실제로 동일한 좁혀가기 로직을 쓰고 있어
  당장 인라인화해도 중복이 재발할 가능성이 높다고 판단해 보류

---

## 계획 검증 노트 (Self-Review)

계획을 쓴 뒤 design-v2.md 7장과 대조하며 확인한 것들.

**스펙 커버리지** — §7.1(tracks 소유 스코프 기각) → Task 6·7이 그 결정(역할 스코프 유지)을 그대로
구현. §7.2(tours) → Task 3·4. §7.3(artists 편집+tracks) → Task 5·6·7. §7.4(tickets) → Task 8.
§7.5(데모 게이팅) → Task 2가 기반을 만들고 Task 4·7이 소비. §7.6(검증 수준) → Global Constraints에
반영, 개별 Task의 "얕은 검증" 주의사항으로 재확인. §7.7(변경 파일) → 파일 구조 트리와 1:1 대응.
§11 7장 완료 기준 7개는 Task 9에서 한 번 더 모아 확인한다.

**설계 문서를 쓰다가 발견해 고친 버그 하나** — 브레인스토밍 중엔 트랙 순서변경을 "`PATCH` 두 번"으로
설계했는데, 이 계획을 쓰면서 `unique(artist_id, no)` 제약과 맞대보니 두 값을 직접 swap하는 두 번의
단일 행 업데이트는 항상 중간에 `23505`(unique violation)가 난다는 걸 발견했다(두 값이 이미 둘 다
점유된 상태라 어떤 순서로 업데이트해도 충돌). `design-v2.md` §7.3을 임시값 경유 3단계로 먼저
고치고 이 계획(Task 7)에 반영했다 — 계획을 시작하기 전에 설계 쪽을 고쳐 두 문서가 어긋나지 않게
했다.

**Task 경계의 판단** — 화면 3개(tours/artists/tickets) 중 tours·artists는 백엔드/프론트를 분리했지만
(Task 3-4, 5-6-7) tickets는 Task 8 하나로 묶었다. tours·artists는 새 API 계약(엔드포인트 여러 개 +
whitelist 매핑 + 3단계 swap 같은 복잡한 로직)이 있어 분리하면 각각 독립적으로 검증 가능하지만,
tickets는 읽기 전용 쿼리 하나 + 정적 테이블 렌더뿐이라 나누면 오히려 Task가 너무 얇아진다(5장
계획의 Task 분리 기준과 동일 — "새 API 계약을 도입하는지"가 분리 여부를 가른다).

**타입 일관성** — `neighborSwap(tracks: TrackRow[], id: string, direction: SwapDirection): [TrackRow, TrackRow] | null`
(Task 1)이 Task 7의 `TracksManager`에서 그대로 재사용된다. `getStaffRole(): Promise<{ isOwner: boolean; label: "관리자" | "게스트" }>`
(Task 2)의 `isOwner`가 Task 4·7의 `ToursManager`/`ArtistEditForm`/`TracksManager` props와 이름·타입이
일치한다. `PATCH` 라우트 세 개(shows/artists/tracks, Task 3·5·6)가 전부 같은 whitelist-매핑 →
0행-403 패턴을 쓰므로 camelCase 요청 키 이름이 각 컴포넌트(Task 4·7)의 fetch body 키와 정확히
일치하는지 표로 재확인했다 — `cityCode`/`cityName`/`country`/`venue`/`showDate`/`capacity`/`featured`
(shows), `color`/`news`/`tourBadge`/`tourTitleKo`/`tourYear`/`shaderPattern`/`shaderFreq`/
`shaderFalloff`/`shaderSpeed`(artists), `title`/`duration`/`coverFrom`/`coverTo`/`no`(tracks) 전부
일치.

**설계 문서에 없던 결정 하나 더** — §7.3은 "아티스트 편집 폼"의 필드만 정하고 `getArtist`(화면용
타입)와 `getArtistRow`(원본 타입) 중 페이지가 어느 걸 쓸지는 명시하지 않았다. `getArtist`는
`toArtist()`가 `shows`/`tracks`/`gallery_images`를 화면용 모양으로 변환하며 셰이더 파라미터 같은
원본 컬럼을 버리므로, 편집 폼에는 쓸 수 없다는 걸 Task 7에서 확인하고 `getArtistRow` 단독 사용으로
정리했다(`ArtistSelect`가 필요로 하는 `Artist[]` 목록은 계속 `getArtists()`를 쓴다 — 이건 바뀌지
않는다).
