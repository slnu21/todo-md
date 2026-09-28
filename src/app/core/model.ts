/**
 * 데이터 모델 — `todo.json` 에 그대로 저장되는 모양. 화면 상태(펼침·선택한 날짜 등)는 여기 두지 않는다.
 * 모양을 바꾸면 `DATA_VERSION` 을 올리고 `schema.ts` 에 migrate 를 더한다 — **기존 파일이 열려야 한다.**
 */
import type { LocalStamp, PlainDate } from "./date";
import type { ReportRules } from "./report";

/** 1 = v0.1.0. 2 = 주간보고 규칙(`report`) 추가. 선택 필드여도 올린다 — 옛 앱이 모르는 필드를 지운 채 저장하지 않게(열기를 거절). */
export const DATA_VERSION = 2;

/** 프로젝트 없는 할 일이 가는 곳. 보관할 수 없고, 활성 목록에서 늘 맨 끝이다. 이름은 화면 언어로 그린다. */
export const INBOX_ID = "inbox";

export type Status = "todo" | "doing" | "done";
export type Importance = 1 | 2 | 3;

export interface Project {
  id: string;
  name: string;
  /** 보관('완료'가 아니다 — 잘 끝난 것도 접은 것도 같은 방법으로 치운다). 없으면 활성. */
  archived?: boolean;
  archivedAt?: LocalStamp | null;
}

export interface SubItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Memo {
  id: string;
  /** 적은 순간. 사용자가 고치지 않는다 — 기록이다. */
  at: LocalStamp;
  text: string;
}

export interface Item {
  id: string;
  projectId: string;
  title: string;
  status: Status;
  importance: Importance;
  /** 자유 텍스트. 비어 있으면 '나'. */
  assignee: string;
  /** 마감일. 없으면 "". */
  due: PlainDate | "";
  createdAt: LocalStamp;
  /** 진행으로 처음 바꾼 순간(자동). */
  startedAt: LocalStamp | null;
  /** 완료로 바꾼 순간(자동). 완료에서 벗어나면 지운다. */
  doneAt: LocalStamp | null;
  subs: SubItem[];
  /** 오래된 것이 앞. */
  memos: Memo[];
}

export interface TodoData {
  version: number;
  projects: Project[];
  items: Item[];
  /** 주간보고 규칙. null = 아직 안 고침(화면 언어의 기본값을 쓴다). 데이터와 같이 옮겨 다니도록 설정 파일이 아니라 여기. */
  report: ReportRules | null;
}

export function emptyData(): TodoData {
  return { version: DATA_VERSION, projects: [{ id: INBOX_ID, name: "" }], items: [], report: null };
}
