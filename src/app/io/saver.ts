/**
 * 저장 모으기 — 변경 후 `delayMs` 동안 조용하면 마지막 내용 한 번만 쓴다.
 * 타이핑·연속 클릭마다 파일을 다시 쓰지 않게. 창을 닫기 전에는 `flush()` 로 즉시 쓴다.
 *
 * 쓰는 중에 또 요청이 오면 끝난 뒤 **마지막 것**만 이어서 쓴다(겹쳐 쓰지 않는다).
 */
export interface Saver {
  schedule(contents: string): void;
  flush(): Promise<void>;
  /** 저장을 멈춘다(읽지 못한 파일을 덮어쓰지 않게). 이미 예약된 것도 버린다. */
  disable(): void;
}

export function createSaver(
  write: (contents: string) => Promise<void>,
  onError: (e: unknown) => void,
  delayMs = 500,
  // 함수로 감싼다 — `timers.set(...)` 처럼 **객체 메서드로 부르면 브라우저가 "Illegal invocation"** 을 던진다
  // (setTimeout 은 this 가 window 여야 한다). Node 는 괜찮아서 단위 테스트로는 안 잡혔다 — e2e 가 잡았다.
  timers: { set: (fn: () => void, ms: number) => unknown; clear: (h: unknown) => void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
): Saver {
  let pending: string | null = null;
  let timer: unknown = null;
  let running: Promise<void> | null = null;
  let disabled = false;

  async function drain(): Promise<void> {
    while (pending !== null && !disabled) {
      const next = pending;
      pending = null;
      try {
        await write(next);
      } catch (e) {
        onError(e);
      }
    }
  }

  function kick(): Promise<void> {
    if (timer) { timers.clear(timer); timer = null; }
    if (!running) running = drain().finally(() => { running = null; });
    return running;
  }

  return {
    schedule(contents) {
      if (disabled) return;
      pending = contents;
      if (timer) timers.clear(timer);
      timer = timers.set(() => { timer = null; void kick(); }, delayMs);
    },
    async flush() {
      if (running) await running;
      if (pending !== null) await kick();
    },
    disable() {
      disabled = true;
      pending = null;
      if (timer) { timers.clear(timer); timer = null; }
    },
  };
}
