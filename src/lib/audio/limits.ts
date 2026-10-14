// 업로드 한도. 버킷(audio-tracks)·DB check 와 같은 값이다. 화면 표기는 "30MB", 검사는 MiB 기준.
export const MAX_BYTES = 30 * 1024 * 1024;
// 브라우저가 읽은 길이는 VBR mp3 에서 부정확하다. 301초를 넘을 때만 사전에 막고 최종 판단은 서버(too_long)에 맡긴다.
export const MAX_DURATION_BLOCK_SEC = 301;
export const MAX_TITLE_LENGTH = 100;

// file.type 은 flac·wav 에서 브라우저마다 달라서 믿지 않고 확장자로 정한다.
export const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
};
export const ACCEPT = Object.keys(CONTENT_TYPES).map((e) => `.${e}`).join(",");
