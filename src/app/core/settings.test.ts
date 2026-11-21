import { describe, expect, it } from "vitest";
import { defaultSettings, parseSettings, serializeSettings } from "./settings";

describe("× 버튼 설정(closeAction)", () => {
  it("기본값은 '매번 묻기' — 첫 × 때 묻는다", () => {
    expect(defaultSettings().closeAction).toBe("ask");
    expect(parseSettings(null).closeAction).toBe("ask");
  });
  it("옛 설정 파일(필드 없음)은 '묻기'로 — 업데이트한 사용자도 한 번은 고른다", () => {
    expect(parseSettings(JSON.stringify({ theme: "dark" })).closeAction).toBe("ask");
  });
  it("고른 값은 저장했다 읽어도 그대로", () => {
    for (const a of ["hide", "quit", "ask"] as const) {
      expect(parseSettings(serializeSettings({ ...defaultSettings(), closeAction: a })).closeAction).toBe(a);
    }
  });
  it("모르는 값은 '묻기'로 되돌린다(설정은 잃어도 되는 것)", () => {
    expect(parseSettings(JSON.stringify({ closeAction: "exit" })).closeAction).toBe("ask");
    expect(parseSettings(JSON.stringify({ closeAction: 1 })).closeAction).toBe("ask");
  });
  it("다른 설정은 건드리지 않는다", () => {
    const s = parseSettings(JSON.stringify({ closeAction: "quit", lang: "en", dock: { edge: "left" } }));
    expect(s.lang).toBe("en");
    expect(s.dock.edge).toBe("left");
  });
});

describe("숨김 모드 설정(peek)", () => {
  it("기본값: 위 · 1시간마다 · 6초", () => {
    expect(defaultSettings().peek).toEqual({ vpos: "top", every: 60, showSec: 6 });
  });
  it("옛 설정 파일(peek 없음)도 기본값으로 읽는다", () => {
    const s = parseSettings(JSON.stringify({ dock: { mode: "float" } }));
    expect(s.dock.mode).toBe("float");
    expect(s.peek).toEqual(defaultSettings().peek);
  });
  it("모드 '숨김'과 고른 값은 저장했다 읽어도 그대로", () => {
    const d = defaultSettings();
    const s = { ...d, dock: { ...d.dock, mode: "peek" as const }, peek: { vpos: "bottom" as const, every: 0 as const, showSec: 12 as const } };
    const back = parseSettings(serializeSettings(s));
    expect(back.dock.mode).toBe("peek");
    expect(back.peek).toEqual({ vpos: "bottom", every: 0, showSec: 12 });
  });
  it("모르는 값은 기본값으로(간격은 정해진 것만 — 1분 같은 값은 거절)", () => {
    const s = parseSettings(JSON.stringify({ peek: { vpos: "side", every: 1, showSec: "6" } }));
    expect(s.peek).toEqual(defaultSettings().peek);
  });
});
