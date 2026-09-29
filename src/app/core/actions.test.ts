import { describe, expect, it } from "vitest";
import { reduce, withStatus, type Action, type Ctx } from "./actions";
import { emptyData, INBOX_ID, type Item, type TodoData } from "./model";

function ctxAt(now: string): Ctx {
  let n = 0;
  return { now, newId: () => `id${++n}` };
}

/** 프로젝트 하나(p1)와 할 일 두 개(a: 진행 중, b: 할 일)가 든 상태. */
function seeded(): TodoData {
  const d = emptyData();
  d.projects.unshift({ id: "p1", name: "Atlas" });
  const base = { projectId: "p1", importance: 2 as const, assignee: "", due: "" as const, createdAt: "2026-09-20T09:00", subs: [], memos: [] };
  d.items.push(
    { ...base, id: "a", title: "재제출", status: "doing", startedAt: "2026-09-21T10:00", doneAt: null },
    { ...base, id: "b", title: "스크린샷", status: "todo", startedAt: null, doneAt: null },
  );
  return d;
}

const run = (d: TodoData, a: Action, now = "2026-09-28T09:00") => reduce(d, a, ctxAt(now));
const item = (d: TodoData, id: string): Item => d.items.find((i) => i.id === id)!;

describe("상태와 시각 스탬프", () => {
  it("진행으로 처음 바꿀 때 착수 시각이 찍힌다", () => {
    const d = run(seeded(), { type: "setStatus", id: "b", status: "doing" });
    expect(item(d, "b")).toMatchObject({ status: "doing", startedAt: "2026-09-28T09:00", doneAt: null });
  });
  it("완료하면 완료 시각, 착수가 없었으면 착수도 같은 시각", () => {
    const d = run(seeded(), { type: "setStatus", id: "b", status: "done" });
    expect(item(d, "b")).toMatchObject({ status: "done", startedAt: "2026-09-28T09:00", doneAt: "2026-09-28T09:00" });
  });
  it("완료에서 벗어나면 완료 시각을 지우고 착수 시각은 남긴다", () => {
    let d = run(seeded(), { type: "setStatus", id: "a", status: "done" });
    d = run(d, { type: "setStatus", id: "a", status: "todo" }, "2026-09-29T10:00");
    expect(item(d, "a")).toMatchObject({ status: "todo", startedAt: "2026-09-21T10:00", doneAt: null });
  });
  it("클릭 순환: 할 일 → 진행 → 완료 → 할 일", () => {
    let d = seeded();
    const seq: string[] = [];
    for (let i = 0; i < 3; i++) {
      d = run(d, { type: "cycleStatus", id: "b" });
      seq.push(item(d, "b").status);
    }
    expect(seq).toEqual(["doing", "done", "todo"]);
  });
  it("같은 상태로 바꾸면 스탬프가 바뀌지 않는다", () => {
    const it0 = item(seeded(), "a");
    expect(withStatus(it0, "doing", "2030-01-01T00:00")).toBe(it0);
  });
  it("중요도 순환: 보통 → 높음 → 낮음 → 보통", () => {
    let d = seeded();
    const seq: number[] = [];
    for (let i = 0; i < 3; i++) {
      d = run(d, { type: "cycleImportance", id: "b" });
      seq.push(item(d, "b").importance);
    }
    expect(seq).toEqual([3, 1, 2]);
  });
});

describe("할 일 추가·수정", () => {
  it("공백은 접고, 빈 제목은 무시한다", () => {
    const d0 = seeded();
    expect(run(d0, { type: "addItem", projectId: "p1", title: "   " })).toBe(d0);
    const d = run(d0, { type: "addItem", projectId: "p1", title: "  회의실   예약 ", importance: 1, due: "2026-10-01", assignee: " 총무팀 " });
    expect(d.items.at(-1)).toMatchObject({
      id: "id1", title: "회의실 예약", importance: 1, due: "2026-10-01", assignee: "총무팀", status: "todo", createdAt: "2026-09-28T09:00",
    });
  });
  it("보관한 프로젝트나 없는 프로젝트에는 추가하지 않는다", () => {
    let d = run(seeded(), { type: "archiveProject", id: "p1", doneAll: false });
    expect(run(d, { type: "addItem", projectId: "p1", title: "x" })).toBe(d);
    d = seeded();
    expect(run(d, { type: "addItem", projectId: "nope", title: "x" })).toBe(d);
  });
  it("수정 — 빈 제목으로는 바꾸지 않는다", () => {
    const d0 = seeded();
    expect(run(d0, { type: "updateItem", id: "a", patch: { title: " " } })).toBe(d0);
    const d = run(d0, { type: "updateItem", id: "a", patch: { due: "2026-10-02", assignee: "김 책임" } });
    expect(item(d, "a")).toMatchObject({ title: "재제출", due: "2026-10-02", assignee: "김 책임" });
  });
  it("없는 할 일에 대한 요청은 상태를 그대로 돌려준다", () => {
    const d0 = seeded();
    expect(run(d0, { type: "cycleStatus", id: "zzz" })).toBe(d0);
    expect(run(d0, { type: "deleteItem", id: "zzz" })).toBe(d0);
  });
});

