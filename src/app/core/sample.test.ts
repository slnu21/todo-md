import { describe, expect, it } from "vitest";
import { sampleData } from "./sample";

const TODAY = "2026-10-06";
const strip = (d: ReturnType<typeof sampleData>) =>
  d.items.map((i) => ({ ...i, title: "", assignee: i.assignee ? "x" : "", subs: i.subs.map((s) => ({ ...s, title: "" })), memos: i.memos.map((m) => ({ ...m, text: "" })) }));

describe("sampleData", () => {
  it("기본은 한국어", () => {
    expect(sampleData(TODAY).items[0].title).toBe(sampleData(TODAY, "ko").items[0].title);
    expect(sampleData(TODAY).projects[2].name).toBe("사내 교육 준비");
  });

  it("영어판은 한글이 없다(영어 UI 스크린샷)", () => {
    const en = JSON.stringify(sampleData(TODAY, "en"));
    expect(en).not.toMatch(/[가-힣]/);
  });

  it("두 언어의 구성(상태·날짜·하위·메모 수·담당 유무)이 같다 — 글만 다르다", () => {
    expect(strip(sampleData(TODAY, "en"))).toEqual(strip(sampleData(TODAY, "ko")));
    expect(sampleData(TODAY, "en").projects.map((p) => [p.id, !!p.archived])).toEqual(sampleData(TODAY, "ko").projects.map((p) => [p.id, !!p.archived]));
  });
});
