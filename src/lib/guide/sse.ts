export type SseMessage = { event: string; data: string };

// fetch 스트림 조각을 받아 완성된 SSE 메시지만 돌려준다. 빈 줄이 메시지의 끝이다.
export function createSseParser(): (chunk: string) => SseMessage[] {
  let buf = "";
  return (chunk) => {
    buf += chunk;
    const out: SseMessage[] = [];
    // 조각 경계에서 \r과 \n이 갈릴 수 있으므로 끝의 \r은 남겨둔다
    const norm = buf.replace(/\r\n/g, "\n");
    const tail = norm.endsWith("\r") ? "\r" : "";
    const text = tail ? norm.slice(0, -1) : norm;
    const blocks = text.split("\n\n");
    buf = (blocks.pop() ?? "") + tail;
    for (const block of blocks) {
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) out.push({ event, data: data.join("\n") });
    }
    return out;
  };
}
