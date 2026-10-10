// 오류·한도 상태별 사용자 문구. 출처는 UI 목업 v20 의 Errors 보드.
// 라우트는 항상 { error: <코드> } 로 응답하고, 화면은 errorKeyFor(코드)로 이 표를 찾는다.

export type ErrorKey =
  // Python 작업 error 값 (§5.2)
  | "interrupted"
  | "llm_failed"
  | "llm_quota_exceeded"
  | "audio_unavailable"
  | "decode_failed"
  | "too_long"
  | "internal_error"
  // HTTP·연결
  | "unauthorized" // 401, on-stage 자체 인증
  | "job_not_found" // 404, 분석 결과 7일 만료
  | "thread_expired" // 410, 진행 중이던 작업 만료
  | "connection_failed" // 502
  // on-stage 자체 한도 (계약서 코드 아님)
  | "approved_limit" // 곡당 승인본 5개
  | "daily_limit" // 서비스 전체 하루 연출 만들기
  | "draft_exists" // 곡당 동시 초안 1개
  | "feedback_limit" // 시퀀스당 다시 생성 3회
  | "save_failed"; // 승인 후 저장 실패

// 버튼이 하는 일. 이동 위치는 화면이 정한다.
export type ActionKind =
  | "retry" // 같은 id 로 다시 POST
  | "pickSong"
  | "demo"
  | "login"
  | "reanalyze"
  | "restartRun"
  | "myLibrary"
  | "continueDraft"
  | "discardDraft"
  | "backToReview"
  | "resave"
  | "later";

export type ErrorCopy = {
  tint: "amber" | "rose";
  headline: string;
  sub: string;
  hint: string;
  primary: { action: ActionKind; label: string; cooldownSec?: number };
  secondary: { action: ActionKind; label: string } | null;
};

const retry = { action: "retry", label: "다시 시도" } as const;
const pickSong = { action: "pickSong", label: "곡 다시 고르기" } as const;
const demo = { action: "demo", label: "데모 곡 체험하기" } as const;
const discardDraft = { action: "discardDraft", label: "이 초안 버리고 새로 만들기" } as const;

