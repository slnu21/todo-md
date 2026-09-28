import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaver } from "./saver";

describe("저장 모으기", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("0.5초 안의 연속 변경은 마지막 것 한 번만 쓴다", async () => {
    const writes: string[] = [];
    const s = createSaver(async (c) => { writes.push(c); }, () => {});
    s.schedule("a");
    s.schedule("b");
    await vi.advanceTimersByTimeAsync(499);
    expect(writes).toEqual([]);
    s.schedule("c");
    await vi.advanceTimersByTimeAsync(500);
    expect(writes).toEqual(["c"]);
  });

  it("flush 는 기다리지 않고 바로 쓴다", async () => {
    const writes: string[] = [];
    const s = createSaver(async (c) => { writes.push(c); }, () => {});
    s.schedule("x");
    await s.flush();
    expect(writes).toEqual(["x"]);
  });

  it("쓰는 중에 온 요청은 끝난 뒤 마지막 것만 이어서 쓴다", async () => {
    const writes: string[] = [];
    let release!: () => void;
    const slow = new Promise<void>((r) => { release = r; });
    let first = true;
    const s = createSaver(async (c) => {
      if (first) { first = false; await slow; }
      writes.push(c);
    }, () => {});
    s.schedule("1");
    await vi.advanceTimersByTimeAsync(500); // "1" 쓰기 시작(멈춤)
    s.schedule("2");
    s.schedule("3");
    await vi.advanceTimersByTimeAsync(500);
    release();
    await s.flush();
    expect(writes).toEqual(["1", "3"]);
  });

  it("실패는 onError 로 알리고 다음 저장은 계속한다", async () => {
    const errors: unknown[] = [];
    const writes: string[] = [];
    let fail = true;
    const s = createSaver(async (c) => {
      if (fail) { fail = false; throw new Error("disk full"); }
      writes.push(c);
    }, (e) => errors.push(e));
    s.schedule("a");
    await s.flush();
    s.schedule("b");
    await s.flush();
    expect(errors).toHaveLength(1);
    expect(writes).toEqual(["b"]);
  });

  it("disable 뒤에는 아무것도 쓰지 않는다 — 읽지 못한 파일을 덮어쓰지 않게", async () => {
    const writes: string[] = [];
    const s = createSaver(async (c) => { writes.push(c); }, () => {});
    s.schedule("a");
    s.disable();
    s.schedule("b");
    await vi.advanceTimersByTimeAsync(1000);
    await s.flush();
    expect(writes).toEqual([]);
  });
});
