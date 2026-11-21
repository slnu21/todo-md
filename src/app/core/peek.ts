/**
 * 숨김 모드의 '가끔 보여주기' 요약 카드에 무엇을 올릴지. 순수 함수 — 화면은 받은 것을 그리기만 한다.
 * 목적은 마감 알림이 아니라 **목록 자체를 잊지 않게** 하는 것(2026-11-21 결정) — 그래서 항목별 시각 지정이 없다.
 */
import { dayDiff, type PlainDate } from "./date";
import type { Item, TodoData } from "./model";
import { compareItems, isArchived } from "./select";

export interface PeekSummary {
  /** 남은(미완료) 할 일 — 활성 프로젝트만. */
  open: number;
  doing: number;
  dueToday: number;
  late: number;
  /** 카드에 올릴 할 일(최대 `max`개). */
  top: Item[];
  /** 카드에 못 올린 나머지 수. */
  more: number;
}

/** 카드 순서: 지난 마감(오래 지난 것 먼저) → 오늘 마감 → 진행 → 그다음은 목록 순서(중요도 → 마감 → 만든 순). */
function rank(i: Item, today: PlainDate): number {
  if (i.due && i.due < today) return 0;
  if (i.due === today) return 1;
  if (i.status === "doing") return 2;
  return 3;
}

export function peekSummary(data: TodoData, today: PlainDate, max = 4): PeekSummary {
  const open = data.items.filter((i) => i.status !== "done" && !isArchived(data, i.projectId));
  const sorted = [...open].sort((a, b) => {
    const r = rank(a, today) - rank(b, today);
    if (r) return r;
    if (rank(a, today) === 0 && a.due !== b.due) return a.due < b.due ? -1 : 1;
    return compareItems(a, b);
  });
  const top = sorted.slice(0, Math.max(0, max));
  return {
    open: open.length,
    doing: open.filter((i) => i.status === "doing").length,
    dueToday: open.filter((i) => i.due === today).length,
    late: open.filter((i) => i.due && dayDiff(today, i.due) < 0).length,
    top,
    more: open.length - top.length,
  };
}

/**
 * 지금 카드를 보여 줄 때인가. `last` = 마지막으로 보여 준(또는 사용자가 목록을 연) 시각(ms).
 * 간격 0 = 끔. 남은 할 일이 없으면 보여 주지 않는다(보여 줄 목록이 없다).
 */
export function peekDue(now: number, last: number, everyMin: number, openCount: number): boolean {
  if (everyMin <= 0 || openCount <= 0) return false;
  return now - last >= everyMin * 60_000;
}