describe("하위 항목과 메모", () => {
  it("하위 항목은 체크만 한다", () => {
    let d = run(seeded(), { type: "addSub", itemId: "a", title: "MSIX 다시 만들기" });
    expect(item(d, "a").subs).toEqual([{ id: "id1", title: "MSIX 다시 만들기", done: false }]);
    d = run(d, { type: "toggleSub", itemId: "a", subId: "id1", done: true });
    expect(item(d, "a").subs[0].done).toBe(true);
    d = run(d, { type: "deleteSub", itemId: "a", subId: "id1" });
    expect(item(d, "a").subs).toEqual([]);
  });
  it("메모는 적은 시각이 붙고, 뒤에 쌓인다(오래된 것이 앞)", () => {
    let d = run(seeded(), { type: "addMemo", itemId: "a", text: "매니페스트 머지" }, "2026-09-26T10:05");
    d = run(d, { type: "addMemo", itemId: "a", text: "서명\n경고" }, "2026-09-27T16:40");
    expect(item(d, "a").memos.map((m) => [m.at, m.text])).toEqual([
      ["2026-09-26T10:05", "매니페스트 머지"],
      ["2026-09-27T16:40", "서명 경고"],
    ]);
  });
  it("메모 고치기 — 글만 바뀌고 적은 시각·순서는 그대로", () => {
    const d0 = seeded();
    const memos = [{ id: "m1", at: "2026-09-26T10:05", text: "첫 줄" }, { id: "m2", at: "2026-09-27T16:40", text: "둘째 줄" }];
    const d = { ...d0, items: d0.items.map((i) => (i.id === "a" ? { ...i, memos } : i)) };
    const e = run(d, { type: "editMemo", itemId: "a", memoId: "m1", text: "  고친\n 첫 줄 " }, "2026-09-29T09:00");
    expect(item(e, "a").memos.map((m) => [m.at, m.text])).toEqual([
      ["2026-09-26T10:05", "고친 첫 줄"],
      ["2026-09-27T16:40", "둘째 줄"],
    ]);
  });
  it("메모 고치기 — 빈 글·같은 글·없는 메모는 그대로(같은 객체)", () => {
    const d = run(seeded(), { type: "addMemo", itemId: "a", text: "기록" });
    const id = item(d, "a").memos[0].id;
    expect(run(d, { type: "editMemo", itemId: "a", memoId: id, text: "   " })).toBe(d);
    expect(run(d, { type: "editMemo", itemId: "a", memoId: id, text: " 기록 " })).toBe(d);
    expect(run(d, { type: "editMemo", itemId: "a", memoId: "nope", text: "x" })).toBe(d);
    expect(run(d, { type: "editMemo", itemId: "nope", memoId: id, text: "x" })).toBe(d);
  });
  it("빈 메모는 남기지 않는다", () => {
    const d0 = seeded();
    expect(run(d0, { type: "addMemo", itemId: "a", text: "  " })).toBe(d0);
  });
});

describe("프로젝트", () => {
  it("새 프로젝트는 미분류 바로 앞에 들어간다", () => {
    const d = run(seeded(), { type: "addProject", name: "교육 준비" });
    expect(d.projects.map((p) => p.id)).toEqual(["p1", "id1", INBOX_ID]);
  });
  it("미분류는 보관·이름 변경이 안 된다", () => {
    const d0 = seeded();
    expect(run(d0, { type: "archiveProject", id: INBOX_ID, doneAll: false })).toBe(d0);
    expect(run(d0, { type: "renameProject", id: INBOX_ID, name: "기타" })).toBe(d0);
  });
  it("이름 바꾸기 — 공백을 정리하고, 빈 이름·같은 이름·없는 프로젝트는 그대로", () => {
    const d0 = seeded();
    const d = run(d0, { type: "renameProject", id: "p1", name: "  새   이름 " });
    expect(d.projects.find((p) => p.id === "p1")?.name).toBe("새 이름");
    expect(run(d0, { type: "renameProject", id: "p1", name: "   " })).toBe(d0);
    expect(run(d0, { type: "renameProject", id: "p1", name: d0.projects[0].name })).toBe(d0);
    expect(run(d0, { type: "renameProject", id: "nope", name: "x" })).toBe(d0);
  });
  it("그대로 보관 — 할 일은 손대지 않는다", () => {
    const d = run(seeded(), { type: "archiveProject", id: "p1", doneAll: false });
    expect(d.projects[0]).toMatchObject({ archived: true, archivedAt: "2026-09-28T09:00" });
    expect(d.items.map((i) => i.status)).toEqual(["doing", "todo"]);
  });
  it("모두 완료하고 보관 — 남은 할 일이 완료 시각과 함께 완료된다", () => {
    const d = run(seeded(), { type: "archiveProject", id: "p1", doneAll: true });
    expect(d.items.map((i) => [i.status, i.doneAt])).toEqual([
      ["done", "2026-09-28T09:00"],
      ["done", "2026-09-28T09:00"],
    ]);
  });
  it("되돌리면 보관 표시가 사라진다", () => {
    let d = run(seeded(), { type: "archiveProject", id: "p1", doneAll: false });
    d = run(d, { type: "restoreProject", id: "p1" });
    expect(d.projects[0]).toEqual({ id: "p1", name: "Atlas" });
  });
});
