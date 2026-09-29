import { describe, expect, it } from "vitest";
import type { Item } from "./model";
import { highlight, search, tokens, type Source } from "./search";

function mk(id: string, p: Partial<Item> = {}): Item {
  return {
    id, projectId: "p1", title: id, status: "todo", importance: 2, assignee: "", due: "",
    createdAt: "2026-09-01T09:00", startedAt: null, doneAt: null, subs: [], memos: [], ...p,
  };
}
const src = (item: Item, project = "Atlas", archived = false): Source => ({ item, project, archived });
const ids = (r: { hits: { item: Item }[] }) => r.hits.map((h) => h.item.id);

describe("tokens", () => {
  it("소문자·공백 나눔·중복 제거", () => {
    expect(tokens("  Store  store 인증 ")).toEqual(["store", "인증"]);
    expect(tokens("   ")).toEqual([]);
  });
});

describe("search", () => {
  const data = [
    src(mk("a", { title: "Store 재제출", status: "doing" })),
    src(mk("b", { title: "스크린샷", memos: [{ id: "m1", at: "2026-09-02T10:00", text: "다크 테마도 찍기" }, { id: "m2", at: "2026-09-03T10:00", text: "테마 확정" }] })),
    src(mk("c", { title: "배포", assignee: "김 책임", subs: [{ id: "s", title: "MSIX 서명", done: false }] }), "Cairn"),
    src(mk("d", { title: "옛 일", status: "done", doneAt: "2026-06-01T10:00" }), "옛 프로젝트", true),
    src(mk("e", { title: "최근 완료", status: "done", doneAt: "2026-09-20T10:00" })),
  ];
  it("제목·담당·하위·프로젝트 이름에서 찾는다(대소문자 무시)", () => {
    expect(ids(search(data, "store"))).toEqual(["a"]);
    expect(ids(search(data, "책임"))).toEqual(["c"]);
    expect(ids(search(data, "msix"))).toEqual(["c"]);
    expect(ids(search(data, "cairn"))).toEqual(["c"]);
  });
  it("메모에서 맞으면 맞은 메모 중 가장 최근 것을 함께", () => {
    const r = search(data, "테마");
    expect(ids(r)).toEqual(["b"]);
    expect(r.hits[0].memo?.id).toBe("m2");
    expect(search(data, "다크").hits[0].memo?.id).toBe("m1");
    expect(search(data, "스크린샷").hits[0].memo).toBeNull(); // 제목에서만 맞음
  });
  it("낱말이 여럿이면 모두 있어야(필드가 달라도 된다)", () => {
    expect(ids(search(data, "배포 서명"))).toEqual(["c"]);
    expect(ids(search(data, "배포 테마"))).toEqual([]);
  });
  it("정렬: 진행 → 할 일 → 완료 → 보관 파일, 같은 무리는 최근 순", () => {
    const q = [
      src(mk("arch", { title: "보고서", status: "done", doneAt: "2026-09-25T10:00" }), "옛", true),
      src(mk("done", { title: "보고서", status: "done", doneAt: "2026-09-20T10:00" })),
      src(mk("todoOld", { title: "보고서", createdAt: "2026-09-01T09:00" })),
      src(mk("todoNew", { title: "보고서", createdAt: "2026-09-10T09:00" })),
      src(mk("todoMemo", { title: "보고서", memos: [{ id: "m", at: "2026-09-15T09:00", text: "진척" }] })),
      src(mk("doing", { title: "보고서", status: "doing" })),
    ];
    expect(ids(search(q, "보고서"))).toEqual(["doing", "todoMemo", "todoNew", "todoOld", "done", "arch"]);
  });
  it("빈 검색어 = 완료한 일 기록(최근 완료 순, 보관 파일은 뒤)", () => {
    expect(ids(search(data, ""))).toEqual(["e", "d"]);
  });
  it("limit 과 total", () => {
    const many = Array.from({ length: 5 }, (_, i) => src(mk("x" + i, { title: "같은 제목" })));
    const r = search(many, "같은", 3);
    expect(r.hits).toHaveLength(3);
    expect(r.total).toBe(5);
  });
  it("보관 파일의 빠진 필드에도 안 넘어진다", () => {
    const broken = { id: "z", title: "깨진 것", status: "done", doneAt: "2026-01-01T00:00" } as unknown as Item;
    expect(ids(search([src(broken, "옛", true)], "깨진"))).toEqual(["z"]);
    expect(ids(search([src(broken, "옛", true)], ""))).toEqual(["z"]);
  });
});

describe("highlight", () => {
  it("맞은 조각을 표시(대소문자 무시, 여러 낱말, 겹침)", () => {
    expect(highlight("Store 재제출 store", ["store"])).toEqual([
      { text: "Store", hit: true }, { text: " 재제출 ", hit: false }, { text: "store", hit: true },
    ]);
    expect(highlight("abcd", ["bc", "cd"])).toEqual([{ text: "a", hit: false }, { text: "bcd", hit: true }]);
    expect(highlight("abc", [])).toEqual([{ text: "abc", hit: false }]);
    expect(highlight("", ["a"])).toEqual([]);
  });
});
