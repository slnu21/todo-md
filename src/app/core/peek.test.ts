import { describe, expect, it } from "vitest";
import { emptyData, type Item, type TodoData } from "./model";
import { peekDue, peekSummary } from "./peek";

const TODAY = "2026-11-21";

function mk(id: string, p: Partial<Item> = {}): Item {
  return {
    id, projectId: "p1", title: id, status: "todo", importance: 2, assignee: "", due: "",
    createdAt: "2026-11-01T09:00", startedAt: null, doneAt: null, subs: [], memos: [], ...p,
  };
}

function data(items: Item[]): TodoData {
  const d = emptyData();
  d.projects.unshift({ id: "p1", name: "A사" }, { id: "old", name: "보관", archived: true });
  d.items = items;
  return d;
}

describe("요약 카드(peekSummary)", () => {
  it("순서: 지난 마감(오래된 것 먼저) → 오늘 마감 → 진행 → 중요도 높음", () => {
    const d = data([
      mk("plain"),
      mk("high", { importance: 3 }),
      mk("doing", { status: "doing" }),
      mk("today", { due: TODAY }),
      mk("late1", { due: "2026-11-20" }),
      mk("late5", { due: "2026-11-16" }),
    ]);
    expect(peekSummary(d, TODAY, 10).top.map((i) => i.id)).toEqual(["late5", "late1", "today", "doing", "high", "plain"]);
  });

  it("세는 값: 남은·진행·오늘·지남 — 완료와 보관 프로젝트는 빼고", () => {
    const d = data([
      mk("doing", { status: "doing", due: TODAY }),
      mk("late", { due: "2026-11-01" }),
      mk("done", { status: "done", due: "2026-11-01" }),
      mk("archived", { projectId: "old", status: "doing", due: TODAY }),
      mk("future", { due: "2026-12-01" }),
    ]);
    const s = peekSummary(d, TODAY);
    expect(s).toMatchObject({ open: 3, doing: 1, dueToday: 1, late: 1 });
  });

  it("최대 개수만 올리고 나머지는 개수로", () => {
    const d = data(Array.from({ length: 7 }, (_, i) => mk(`t${i}`)));
    const s = peekSummary(d, TODAY, 4);
    expect(s.top).toHaveLength(4);
    expect(s.more).toBe(3);
  });

  it("할 일이 없으면 빈 카드", () => {
    expect(peekSummary(data([]), TODAY)).toEqual({ open: 0, doing: 0, dueToday: 0, late: 0, top: [], more: 0 });
  });
});

describe("보여 줄 때(peekDue)", () => {
  const MIN = 60_000;
  it("간격이 지나야 보여 준다", () => {
    expect(peekDue(59 * MIN, 0, 60, 3)).toBe(false);
    expect(peekDue(60 * MIN, 0, 60, 3)).toBe(true);
  });
  it("끔(0)이면 언제나 안 보여 준다", () => {
    expect(peekDue(1e12, 0, 0, 3)).toBe(false);
  });
  it("남은 할 일이 없으면 안 보여 준다", () => {
    expect(peekDue(1e12, 0, 30, 0)).toBe(false);
  });
});
