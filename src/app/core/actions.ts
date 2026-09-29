/**
 * 모든 변경은 여기 `reduce` 하나를 거친다. 순수 함수 — 시각(`now`)과 새 id(`newId`)를 밖에서 받는다.
 *
 * 규칙이 화면마다 갈라지지 않게 하는 자리다(Cairn 의 "문서를 바꾸는 함수는 core 에만"). 창이 여러 개여도
 * (위젯·상세·보고) 같은 action 을 위젯 창의 reduce 로 보낸다.
 *
 * 잘못된 요청(없는 id, 빈 제목, 미분류 보관)은 **같은 상태를 그대로 돌려준다** — 던지지 않는다.
 * 화면이 이미 막는 것들이고, 막지 못한 경우에도 앱이 멈추는 것보다 아무 일 없는 편이 낫다.
 */
import type { LocalStamp, PlainDate } from "./date";
import { INBOX_ID, type Importance, type Item, type Status, type TodoData } from "./model";
import type { ReportRules } from "./report";

export interface Ctx {
  now: LocalStamp;
  newId: () => string;
}

export type ItemPatch = Partial<Pick<Item, "title" | "importance" | "due" | "assignee">>;

export type Action =
  | { type: "addProject"; name: string }
  | { type: "renameProject"; id: string; name: string }
  /** 순서 바꾸기: `id` 를 `before` 바로 앞으로. `before` = null 이거나 미분류면 활성 목록의 끝(미분류 바로 앞). */
  | { type: "moveProject"; id: string; before: string | null }
  | { type: "archiveProject"; id: string; doneAll: boolean }
  | { type: "restoreProject"; id: string }
  | { type: "addItem"; projectId: string; title: string; importance?: Importance; due?: PlainDate | ""; assignee?: string }
  | { type: "updateItem"; id: string; patch: ItemPatch }
  | { type: "setStatus"; id: string; status: Status }
  | { type: "cycleStatus"; id: string }
  | { type: "cycleImportance"; id: string }
  | { type: "deleteItem"; id: string }
  | { type: "addSub"; itemId: string; title: string }
  | { type: "toggleSub"; itemId: string; subId: string; done: boolean }
  | { type: "deleteSub"; itemId: string; subId: string }
  | { type: "addMemo"; itemId: string; text: string }
  /** 글만 고친다 — 적은 시각(`at`)은 기록이라 그대로. */
  | { type: "editMemo"; itemId: string; memoId: string; text: string }
  | { type: "deleteMemo"; itemId: string; memoId: string }
  | { type: "setReport"; rules: ReportRules | null };

export const NEXT_STATUS: Record<Status, Status> = { todo: "doing", doing: "done", done: "todo" };

/** 상태를 바꾸며 착수·완료 시각을 찍는다. 같은 상태면 그대로. */
export function withStatus(item: Item, status: Status, now: LocalStamp): Item {
  if (item.status === status) return item;
  let { startedAt, doneAt } = item;
  if (status === "doing" && !startedAt) startedAt = now;
  if (status === "done") {
    doneAt = now;
    if (!startedAt) startedAt = now;
  } else {
    doneAt = null;
  }
  return { ...item, status, startedAt, doneAt };
}

function mapItem(data: TodoData, id: string, fn: (it: Item) => Item): TodoData {
  let hit = false;
  const items = data.items.map((it) => {
    if (it.id !== id) return it;
    hit = true;
    return fn(it);
  });
  return hit ? { ...data, items } : data;
}

/** 공백을 한 칸으로 접고 앞뒤를 자른다. 제목·메모는 한 줄이다(Enter 가 곧 '한 줄 남기기'). */
export const clean = (s: string): string => s.replace(/\s+/g, " ").trim();