export const ERROR_COPY: Record<ErrorKey, ErrorCopy> = {
  interrupted: {
    tint: "amber",
    headline: "작업이 중간에 멈췄어요",
    sub: "서버가 다시 시작되면서 진행 중이던 작업이 끊겼어요. 다시 시도하면 이어서 진행해요.",
    hint: "서버를 업데이트하거나 재시작하는 순간에 진행 중이던 작업이 이렇게 끊길 수 있어요.",
    primary: retry,
    secondary: pickSong,
  },
  llm_failed: {
    tint: "rose",
    headline: "AI가 지금 응답하지 못해요",
    sub: "붐비거나 오늘 쓸 수 있는 횟수를 다 썼을 수 있어요. 잠시 뒤에 다시 시도하거나, 미리 분석된 데모 곡을 체험해 보세요.",
    hint: "데모 곡은 AI를 부르지 않아서 언제든 볼 수 있어요.",
    primary: retry,
    secondary: demo,
  },
  // 문구는 llm_failed 와 같은 계열. 연타를 막으려고 쿨다운을 둔다.
  llm_quota_exceeded: {
    tint: "rose",
    headline: "AI가 지금 응답하지 못해요",
    sub: "붐비거나 오늘 쓸 수 있는 횟수를 다 썼을 수 있어요. 조금 뒤에 다시 시도하거나, 미리 분석된 데모 곡을 체험해 보세요.",
    hint: "버튼을 연달아 누르면 더 오래 막힐 수 있어서 잠깐 기다렸다가 눌러 볼 수 있어요.",
    primary: { ...retry, cooldownSec: 45 },
    secondary: demo,
  },
  audio_unavailable: {
    tint: "rose",
    headline: "음원을 가져오지 못했어요",
    sub: "올린 파일을 서버가 내려받지 못했어요. 잠시 뒤에 다시 시도하거나 파일을 다시 올려 주세요.",
    hint: "파일 링크가 만료됐거나 파일이 사라진 경우에 생겨요.",
    primary: retry,
    secondary: pickSong,
  },
  decode_failed: {
    tint: "rose",
    headline: "이 파일은 읽을 수 없어요",
    sub: "소리 파일로 읽을 수 없어요. mp3, wav, flac, ogg 파일인지 확인하고 다른 파일로 시도해 주세요.",
    hint: "확장자만 바꾼 파일이거나 파일이 깨진 경우일 수 있어요.",
    primary: pickSong,
    secondary: demo,
  },
  too_long: {
    tint: "rose",
    headline: "곡이 너무 길어요",
    sub: "5분(300초)보다 긴 곡은 분석할 수 없어요. 더 짧은 곡으로 다시 올려 주세요.",
    hint: "긴 곡은 앞부분 5분만 잘라서 올려도 돼요.",
    primary: pickSong,
    secondary: demo,
  },
  internal_error: {
    tint: "rose",
    headline: "분석에 실패했어요",
    sub: "예상하지 못한 문제가 생겼어요. 다시 시도해도 계속 실패하면 잠시 뒤에 다시 와 주세요.",
    hint: "문제가 계속되면 알려 주세요.",
    primary: retry,
    secondary: pickSong,
  },
  // 화면이 /staff 로그인 뒤에 있어서 목업의 "데모 곡은 로그인 없이도 열 수 있어요"는 사실이 아니다. 뺐다.
  unauthorized: {
    tint: "amber",
    headline: "로그인이 필요해요",
    sub: "로그인이 풀렸어요. 다시 로그인하면 하던 작업을 이어서 볼 수 있어요.",
    hint: "데모 곡도 로그인한 뒤에 열 수 있어요.",
    primary: { action: "login", label: "로그인" },
    secondary: null,
  },
  job_not_found: {
    tint: "amber",
    headline: "분석 결과가 사라져서 다시 분석해요",
    sub: "분석한 지 7일이 지나서 서버에서 결과가 지워졌어요. 곡은 그대로 있으니 다시 분석하면 돼요.",
    hint: "이미 승인해서 저장한 연출은 그대로 남아 있어요.",
    primary: { action: "reanalyze", label: "다시 분석" },
    secondary: pickSong,
  },
  thread_expired: {
    tint: "amber",
    headline: "작업이 만료돼서 처음부터 다시 해야 해요",
    sub: "확인을 오래 기다리는 동안 작업이 지워졌어요. 곡은 그대로니까 연출 만들기를 다시 시작해 주세요.",
    hint: "이미 승인해서 저장한 연출은 영향이 없어요.",
    primary: { action: "restartRun", label: "연출 다시 만들기" },
    secondary: pickSong,
  },
  connection_failed: {
    tint: "rose",
    headline: "서버에 연결하지 못했어요",
    sub: "서버가 응답하지 않아요. 잠시 뒤에 다시 시도하거나, 서버 없이도 열리는 데모 곡을 체험해 보세요.",
    hint: "데모 곡은 서버 없이도 열려요.",
    primary: retry,
    secondary: demo,
  },
  approved_limit: {
    tint: "amber",
    headline: "지금은 더 만들 수 없어요",
    sub: "한 곡에 저장할 수 있는 연출은 5개까지예요. 오래된 연출을 지우고 다시 시도해 주세요.",
    hint: "지운 연출은 되돌릴 수 없어요. 데모 곡은 횟수와 상관없이 볼 수 있어요.",
    primary: { action: "myLibrary", label: "내 연출 보기" },
    secondary: demo,
  },
  daily_limit: {
    tint: "amber",
    headline: "오늘 만들 수 있는 횟수를 모두 썼어요",
    sub: "서비스 전체에서 하루에 만들 수 있는 연출 수가 정해져 있어요. 내일 다시 시도해 주세요. 그동안 데모 곡을 체험해 볼 수 있어요.",
    hint: "저장해 둔 내 연출과 데모 곡은 계속 볼 수 있어요.",
    primary: { action: "demo", label: "데모 곡 체험하기" },
    secondary: { action: "myLibrary", label: "내 연출 보기" },
  },
  draft_exists: {
    tint: "amber",
    headline: "이 곡으로 만들고 있는 연출이 있어요",
    sub: "한 곡에는 만드는 중인 연출을 하나만 둘 수 있어요. 만들던 연출을 이어서 하거나, 버리고 새로 시작해 주세요. 다른 곡은 따로 만들 수 있어요.",
    hint: "버리면 만들던 내용이 사라져요. 이미 승인해서 저장한 연출은 그대로예요.",
    primary: { action: "continueDraft", label: "이어서 하기" },
    secondary: discardDraft,
  },
  feedback_limit: {
    tint: "amber",
    headline: "다시 생성은 여기까지예요",
    sub: "한 연출에서 구간을 다시 생성하는 건 3번까지 할 수 있어요. 지금 연출을 승인하거나, 처음부터 새로 만들어 주세요.",
    hint: "버리고 새로 만들면 다시 생성 횟수가 0/3부터 시작돼요. 승인한 연출 수(곡당 5개)에는 포함되지 않아요.",
    primary: { action: "backToReview", label: "검토로 돌아가기" },
    secondary: discardDraft,
  },
  save_failed: {
    tint: "amber",
    headline: "승인했지만 저장하지 못했어요",
    sub: "연출은 서버에 남아 있어요. 다시 저장해 보세요. 오늘 안에 다시 시도하는 게 좋아요.",
    hint: "승인 후 24시간 안에는 같은 결과를 다시 받아 저장할 수 있어요.",
    primary: { action: "resave", label: "다시 저장" },
    secondary: { action: "later", label: "나중에 하기" },
  },
};

// 초안 버리기 확인창 문구 (기존 ConfirmDialog 에 넘긴다)
export const DISCARD_CONFIRM = {
  title: "이 초안을 버릴까요?",
  body: "지금까지 만든 연출과 다시 생성한 내용이 사라져요. 승인해서 저장한 연출은 그대로예요.",
  confirm: "버리고 새로 만들기",
  cancel: "취소",
} as const;

// 모르는 코드(앞으로 Python 이 추가할 수 있는 값 포함)는 일반 오류 문구로 보여 준다.
export function errorKeyFor(code: string | null | undefined): ErrorKey {
  return code && Object.hasOwn(ERROR_COPY, code) ? (code as ErrorKey) : "internal_error";
}

export function errorCopyFor(code: string | null | undefined): ErrorCopy {
  return ERROR_COPY[errorKeyFor(code)];
}
