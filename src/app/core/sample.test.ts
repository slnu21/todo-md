import { describe, expect, it } from "vitest";
import { reduce, type Ctx } from "./actions";
import { emptyData, INBOX_ID, type TodoData } from "./model";
import { hasSample, sampleData, withSample } from "./sample";

const TODAY = "2026-10-06";
let n = 0;
const ctx: Ctx = { now: "2026-10-06T09:00", newId: () => `m${(n++).toString(36)}x` };
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

describe("예시로 둘러보기 — withSample / withoutSample", () => {
  const S = sampleData(TODAY);
  /** 사용자가 만든 프로젝트 하나만 있고 할 일은 없는 상태. */
  const mine = (): TodoData => {
    const d = emptyData();
    d.projects.unshift({ id: "u1", name: "내 프로젝트" });
    d.report = { preset: "md" } as unknown as TodoData["report"];
    return d;
  };

  it("모든 id 에 ex- 가 붙고, 사용자 프로젝트·미분류·보고 프로필은 그대로", () => {
    const d = withSample(mine(), S);
    expect(hasSample(d)).toBe(true);
    expect(d.projects.map((p) => p.id)).toEqual(["u1", "ex-p1", "ex-p2", "ex-p3", "ex-p4", INBOX_ID]);
    expect(d.items).toHaveLength(S.items.length);
    for (const i of d.items) {
      expect(i.id).toMatch(/^ex-/);
      expect(i.projectId === INBOX_ID || i.projectId.startsWith("ex-")).toBe(true);
      [...i.subs, ...i.memos].forEach((x) => expect(x.id).toMatch(/^ex-/));
    }
    expect(d.items.filter((i) => i.projectId === INBOX_ID)).toHaveLength(S.items.filter((i) => i.projectId === INBOX_ID).length);
    expect(d.report).toEqual(mine().report);
  });

  it("할 일이 하나라도 있거나 이미 예시가 있으면 넣지 않는다(같은 객체)", () => {
    const d = reduce(mine(), { type: "addItem", projectId: "u1", title: "내 일" }, ctx);
    expect(withSample(d, S)).toBe(d);
    const once = withSample(mine(), S);
    const emptied = { ...once, items: [] };
    expect(withSample(emptied, S)).toBe(emptied);
  });

  it("지우면 예시 프로젝트·그 안에 사용자가 넣은 할 일·미분류의 예시 할 일이 빠지고, 사용자 것은 남는다", () => {
    let d = withSample(mine(), S);
    d = reduce(d, { type: "addItem", projectId: "ex-p1", title: "예시 안에 넣은 것" }, ctx);
    d = reduce(d, { type: "addItem", projectId: "u1", title: "내 일" }, ctx);
    d = reduce(d, { type: "addItem", projectId: INBOX_ID, title: "미분류 내 일" }, ctx);
    const c = reduce(d, { type: "clearSample" }, ctx);
    expect(hasSample(c)).toBe(false);
    expect(c.projects.map((p) => p.id)).toEqual(["u1", INBOX_ID]);
    expect(c.items.map((i) => i.title)).toEqual(["내 일", "미분류 내 일"]);
  });

  it("예시가 없으면 지우기는 아무 일도 하지 않는다(같은 객체)", () => {
    const d = mine();
    expect(reduce(d, { type: "clearSample" }, ctx)).toBe(d);
  });

  it("reduce addSample 은 withSample 과 같다", () => {
    expect(reduce(mine(), { type: "addSample", sample: S }, ctx)).toEqual(withSample(mine(), S));
  });
});