export function reduce(data: TodoData, action: Action, ctx: Ctx): TodoData {
  switch (action.type) {
    case "addProject": {
      const name = clean(action.name);
      if (!name) return data;
      // 새 프로젝트는 '미분류' 바로 앞 — 미분류는 늘 활성 목록의 맨 끝.
      const at = data.projects.findIndex((p) => p.id === INBOX_ID);
      const projects = [...data.projects];
      projects.splice(at < 0 ? projects.length : at, 0, { id: ctx.newId(), name });
      return { ...data, projects };
    }
    case "renameProject": {
      const name = clean(action.name);
      const cur = data.projects.find((p) => p.id === action.id);
      // 빈 이름·미분류·없는 프로젝트·같은 이름이면 그대로(같은 객체 — 저장이 일어나지 않는다).
      if (!name || !cur || action.id === INBOX_ID || cur.name === name) return data;
      return { ...data, projects: data.projects.map((p) => (p.id === action.id ? { ...p, name } : p)) };
    }
    case "moveProject": {
      // 미분류는 움직이지 않는다(늘 활성 목록 맨 끝). 보관한 프로젝트는 배열에 남은 자리 그대로 — 보이는 순서만 바뀐다.
      const from = data.projects.findIndex((p) => p.id === action.id);
      if (from < 0 || action.id === INBOX_ID || action.before === action.id) return data;
      const rest = data.projects.filter((p) => p.id !== action.id);
      const target = action.before && action.before !== INBOX_ID ? action.before : INBOX_ID;
      let at = rest.findIndex((p) => p.id === target);
      if (at < 0) {
        if (action.before && action.before !== INBOX_ID) return data; // 없는 프로젝트 앞으로는 못 간다
        at = rest.length;
      }
      const projects = [...rest.slice(0, at), data.projects[from], ...rest.slice(at)];
      return projects.every((p, i) => p === data.projects[i]) ? data : { ...data, projects };
    }
    case "archiveProject": {
      if (action.id === INBOX_ID || !data.projects.some((p) => p.id === action.id && !p.archived)) return data;
      const items = action.doneAll
        ? data.items.map((it) => (it.projectId === action.id && it.status !== "done" ? withStatus(it, "done", ctx.now) : it))
        : data.items;
      const projects = data.projects.map((p) => (p.id === action.id ? { ...p, archived: true, archivedAt: ctx.now } : p));
      return { ...data, projects, items };
    }
    case "restoreProject": {
      if (!data.projects.some((p) => p.id === action.id && p.archived)) return data;
      return {
        ...data,
        projects: data.projects.map((p) => (p.id === action.id ? { id: p.id, name: p.name } : p)),
      };
    }
    case "addItem": {
      const title = clean(action.title);
      const project = data.projects.find((p) => p.id === action.projectId);
      if (!title || !project || project.archived) return data;
      const item: Item = {
        id: ctx.newId(),
        projectId: action.projectId,
        title,
        status: "todo",
        importance: action.importance ?? 2,
        assignee: clean(action.assignee ?? ""),
        due: action.due ?? "",
        createdAt: ctx.now,
        startedAt: null,
        doneAt: null,
        subs: [],
        memos: [],
      };
      return { ...data, items: [...data.items, item] };
    }
    case "updateItem": {
      const p = action.patch;
      if (p.title !== undefined && !clean(p.title)) return data;
      return mapItem(data, action.id, (it) => ({
        ...it,
        ...(p.title !== undefined ? { title: clean(p.title) } : {}),
        ...(p.importance !== undefined ? { importance: p.importance } : {}),
        ...(p.due !== undefined ? { due: p.due } : {}),
        ...(p.assignee !== undefined ? { assignee: clean(p.assignee) } : {}),
      }));
    }
    case "setStatus":
      return mapItem(data, action.id, (it) => withStatus(it, action.status, ctx.now));
    case "cycleStatus":
      return mapItem(data, action.id, (it) => withStatus(it, NEXT_STATUS[it.status], ctx.now));
    case "cycleImportance":
      return mapItem(data, action.id, (it) => ({ ...it, importance: ((it.importance % 3) + 1) as Importance }));
    case "deleteItem": {
      const items = data.items.filter((it) => it.id !== action.id);
      return items.length === data.items.length ? data : { ...data, items };
    }
    case "addSub": {
      const title = clean(action.title);
      if (!title) return data;
      return mapItem(data, action.itemId, (it) => ({ ...it, subs: [...it.subs, { id: ctx.newId(), title, done: false }] }));
    }
    case "toggleSub":
      return mapItem(data, action.itemId, (it) => ({
        ...it,
        subs: it.subs.map((s) => (s.id === action.subId ? { ...s, done: action.done } : s)),
      }));
    case "deleteSub":
      return mapItem(data, action.itemId, (it) => ({ ...it, subs: it.subs.filter((s) => s.id !== action.subId) }));
    case "addMemo": {
      const text = clean(action.text);
      if (!text) return data;
      return mapItem(data, action.itemId, (it) => ({ ...it, memos: [...it.memos, { id: ctx.newId(), at: ctx.now, text }] }));
    }
    case "editMemo": {
      const text = clean(action.text);
      const memo = data.items.find((i) => i.id === action.itemId)?.memos.find((m) => m.id === action.memoId);
      // 빈 글로 고치기 = 지우기가 아니다(지우기는 × — 실수로 기록을 잃지 않게). 같은 글·없는 메모도 그대로.
      if (!text || !memo || memo.text === text) return data;
      return mapItem(data, action.itemId, (it) => ({ ...it, memos: it.memos.map((m) => (m.id === action.memoId ? { ...m, text } : m)) }));
    }
    case "deleteMemo":
      return mapItem(data, action.itemId, (it) => ({ ...it, memos: it.memos.filter((m) => m.id !== action.memoId) }));
    case "setReport":
      return { ...data, report: action.rules };
  }
}
