import { describe, expect, it } from "vitest";
import { DICT, longDay, mdLabel, monthTitle, resolveLang, t } from "./i18n";
import { parseSettings } from "./settings";

describe("사전", () => {
  it("두 언어의 키 집합이 같고 빈 문자열이 없다", () => {
    expect(Object.keys(DICT.en).sort()).toEqual(Object.keys(DICT.ko).sort());
    for (const lang of ["ko", "en"] as const) for (const [k, v] of Object.entries(DICT[lang])) expect(v, `${lang}.${k}`).toMatch(/\S/);
  });
  it("같은 자리표시를 쓴다 — 한쪽만 {n} 이 빠지면 숫자가 사라진다", () => {
    const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(DICT.ko) as (keyof typeof DICT.ko)[]) {
      if (k === "cal.month") continue; // ko 는 {m}, en 은 월 이름 {M} — 의도적
      expect(slots(DICT.en[k]), k).toBe(slots(DICT.ko[k]));
    }
  });
  it("값을 채운다", () => {
    expect(t("ko", "due.late", { n: 2 })).toBe("2일 지남");
    expect(t("en", "list.addTo", { p: "Atlas" })).toBe("+ Add to Atlas");
  });
});

describe("언어 결정", () => {
  it("시스템이면 표시 언어가 한국어일 때만 한국어", () => {
    expect(resolveLang("system", "ko-KR")).toBe("ko");
    expect(resolveLang("system", "en-US")).toBe("en");
    expect(resolveLang("system", "ja-JP")).toBe("en");
    expect(resolveLang("system", undefined)).toBe("en");
    expect(resolveLang("ko", "en-US")).toBe("ko");
  });
});

describe("날짜 표기", () => {
  it("달 제목·짧은 날짜·긴 날짜", () => {
    expect(monthTitle("ko", 2026, 9)).toBe("2026년 9월");
    expect(monthTitle("en", 2026, 9)).toBe("Sep 2026");
    expect(mdLabel("en", "2026-10-04")).toBe("Oct 4");
    expect(longDay("ko", "2026-09-28", "2026-09-28")).toBe("9월 28일 월요일 (오늘)");
    expect(longDay("en", "2026-09-27", "2026-09-28")).toBe("Sunday, Sep 27");
  });
});

describe("설정 파일", () => {
  it("틀린 값은 기본값으로, 폭은 300~440 으로 자른다", () => {
    const s = parseSettings(JSON.stringify({ theme: "neon", lang: "en", dock: { mode: "float", edge: "top", width: 9999 } }));
    expect(s).toMatchObject({ theme: "system", lang: "en", dock: { mode: "float", edge: "right", width: 440 } });
    expect(parseSettings("not json").theme).toBe("system");
    expect(parseSettings(null).dock.width).toBe(360);
  });
});
