import { describe, expect, it } from "vitest";
import { DATA_VERSION, emptyData, INBOX_ID } from "./model";
import { parseData, serializeData } from "./schema";

describe("todo.json 읽기", () => {
  it("쓴 것을 그대로 읽는다", () => {
    const d = emptyData();
    d.projects.unshift({ id: "p1", name: "Atlas", archived: true, archivedAt: "2026-09-26T18:00" });
    d.items.push({
      id: "a", projectId: "p1", title: "재제출", status: "done", importance: 3, assignee: "나", due: "2026-09-28",
      createdAt: "2026-09-25T09:10", startedAt: "2026-09-26T10:00", doneAt: "2026-09-28T11:00",
      subs: [{ id: "s", title: "MSIX", done: true }], memos: [{ id: "m", at: "2026-09-28T09:12", text: "인증" }],
    });
    const r = parseData(serializeData(d));
    expect(r).toEqual({ ok: true, data: d, warnings: [] });
  });

  it("JSON 이 아니면 열지 않는다 — 열고 저장하면 원본이 사라진다", () => {
    expect(parseData("{ items: [")).toMatchObject({ ok: false, reason: "notJson" });
    expect(parseData("[]")).toMatchObject({ ok: false, reason: "notObject" });
  });

  it("더 새 버전 파일은 열지 않는다 — 모르는 필드를 지운 채 저장하게 된다", () => {
    expect(parseData(JSON.stringify({ version: DATA_VERSION + 1, projects: [], items: [] }))).toMatchObject({
      ok: false, reason: "newerVersion",
    });
  });

  it("미분류가 없으면 만든다", () => {
    const r = parseData(JSON.stringify({ version: 1, projects: [{ id: "p1", name: "A" }], items: [] }));
    expect(r.ok && r.data.projects.map((p) => p.id)).toEqual(["p1", INBOX_ID]);
  });

  it("틀린 항목은 건너뛰거나 고치고 경고를 남긴다(fail-soft)", () => {
    const r = parseData(JSON.stringify({
      version: 1,
      projects: [{ id: "p1", name: "A" }, { name: "id 없음" }, { id: "p1", name: "중복" }],
      items: [
        { id: "a", projectId: "p1", title: "정상", status: "weird", importance: 9, due: "2026-02-30", createdAt: "x" },
        { id: "b", projectId: "ghost", title: "주인 없음" },
        { id: "c", title: "   " },
        { id: "d", projectId: "p1", title: "완료 아닌데 doneAt", status: "todo", doneAt: "2026-09-28T09:00" },
      ],
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items.map((i) => [i.id, i.projectId, i.status, i.importance, i.due, i.doneAt])).toEqual([
      ["a", "p1", "todo", 2, "", null],
      ["b", INBOX_ID, "todo", 2, "", null],
      ["d", "p1", "todo", 2, "", null],
    ]);
    expect(r.warnings.length).toBe(4); // 프로젝트 2 + 할 일 1 + 미분류 이동 1
  });
});
