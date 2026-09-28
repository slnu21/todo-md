/**
 * 보관 파일 — 완료한 지 30일 지난 할 일을 `archive/YYYY.json`(완료한 해)으로 옮겨 `todo.json` 을 늘 작게 둔다.
 * 평소엔 읽지 않는다. 주간보고는 길어야 지난주까지라 30일 안쪽만 있으면 된다.
 *
 * 옮기는 순서: **보관 파일을 먼저 쓰고 → todo.json 을 저장**. 도중에 멈추면 같은 항목이 양쪽에 남을 뿐
 * 사라지지 않는다. 합칠 때 id 로 중복을 거른다.
 */
import { addDays, dateOfStamp, type PlainDate } from "./date";
import type { Item, TodoData } from "./model";

export const KEEP_DONE_DAYS = 30;
export const ARCHIVE_VERSION = 1;

export interface ArchiveFile {
  version: number;
  /** 옮길 때의 프로젝트 이름(id → 이름). 나중에 열어 봐도 어느 프로젝트 일인지 알 수 있게. */
  projects: Record<string, string>;
  items: Item[];
}

/** 완료 후 `keepDays` 일 지난 것을 떼어 낸다. 떼어 낼 게 없으면 같은 data 를 돌려준다. */
export function splitOldDone(data: TodoData, today: PlainDate, keepDays = KEEP_DONE_DAYS): { keep: TodoData; moved: Item[] } {
  const cutoff = addDays(today, -keepDays);
  const moved = data.items.filter((i) => i.status === "done" && i.doneAt && dateOfStamp(i.doneAt) < cutoff);
  if (!moved.length) return { keep: data, moved };
  const ids = new Set(moved.map((i) => i.id));
  return { keep: { ...data, items: data.items.filter((i) => !ids.has(i.id)) }, moved };
}

/** 완료한 해별로 묶는다. */
export function byYear(items: Item[]): Map<number, Item[]> {
  const m = new Map<number, Item[]>();
  for (const i of items) {
    const y = +(i.doneAt ?? i.createdAt).slice(0, 4);
    m.set(y, [...(m.get(y) ?? []), i]);
  }
  return m;
}

export function parseArchive(text: string | null): ArchiveFile {
  const empty: ArchiveFile = { version: ARCHIVE_VERSION, projects: {}, items: [] };
  if (!text) return empty;
  try {
    const raw = JSON.parse(text) as Partial<ArchiveFile>;
    return {
      version: ARCHIVE_VERSION,
      projects: raw.projects && typeof raw.projects === "object" ? raw.projects : {},
      items: Array.isArray(raw.items) ? raw.items : [],
    };
  } catch {
    return empty;
  }
}

/** 기존 보관 파일에 합친다(id 가 이미 있으면 건너뜀). 프로젝트 이름은 새로 옮기는 쪽 것으로 덮는다. */
export function mergeArchive(existing: ArchiveFile, items: Item[], data: TodoData): ArchiveFile {
  const have = new Set(existing.items.map((i) => i.id));
  const projects = { ...existing.projects };
  for (const i of items) {
    const p = data.projects.find((x) => x.id === i.projectId);
    if (p) projects[p.id] = p.name;
  }
  return { version: ARCHIVE_VERSION, projects, items: [...existing.items, ...items.filter((i) => !have.has(i.id))] };
}

export const archiveName = (year: number): string => `archive/${year}.json`;
