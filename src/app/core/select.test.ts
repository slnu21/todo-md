import { describe, expect, it } from "vitest";
import { monthGrid } from "./date";
import { emptyData, INBOX_ID, type Item, type TodoData } from "./model";
import {
  activeProjects, archivedRows, calendarMarks, compareItems, dueInfo, dueOnCount, listGroups, memoDays, weekRowIndex,
} from "./select";

const TODAY = "2026-09-28";

function mk(id: string, p: Partial<Item> = {}): Item {
  return {
    id, projectId: "p1", title: id, status: "todo", importance: 2, assignee: "", due: "",
    createdAt: "2026-09-20T09:00", startedAt: null, doneAt: null, subs: [], memos: [], ...p,
  };
}

function data(items: Item[]): TodoData {
  const d = emptyData();
  d.projects.unshift({ id: "p1", name: "Atlas" }, { id: "p2", name: "Cairn" }, { id: "old", name: "홈페이지", archived: true });
  d.items = items;
  return d;
}

describe("정렬", () => {
  it("진행 → 중요도 높음 → 마감 빠른 순 → 마감 없음", () => {
    const list = [
      mk("todo-nodue"),
      mk("todo-due-late", { due: "2026-10-05" }),
      mk("todo-due-soon", { due: "2026-09-29" }),
      mk("high", { importance: 3, due: "2026-12-01" }),
      mk("doing", { status: "doing", importance: 1 }),
      mk("done", { status: "done", importance: 3 }),
    ].sort(compareItems);
    expect(list.map((i) => i.id)).toEqual(["doing", "high", "todo-due-soon", "todo-due-late", "todo-nodue", "done"]);
  });
});

describe("목록 묶음", () => {
  it("활성 프로젝트만, 미분류는 맨 끝, 빈 프로젝트도 보인다", () => {
    const d = data([mk("a")]);
    expect(activeProjects(d).map((p) => p.id)).toEqual(["p1", "p2", INBOX_ID]);
    expect(listGroups(d, TODAY).map((g) => [g.project.id, g.open.length])).toEqual([["p1", 1], ["p2", 0], [INBOX_ID, 0]]);
  });
  it("완료는 따로, 지남 수는 미완료만 센다", () => {
    const g = listGroups(data([mk("a", { due: "2026-09-26" }), mk("b", { status: "done", due: "2026-09-20" })]), TODAY)[0];
    expect(g.open.map((i) => i.id)).toEqual(["a"]);
    expect(g.done.map((i) => i.id)).toEqual(["b"]);
    expect(g.late).toBe(1);
  });
  it("날짜를 고르면 그날 마감만, 빈 묶음은 뺀다", () => {
    const d = data([mk("a", { due: "2026-10-01" }), mk("b", { projectId: "p2", due: "2026-10-02" })]);
    expect(listGroups(d, TODAY, "2026-10-01").map((g) => g.project.id)).toEqual(["p1"]);
    expect(dueOnCount(d, "2026-10-01")).toBe(1);
  });
  it("보관한 프로젝트의 할 일은 날짜 필터 수에도 안 잡힌다", () => {
    const d = data([mk("x", { projectId: "old", due: "2026-10-01" })]);
    expect(dueOnCount(d, "2026-10-01")).toBe(0);
  });
});

describe("마감 칩", () => {
  it("지남·오늘·내일·날짜, 완료나 마감 없음은 표시하지 않는다", () => {
    expect(dueInfo(mk("a", { due: "2026-09-26" }), TODAY)).toEqual({ kind: "late", days: 2 });
    expect(dueInfo(mk("a", { due: TODAY }), TODAY)).toEqual({ kind: "today" });
    expect(dueInfo(mk("a", { due: "2026-09-29" }), TODAY)).toEqual({ kind: "tomorrow" });
    expect(dueInfo(mk("a", { due: "2026-10-04" }), TODAY)).toEqual({ kind: "date", date: "2026-10-04" });
    expect(dueInfo(mk("a", { due: "2026-09-26", status: "done" }), TODAY)).toBeNull();
    expect(dueInfo(mk("a"), TODAY)).toBeNull();
  });
});

describe("달력 점", () => {
  it("지남은 빨강, 중요 높음은 파랑, 완료·보관은 점을 안 찍는다", () => {
    const m = calendarMarks(data([
      mk("late", { due: "2026-09-26" }),
      mk("hi", { due: "2026-10-01", importance: 3 }),
      mk("plain", { due: "2026-10-02" }),
      mk("done", { due: "2026-10-03", status: "done" }),
      mk("arch", { due: "2026-10-04", projectId: "old" }),
    ]), TODAY);
    expect(m.get("2026-09-26")).toEqual({ late: true, high: false });
    expect(m.get("2026-10-01")).toEqual({ late: false, high: true });
    expect(m.get("2026-10-02")).toEqual({ late: false, high: false });
    expect(m.has("2026-10-03")).toBe(false);
    expect(m.has("2026-10-04")).toBe(false);
  });
  it("주 보기 — 초점 날짜의 줄, 없으면 첫 줄", () => {
    const g = monthGrid(2026, 9);
    expect(weekRowIndex(g, "2026-09-28")).toBe(4);
    expect(weekRowIndex(g, "2027-01-01")).toBe(0);
  });
});

describe("메모 날짜 묶음 · 보관 요약", () => {
  it("같은 날 메모는 한 묶음", () => {
    const it0 = mk("a", { memos: [
      { id: "1", at: "2026-09-26T10:05", text: "x" },
      { id: "2", at: "2026-09-26T16:40", text: "y" },
      { id: "3", at: "2026-09-28T09:12", text: "z" },
    ] });
    expect(memoDays(it0).map((d) => [d.date, d.memos.length])).toEqual([["2026-09-26", 2], ["2026-09-28", 1]]);
  });
  it("보관한 프로젝트마다 완료·남은 수", () => {
    const rows = archivedRows(data([mk("a", { projectId: "old", status: "done" }), mk("b", { projectId: "old" })]));
    expect(rows.map((r) => [r.project.id, r.done, r.open])).toEqual([["old", 1, 1]]);
  });
});
