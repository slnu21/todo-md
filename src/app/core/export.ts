/**
 * 내보내기 — 앱 내부 저장 형식(`todo.json`, 스키마 version)과 **분리된** 공개 형식 `todo-md-export` v1.
 * 가져가는 쪽(나중의 Atlas 가져오기 등)이 앱 내부가 바뀌어도 깨지지 않게, 여기 필드는 늘리기만 하고 바꾸지 않는다.
 * 바꿔야 하면 `EXPORT_VERSION` 을 올린다.
 *
 * 범위 = todo.json 전부 + 보관 파일(30일 지난 완료) 전부. 같은 할 일이 양쪽에 있으면 todo.json 쪽.
 */
import type { ArchiveFile } from "./archive";
import type { LocalStamp } from "./date";
import { INBOX_ID, type Item, type TodoData } from "./model";

export const EXPORT_FORMAT = "todo-md-export";
export const EXPORT_VERSION = 1;

export interface ExportProject {
  id: string;
  name: string;
  /** 미분류(기본 프로젝트). */
  inbox: boolean;
  archived: boolean;
  archivedAt: LocalStamp | null;
}

export interface ExportItem {
  id: string;
  projectId: string;
  /** 사람이 읽을 프로젝트 이름(보관 파일에서 온 할 일은 옮길 때의 이름). */
  project: string;
  title: string;
  status: "todo" | "doing" | "done";
  /** 1 낮음 · 2 보통 · 3 높음 */
  importance: 1 | 2 | 3;
  /** YYYY-MM-DD, 없으면 "" */
  due: string;
  /** 비면 나 */
  assignee: string;
  createdAt: LocalStamp;
  startedAt: LocalStamp | null;
  doneAt: LocalStamp | null;
  subs: { title: string; done: boolean }[];
  memos: { at: LocalStamp; text: string }[];
  /** 보관 파일(archive/YYYY.json)에서 왔다. */
  fromArchive: boolean;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: LocalStamp;
  app: { name: "TODO.md"; version: string };
  projects: ExportProject[];
  items: ExportItem[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const stamp = (v: unknown): LocalStamp | null => (typeof v === "string" && v ? v : null);

/** 보관 파일은 옛 형식일 수 있다 — 빠진 필드는 빈 값으로, 모르는 값은 기본값으로. */
function toItem(it: Item, project: string, fromArchive: boolean): ExportItem {
  const status = it.status === "doing" || it.status === "done" ? it.status : "todo";
  const importance = it.importance === 1 || it.importance === 3 ? it.importance : 2;
  return {
    id: str(it.id),
    projectId: str(it.projectId),
    project,
    title: str(it.title),
    status,
    importance,
    due: str(it.due),
    assignee: str(it.assignee),
    createdAt: str(it.createdAt),
    startedAt: stamp(it.startedAt),
    doneAt: stamp(it.doneAt),
    subs: (Array.isArray(it.subs) ? it.subs : []).map((s) => ({ title: str(s?.title), done: s?.done === true })),
    memos: (Array.isArray(it.memos) ? it.memos : []).map((m) => ({ at: str(m?.at), text: str(m?.text) })),
    fromArchive,
  };
}

/**
 * `inboxName` = 미분류의 보이는 이름(언어별 — 데이터에는 이름이 비어 있다). `appVersion` = package.json 버전.
 * 할 일 순서: 프로젝트 순서(보관 프로젝트는 뒤) → 만든 시각. 보관 파일에서 온 것은 맨 뒤(완료 시각 순).
 */
export function buildExport(
  data: TodoData,
  archives: ArchiveFile[],
  opts: { now: LocalStamp; inboxName: string; appVersion: string },
): ExportFile {
  const nameOf = (id: string) => (id === INBOX_ID ? opts.inboxName : data.projects.find((p) => p.id === id)?.name ?? "");
  const projects: ExportProject[] = data.projects.map((p) => ({
    id: p.id,
    name: p.id === INBOX_ID ? opts.inboxName : p.name,
    inbox: p.id === INBOX_ID,
    archived: p.archived === true,
    archivedAt: p.archivedAt ?? null,
  }));
  const rank = new Map(projects.map((p, i) => [p.id, (p.archived ? 10_000 : 0) + i]));
  const live = [...data.items]
    .sort((a, b) => (rank.get(a.projectId) ?? 99_999) - (rank.get(b.projectId) ?? 99_999) || a.createdAt.localeCompare(b.createdAt))
    .map((it) => toItem(it, nameOf(it.projectId), false));

  const have = new Set(data.items.map((i) => i.id));
  const archived: ExportItem[] = [];
  for (const file of archives) {
    for (const it of file.items) {
      if (!it || typeof it !== "object" || typeof it.id !== "string" || have.has(it.id)) continue;
      have.add(it.id); // 보관 파일끼리 겹쳐도 한 번만
      archived.push(toItem(it, file.projects[it.projectId] ?? nameOf(it.projectId), true));
    }
  }
  archived.sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? ""));

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: opts.now,
    app: { name: "TODO.md", version: opts.appVersion },
    projects,
    items: [...live, ...archived],
  };
}

export const serializeExport = (f: ExportFile): string => JSON.stringify(f, null, 2) + "\n";

/** 저장 대화상자 기본 파일 이름. */
export const exportFileName = (today: string): string => `TODO.md-export-${today}.json`;
