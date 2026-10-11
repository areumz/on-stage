"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";

type Labels = { confirmLabel?: string; cancelLabel?: string; title?: string };

function Dialog({
  message,
  title,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: { message: string; onConfirm: () => void; onCancel: () => void } & Labels) {
  const messageId = useId();
  const titleId = useId();

  // 키보드로도 닫을 수 있어야 한다 (Esc = 취소)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-describedby={messageId}
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
        className="w-80 rounded-xl bg-white p-5 text-center shadow-xl"
      >
        {title && (
          <p id={titleId} className="mb-2 text-base font-semibold text-gray-900">
            {title}
          </p>
        )}
        <p id={messageId} className="text-sm text-gray-900">
          {message}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          {/* 파괴적인 동작의 확인창이라 기본 포커스는 취소에 둔다 */}
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// window.confirm()은 브라우저 네이티브 스타일이라 앱 톤과 안 맞고, 자동화 테스트 환경에서도 다루기 까다로움.
// 호출부는 `if (!(await confirm(message))) return;` 형태를 그대로 유지할 수 있도록 Promise로 감쌈.
// window.confirm과 같은 호출 감각을 유지하면서 렌더링만 바꿈. 버튼 문구는 선택 옵션으로 바꿀 수 있다.
export function useConfirm(): { confirm: (message: string, labels?: Labels) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<({ message: string; resolve: (ok: boolean) => void } & Labels) | null>(null);

  const confirm = useCallback((message: string, labels?: Labels) => {
    return new Promise<boolean>((resolve) => setPending({ message, resolve, ...labels }));
  }, []);

  function respond(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return {
    confirm,
    dialog: pending ? (
      <Dialog
        message={pending.message}
        title={pending.title}
        confirmLabel={pending.confirmLabel}
        cancelLabel={pending.cancelLabel}
        onConfirm={() => respond(true)}
        onCancel={() => respond(false)}
      />
    ) : null,
  };
}
