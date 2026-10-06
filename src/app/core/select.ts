/**
 * 화면이 그리는 값을 데이터에서 뽑는다. 순수 함수 — view 는 여기서 받은 것을 그리기만 한다
 * (파생값을 view 에서 계산하지 않는다 — Cairn 규칙).
 */
import { addDays, dateOfStamp, dayDiff, type PlainDate } from "./date";
import { INBOX_ID, type Item, type Memo, type Project, type TodoData } from "./model";

const STATUS_RANK = { doing: 0, todo: 1, done: 2 } as const;

/** 목록 순서: 진행 → 중요도 높음 → 마감 빠른 순(마감 없음은 뒤) → 만든 순. */
export function compareItems(a: Item, b: Item): number {
  const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (r) return r;
  if (a.importance !== b.importance) return b.importance - a.importance;
  const da = a.due || "9999-99-99";
  const db = b.due || "9999-99-99";
  if (da !== db) return da < db ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export const isArchived = (data: TodoData, projectId: string): boolean =>
  !!data.projects.find((p) => p.id === projectId)?.archived;

/** 활성 프로젝트 — 만든 순서, 미분류는 늘 맨 끝. */
export function activeProjects(data: TodoData): Project[] {
  const list = data.projects.filter((p) => !p.archived);
  const inbox = list.filter((p) => p.id === INBOX_ID);
  return [...list.filter((p) => p.id !== INBOX_ID), ...inbox];
}

/** 상세의 프로젝트 고르기 칸 — 활성 프로젝트(목록 순서). 지금 프로젝트가 보관된 것이면 맨 앞에 그것도(옮길 수는 없다). */
export function moveTargets(data: TodoData, currentId: string): Project[] {
  const list = activeProjects(data);
  const cur = data.projects.find((p) => p.id === currentId);
  return cur?.archived ? [cur, ...list] : list;
}

/**
 * 끌어다 놓기·Alt+↑↓ 의 `moveProject.before` 값. `order` = 보이는 활성 순서(미분류 끝).
 * 위로 옮기면 대상 **앞**, 아래로 옮기면 대상 **뒤**(= 그다음 것 앞, 없으면 null = 끝). 흔한 목록 재배열과 같다.
 * 알 수 없거나 제자리면 undefined — 아무것도 보내지 않는다.
 */
export function moveBefore(order: string[], id: string, target: string): string | null | undefined {
  const i = order.indexOf(id);
  const j = order.indexOf(target);
  if (i < 0 || j < 0 || i === j) return undefined;
  return j < i ? target : order[j + 1] ?? null;
}

export const archivedProjects =(data: TodoData): Project[] => data.projects.filter((p) => p.archived);

export interface Group {
  project: Project;
  open: Item[];
  done: Item[];
  /** 마감이 지난 미완료 수(소제목 옆 표시). */
  late: number;
}

/**
 * 위젯 목록. 활성 프로젝트마다 한 묶음. `onDate` 를 주면 그날 마감인 할 일만 남기고 빈 묶음은 뺀다
 * (달력에서 날짜를 누른 경우). 날짜를 안 고르면 빈 프로젝트도 보여 준다 — `+ 추가` 줄이 거기 있다.
 */
export function listGroups(data: TodoData, today: PlainDate, onDate?: PlainDate): Group[] {
  const out: Group[] = [];
  for (const project of activeProjects(data)) {
    const items = data.items
      .filter((i) => i.projectId === project.id && (!onDate || i.due === onDate))
      .sort(compareItems);
    if (onDate && items.length === 0) continue;
    const open = items.filter((i) => i.status !== "done");
    out.push({
      project,
      open,
      done: items.filter((i) => i.status === "done"),
      late: open.filter((i) => i.due && i.due < today).length,
    });
  }
  return out;
}

export type DueInfo =
  | { kind: "late"; days: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "date"; date: PlainDate };

/** 마감 칩. 완료했거나 마감이 없으면 null. */
export function dueInfo(item: Item, today: PlainDate): DueInfo | null {
  if (!item.due || item.status === "done") return null;
  const d = dayDiff(today, item.due);
  if (d < 0) return { kind: "late", days: -d };
  if (d === 0) return { kind: "today" };
  if (d === 1) return { kind: "tomorrow" };
  return { kind: "date", date: item.due };
}

export interface DayMark {
  late: boolean;
  high: boolean;
}

/** 달력 점. 미완료 + 활성 프로젝트만. 빨강(지남)이 파랑(중요 높음)보다 먼저. */
export function calendarMarks(data: TodoData, today: PlainDate): Map<PlainDate, DayMark> {
  const marks = new Map<PlainDate, DayMark>();
  for (const i of data.items) {
    if (!i.due || i.status === "done" || isArchived(data, i.projectId)) continue;
    const m = marks.get(i.due) ?? { late: false, high: false };
    if (i.due < today) m.late = true;
    if (i.importance === 3) m.high = true;
    marks.set(i.due, m);
  }
  return marks;
}

export const lastMemo = (item: Item): Memo | null => item.memos.at(-1) ?? null;

/** 메모 기록을 날짜별로 묶는다(오래된 것이 위). */
export function memoDays(item: Item): { date: PlainDate; memos: Memo[] }[] {
  const out: { date: PlainDate; memos: Memo[] }[] = [];
  for (const m of item.memos) {
    const date = dateOfStamp(m.at);
    const last = out.at(-1);
    if (last && last.date === date) last.memos.push(m);
    else out.push({ date, memos: [m] });
  }
  return out;
}

export const openCount = (data: TodoData, projectId: string): number =>
  data.items.filter((i) => i.projectId === projectId && i.status !== "done").length;

export interface ArchivedRow {
  project: Project;
  done: number;
  open: number;
}

export function archivedRows(data: TodoData): ArchivedRow[] {
  return archivedProjects(data).map((project) => {
    const its = data.items.filter((i) => i.projectId === project.id);
    const done = its.filter((i) => i.status === "done").length;
    return { project, done, open: its.length - done };
  });
}

/** 그날 마감인 활성 할 일 수(날짜 필터 머리줄). */
export const dueOnCount = (data: TodoData, date: PlainDate): number =>
  data.items.filter((i) => i.due === date && !isArchived(data, i.projectId)).length;

/** 달력 '주' 보기에서 보여 줄 줄: 초점 날짜가 든 줄, 없으면 첫 줄. */
export function weekRowIndex(grid: PlainDate[][], focus: PlainDate): number {
  const i = grid.findIndex((row) => row.includes(focus));
  return i < 0 ? 0 : i;
}

/** 어제 여부(마지막 메모 표시 '어제'). */
export const isYesterday = (d: PlainDate, today: PlainDate): boolean => addDays(today, -1) === d;
