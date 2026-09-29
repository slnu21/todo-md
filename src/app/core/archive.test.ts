import { describe, expect, it } from "vitest";
import { archiveName, archiveSources, archiveYears, byYear, mergeArchive, parseArchive, splitOldDone } from "./archive";
import { emptyData, type Item } from "./model";

const mk = (id: string, p: Partial<Item>): Item => ({
  id, projectId: "p1", title: id, status: "done", importance: 2, assignee: "", due: "",
  createdAt: "2025-12-01T09:00", startedAt: null, doneAt: null, subs: [], memos: [], ...p,
});

function data(items: Item[]) {
  const d = emptyData();
  d.projects.unshift({ id: "p1", name: "Atlas" });
  d.items = items;
  return d;
}

describe("30일 지난 완료 떼어 내기", () => {
  const TODAY = "2026-09-28";
  it("완료 후 30일이 지난 것만 — 29일째·미완료는 남는다", () => {
    const d = data([
      mk("old", { doneAt: "2026-08-28T10:00" }), // 31일 전
      mk("edge", { doneAt: "2026-08-29T10:00" }), // 30일 전 = 경계, 남는다
      mk("open", { status: "todo", doneAt: null }),
    ]);
    const { keep, moved } = splitOldDone(d, TODAY);
    expect(moved.map((i) => i.id)).toEqual(["old"]);
    expect(keep.items.map((i) => i.id)).toEqual(["edge", "open"]);
  });
  it("옮길 게 없으면 같은 객체", () => {
    const d = data([mk("a", { status: "todo" })]);
    expect(splitOldDone(d, TODAY).keep).toBe(d);
  });
  it("완료한 해별로 묶는다", () => {
    const m = byYear([mk("a", { doneAt: "2025-12-30T09:00" }), mk("b", { doneAt: "2026-01-02T09:00" })]);
    expect([...m.keys()]).toEqual([2025, 2026]);
    expect(archiveName(2025)).toBe("archive/2025.json");
  });
});

describe("보관 파일 합치기", () => {
  it("id 가 겹치면 건너뛴다 — 도중에 멈춰 두 번 옮겨도 중복이 안 생긴다", () => {
    const d = data([]);
    const a = mk("a", { doneAt: "2026-01-02T09:00" });
    const first = mergeArchive(parseArchive(null), [a], d);
    const again = mergeArchive(parseArchive(JSON.stringify(first)), [a, mk("b", { doneAt: "2026-01-03T09:00" })], d);
    expect(again.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(again.projects).toEqual({ p1: "Atlas" });
  });
  it("깨진 보관 파일은 빈 것으로 본다", () => {
    expect(parseArchive("{ nope")).toEqual({ version: 1, projects: {}, items: [] });
  });
});

describe("찾기에서 보관 파일 읽기", () => {
  it("읽어 볼 해 = 올해부터 2026 까지(최근 먼저)", () => {
    expect(archiveYears("2026-09-29")).toEqual([2026]);
    expect(archiveYears("2028-01-02")).toEqual([2028, 2027, 2026]);
  });
  it("프로젝트 이름은 옮길 때 적어 둔 것, 모르면 빈 이름. 할 일이 아닌 줄은 거른다", () => {
    const file = parseArchive(JSON.stringify({
      projects: { p1: "옛 이름" },
      items: [{ id: "a", projectId: "p1", title: "A" }, { id: "b", projectId: "gone", title: "B" }, null, { title: "id 없음" }],
    }));
    expect(archiveSources(file).map((s) => [s.item.id, s.project, s.archived])).toEqual([["a", "옛 이름", true], ["b", "", true]]);
  });
});
