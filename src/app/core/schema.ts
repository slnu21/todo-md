/**
 * `todo.json` 읽기·쓰기. **fail-soft** — 항목 하나가 틀려도 파일 전체를 버리지 않는다. 대신 무엇을 왜
 * 고쳤는지 경고로 돌려준다(조용히 무시하면 사용자는 영원히 모른다 — md-reader 에서 배운 것).
 *
 * 단, 두 경우는 **열지 않는다**(`ok: false`). 열고 나서 저장하면 원본이 사라지기 때문이다.
 * 1. JSON 이 아니다(손으로 고치다 깨졌거나 반쯤 쓰였다) — 백업(.bak1~3)에서 되살려야 한다.
 * 2. 이 앱보다 새 버전이 쓴 파일이다 — 모르는 필드를 지운 채 저장하게 된다.
 */
import { isLocalStamp, isPlainDate } from "./date";
import {
  DATA_VERSION, emptyData, INBOX_ID,
  type Importance, type Item, type Memo, type Project, type Status, type SubItem, type TodoData,
} from "./model";
import { parseReportRules } from "./report";

export type ParseResult =
  | { ok: true; data: TodoData; warnings: string[] }
  | { ok: false; reason: "notJson" | "notObject" | "newerVersion"; detail: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const STATUSES: readonly Status[] = ["todo", "doing", "done"];

export function parseData(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: "notJson", detail: e instanceof Error ? e.message : String(e) };
  }
  if (!isObj(raw)) return { ok: false, reason: "notObject", detail: typeof raw };
  const version = typeof raw.version === "number" ? raw.version : 1;
  if (version > DATA_VERSION) return { ok: false, reason: "newerVersion", detail: String(version) };

  const warnings: string[] = [];
  const projects: Project[] = [];
  const seen = new Set<string>();
  for (const p of Array.isArray(raw.projects) ? raw.projects : []) {
    if (!isObj(p) || !str(p.id) || seen.has(str(p.id))) {
      warnings.push(`프로젝트 항목을 건너뜀: ${JSON.stringify(p).slice(0, 80)}`);
      continue;
    }
    seen.add(str(p.id));
    const proj: Project = { id: str(p.id), name: str(p.name) };
    if (p.archived === true) {
      proj.archived = true;
      proj.archivedAt = isLocalStamp(p.archivedAt) ? p.archivedAt : null;
    }
    projects.push(proj);
  }
  if (!seen.has(INBOX_ID)) projects.push({ id: INBOX_ID, name: "" });

  const items: Item[] = [];
  const itemIds = new Set<string>();
  for (const i of Array.isArray(raw.items) ? raw.items : []) {
    if (!isObj(i) || !str(i.id) || itemIds.has(str(i.id)) || !str(i.title).trim()) {
      warnings.push(`할 일 항목을 건너뜀: ${JSON.stringify(i).slice(0, 80)}`);
      continue;
    }
    itemIds.add(str(i.id));
    let projectId = str(i.projectId);
    if (!seen.has(projectId)) {
      warnings.push(`'${str(i.title)}' 의 프로젝트(${projectId || "없음"})를 찾지 못해 미분류로 옮김`);
      projectId = INBOX_ID;
    }
    const status = STATUSES.includes(i.status as Status) ? (i.status as Status) : "todo";
    const importance = ([1, 2, 3] as const).includes(i.importance as Importance) ? (i.importance as Importance) : 2;
    items.push({
      id: str(i.id),
      projectId,
      title: str(i.title),
      status,
      importance,
      assignee: str(i.assignee),
      due: isPlainDate(i.due) ? i.due : "",
      createdAt: isLocalStamp(i.createdAt) ? i.createdAt : "1970-01-01T00:00",
      startedAt: isLocalStamp(i.startedAt) ? i.startedAt : null,
      // 완료가 아닌데 완료 시각이 있으면 지운다 — reducer 의 불변식과 맞춘다.
      doneAt: status === "done" && isLocalStamp(i.doneAt) ? i.doneAt : null,
      subs: (Array.isArray(i.subs) ? i.subs : []).filter(isObj).filter((s) => str(s.id) && str(s.title))
        .map((s): SubItem => ({ id: str(s.id), title: str(s.title), done: s.done === true })),
      memos: (Array.isArray(i.memos) ? i.memos : []).filter(isObj).filter((m) => str(m.id) && isLocalStamp(m.at))
        .map((m): Memo => ({ id: str(m.id), at: str(m.at), text: str(m.text) })),
    });
  }
  // v1 → v2: report 필드가 새로 생겼다(없으면 null = 기본값). 틀린 규칙은 버리고 기본값으로.
  let report = null;
  if (raw.report != null) {
    report = parseReportRules(raw.report);
    if (!report) warnings.push("주간보고 규칙을 읽지 못해 기본값으로 되돌림");
  }
  return { ok: true, data: { version: DATA_VERSION, projects, items, report }, warnings };
}

/** 사람이 열어 봐도 읽히게 들여쓰기 2칸. */
export const serializeData = (data: TodoData): string => JSON.stringify(data, null, 2) + "\n";

export { emptyData };
