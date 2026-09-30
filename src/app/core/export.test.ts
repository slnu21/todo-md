import { describe, expect, it } from "vitest";
import { parseArchive } from "./archive";
import { buildExport, EXPORT_FORMAT, EXPORT_VERSION, exportFileName, serializeExport } from "./export";
import { emptyData, INBOX_ID, type Item, type TodoData } from "./model";

function mk(id: string, p: Partial<Item> = {}): Item {
  return {
    id, projectId: "p1", title: id, status: "todo", importance: 2, assignee: "", due: "",
    createdAt: "2026-09-01T09:00", startedAt: null, doneAt: null, subs: [], memos: [], ...p,
  };
}
function data(): TodoData {
  const d = emptyData();
  d.projects.unshift({ id: "p1", name: "Atlas" }, { id: "p2", name: "옛 일", archived: true, archivedAt: "2026-09-10T18:00" });
  d.items.push(
    mk("b", { createdAt: "2026-09-05T09:00", status: "doing", startedAt: "2026-09-06T10:00", importance: 3, due: "2026-10-01",
      subs: [{ id: "s1", title: "하위", done: true }], memos: [{ id: "m1", at: "2026-09-06T10:05", text: "메모" }] }),
    mk("a", { createdAt: "2026-09-02T09:00" }),
    mk("z", { projectId: "p2", status: "done", doneAt: "2026-09-09T12:00" }),
    mk("i", { projectId: INBOX_ID }),
  );
  return d;
}
const opts = { now: "2026-09-30T22:10", inboxName: "미분류", appVersion: "0.4.0" };

describe("buildExport", () => {
  it("머리말: 형식·버전·시각·앱 버전", () => {
    const f = buildExport(data(), [], opts);
    expect([f.format, f.version, f.exportedAt, f.app]).toEqual([EXPORT_FORMAT, EXPORT_VERSION, "2026-09-30T22:10", { name: "TODO.md", version: "0.4.0" }]);
  });
  it("프로젝트: 미분류 이름을 채우고 보관 여부를 싣는다", () => {
    expect(buildExport(data(), [], opts).projects).toEqual([
      { id: "p1", name: "Atlas", inbox: false, archived: false, archivedAt: null },
      { id: "p2", name: "옛 일", inbox: false, archived: true, archivedAt: "2026-09-10T18:00" },
      { id: INBOX_ID, name: "미분류", inbox: true, archived: false, archivedAt: null },
    ]);
  });
  it("할 일: 프로젝트 이름을 풀어 넣고, 내부 id(하위·메모)는 뺀다", () => {
    const b = buildExport(data(), [], opts).items.find((i) => i.id === "b")!;
    expect(b).toEqual({
      id: "b", projectId: "p1", project: "Atlas", title: "b", status: "doing", importance: 3, due: "2026-10-01", assignee: "",
      createdAt: "2026-09-05T09:00", startedAt: "2026-09-06T10:00", doneAt: null,
      subs: [{ title: "하위", done: true }], memos: [{ at: "2026-09-06T10:05", text: "메모" }], fromArchive: false,
    });
  });
  it("순서: 프로젝트 순서(보관 프로젝트는 뒤) → 만든 시각, 보관 파일 것은 맨 뒤(완료 순)", () => {
    const arch = parseArchive(JSON.stringify({
      projects: { p1: "Atlas(옛 이름)" },
      items: [mk("y", { status: "done", doneAt: "2026-08-20T10:00" }), mk("x", { status: "done", doneAt: "2026-07-01T10:00" })],
    }));
    expect(buildExport(data(), [arch], opts).items.map((i) => i.id)).toEqual(["a", "b", "i", "z", "x", "y"]);
  });
  it("보관 파일: 옮길 때의 프로젝트 이름, fromArchive, 양쪽에 있으면 todo.json 것만, 파일끼리 겹쳐도 한 번", () => {
    const a1 = parseArchive(JSON.stringify({ projects: { p1: "Atlas(옛 이름)" }, items: [mk("a", { title: "보관 쪽" }), mk("x", { status: "done", doneAt: "2026-07-01T10:00" })] }));
    const a2 = parseArchive(JSON.stringify({ projects: {}, items: [mk("x", { status: "done" })] }));
    const items = buildExport(data(), [a1, a2], opts).items;
    expect(items.filter((i) => i.id === "a")).toMatchObject([{ title: "a", fromArchive: false }]);
    expect(items.filter((i) => i.id === "x")).toMatchObject([{ project: "Atlas(옛 이름)", fromArchive: true }]);
  });
  it("옛·깨진 보관 항목도 넘어지지 않고 기본값으로", () => {
    const arch = parseArchive(JSON.stringify({ projects: {}, items: [{ id: "old", projectId: "p1", title: "옛", status: "weird", importance: 9 }, null, { title: "id 없음" }] }));
    const old = buildExport(data(), [arch], opts).items.find((i) => i.id === "old")!;
    expect(old).toMatchObject({ project: "Atlas", status: "todo", importance: 2, due: "", subs: [], memos: [], doneAt: null, fromArchive: true });
    expect(buildExport(data(), [arch], opts).items.filter((i) => i.fromArchive)).toHaveLength(1);
  });
  it("직렬화는 다시 읽으면 같다 · 파일 이름", () => {
    const f = buildExport(data(), [], opts);
    expect(JSON.parse(serializeExport(f))).toEqual(f);
    expect(exportFileName("2026-09-30")).toBe("TODO.md-export-2026-09-30.json");
  });
});
