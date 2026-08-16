"use client";

import { useCallback, useState, type ReactNode } from "react";

function Dialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="w-80 rounded-xl bg-white p-5 text-center shadow-xl">
        <p className="text-sm text-gray-900">{message}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-500 px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// window.confirm()은 브라우저 네이티브 스타일이라 앱 톤과 안 맞고, 자동화 테스트 환경에서도 다루기 까다로움.
// 호출부는 `if (!(await confirm(message))) return;` 형태를 그대로 유지할 수 있도록 Promise로 감쌈.
// window.confirm과 같은 호출 감각을 유지하면서 렌더링만 바꿈.
export function useConfirm(): { confirm: (message: string) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<{ message: string; resolve: (ok: boolean) => void } | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => setPending({ message, resolve }));
  }, []);

  function respond(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return {
    confirm,
    dialog: pending ? <Dialog message={pending.message} onConfirm={() => respond(true)} onCancel={() => respond(false)} /> : null,
  };
}
