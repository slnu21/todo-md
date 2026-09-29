/**
 * 찾기 — 제목·메모·하위 항목·담당·프로젝트 이름에서. 낱말(공백으로 나눔)이 **모두** 어딘가에 있어야 맞는다.
 * 검색어가 비면 '완료한 일' 기록(최근 완료 순) — 지난 완료 보기와 같은 화면이다.
 * 보관 파일(`archive/YYYY.json`)의 할 일도 받는다 — 옛 파일은 필드가 빠졌을 수 있어 전부 비어도 되게 읽는다.
 */
import type { Item, Memo } from "./model";

export interface Source {
  item: Item;
  /** 보여 줄 프로젝트 이름(보관 파일이면 옮길 때의 이름). */
  project: string;
  /** 보관 파일에서 왔다(상세를 열 수 없다 — todo.json 에 없다). */
  archived: boolean;
}

export interface Hit extends Source {
  /** 낱말에 맞은 메모 중 가장 최근 것(메모에서 맞았을 때만). */
  memo: Memo | null;
}

/** 낱말: 소문자, 공백으로 나눔, 중복 제거. */
export function tokens(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
}

const lower = (s: unknown): string => (typeof s === "string" ? s.toLowerCase() : "");
const STATUS_RANK: Record<string, number> = { doing: 0, todo: 1, done: 2 };

/** 최근 움직임 — 정렬용. 완료면 완료 시각, 아니면 마지막 메모·만든 시각 중 늦은 것. */
function lastActivity(it: Item): string {
  if (it.status === "done" && it.doneAt) return it.doneAt;
  const memos = it.memos ?? [];
  const m = memos.length ? memos[memos.length - 1].at : "";
  return m > (it.createdAt ?? "") ? m : it.createdAt ?? "";
}

/**
 * `limit` 개까지. 정렬: 진행 → 할 일 → 완료(보관 파일은 맨 뒤), 같은 무리 안에서는 최근 움직임 순.
 * 검색어가 비면 완료한 것만(최근 완료 순).
 */
export function search(sources: Source[], query: string, limit = 200): { hits: Hit[]; total: number } {
  const words = tokens(query);
  const hits: Hit[] = [];
  for (const s of sources) {
    const it = s.item;
    const memos = it.memos ?? [];
    if (!words.length) {
      if (it.status === "done") hits.push({ ...s, memo: null });
      continue;
    }
    const fields = [lower(it.title), lower(it.assignee), lower(s.project), ...(it.subs ?? []).map((x) => lower(x.title))];
    const memoTexts = memos.map((m) => lower(m.text));
    const ok = words.every((w) => fields.some((f) => f.includes(w)) || memoTexts.some((t) => t.includes(w)));
    if (!ok) continue;
    let memo: Memo | null = null;
    for (let i = memos.length - 1; i >= 0; i--) {
      if (words.some((w) => memoTexts[i].includes(w))) { memo = memos[i]; break; }
    }
    hits.push({ ...s, memo });
  }
  const group = (h: Hit) => (h.archived ? 3 : STATUS_RANK[h.item.status] ?? 2);
  hits.sort((a, b) => group(a) - group(b) || lastActivity(b.item).localeCompare(lastActivity(a.item)));
  return { hits: hits.slice(0, limit), total: hits.length };
}

/** 글을 낱말에 맞은 조각과 아닌 조각으로 나눈다(화면이 굵게 칠한다). 대소문자 무시, 겹치면 앞의 것. */
export function highlight(text: string, words: string[]): { text: string; hit: boolean }[] {
  if (!text) return [];
  const low = text.toLowerCase();
  const marks: boolean[] = new Array(text.length).fill(false);
  for (const w of words) {
    if (!w) continue;
    for (let i = low.indexOf(w); i >= 0; i = low.indexOf(w, i + 1)) marks.fill(true, i, i + w.length);
  }
  const out: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; ) {
    let j = i;
    while (j < text.length && marks[j] === marks[i]) j++;
    out.push({ text: text.slice(i, j), hit: marks[i] });
    i = j;
  }
  return out;
}
