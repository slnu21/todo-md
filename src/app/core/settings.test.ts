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
