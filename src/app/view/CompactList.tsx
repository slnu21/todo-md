/**
 * 숨김 모드 목록 — 한 줄짜리 행(약 30px). 마지막 메모 줄·메타 줄을 접고, 메모·하위 항목은 상세 창에서 본다.
 * 묶음·정렬·마감 값은 기본 목록(ItemList)과 똑같이 core/select 에서 받는다. 프로젝트 관리(이름·보관·순서)는
 * 도킹·떠 있기 화면에서 한다 — 여기는 '보고, 체크하고, 연다'만.
 */
import { useState } from "react";
import type { Action } from "../core/actions";
import { NEXT_STATUS } from "../core/actions";
import type { PlainDate } from "../core/date";
import { mdLabel, type Key } from "../core/i18n";
import { INBOX_ID, type Item, type Project, type TodoData } from "../core/model";
import { dueInfo, dueOnCount, listGroups } from "../core/select";
import { Guide, SampleBanner } from "./ItemList";
import { Bars, StatusIcon, useT } from "./ui";

type Dispatch = (a: Action) => void;

export function CompactList({
  data, today, selDate, onClearDate, onOpen, dispatch,
}: {
  data: TodoData;
  today: PlainDate;
  selDate: PlainDate | "";
  onClearDate: () => void;
  onOpen: (id: string, anchorY: number) => void;
  dispatch: Dispatch;
}) {
  const { lang, t } = useT();
  const [showDone, setShowDone] = useState<Set<string>>(new Set());
  const groups = listGroups(data, today, selDate || undefined);
  const name = (p: Project) => (p.id === INBOX_ID ? t("inbox.name") : p.name);
  const noOpen = groups.every((g) => g.open.length === 0);

  return (
    <div className="w-list c-list" data-testid="list">
      <SampleBanner data={data} dispatch={dispatch} />
      {selDate && (
        <div className="filter">
          <span>{t("list.filter", { date: mdLabel(lang, selDate), n: dueOnCount(data, selDate) })}</span>
          <button type="button" className="textbtn" onClick={onClearDate}>{t("list.all")}</button>
        </div>
      )}
      {groups.map((g) => {
        // 빈 프로젝트는 숨김 모드에선 뺀다(+ 추가 줄이 없다 — 입력줄에서 프로젝트를 고른다). 완료만 남은 건 보인다.
        if (g.open.length === 0 && g.done.length === 0) return null;
        const open = showDone.has(g.project.id);
        return (
          <section key={g.project.id} className="group" data-project={g.project.id} aria-label={name(g.project)}>
            <div className="group-head">
              <h3>{name(g.project)}</h3>
              <span className="counts">
                {t("list.left", { n: g.open.length })}
                {g.late > 0 && <>, <span className="late">{t("list.late", { n: g.late })}</span></>}
              </span>
            </div>
            <ul className="items">
              {[...g.open, ...(open ? g.done : [])].map((it) => (
                <CompactRow key={it.id} item={it} today={today} onOpen={(y) => onOpen(it.id, y)} dispatch={dispatch} />
              ))}
            </ul>
            {g.done.length > 0 && (
              <button
                type="button"
                className="textbtn done-toggle"
                onClick={() => setShowDone((s) => { const n = new Set(s); if (n.has(g.project.id)) n.delete(g.project.id); else n.add(g.project.id); return n; })}
              >
                {open ? t("list.hideDone") : t("list.showDone", { n: g.done.length })}
              </button>
            )}
          </section>
        );
      })}
      {selDate && groups.length === 0 && <p className="empty">{t("list.emptyDay")}</p>}
      {!selDate && data.items.length === 0 && <Guide today={today} dispatch={dispatch} />}
      {!selDate && data.items.length > 0 && noOpen && <p className="empty">{t("list.emptyAll")}</p>}
    </div>
  );
}

function CompactRow({ item, today, onOpen, dispatch }: { item: Item; today: PlainDate; onOpen: (anchorY: number) => void; dispatch: Dispatch }) {
  const { lang, t } = useT();
  const due = dueInfo(item, today);
  const statusName = (s: Item["status"]) => t(`status.${s}` as Key);
  const impName = t(`imp.${item.importance}` as Key);
  const subsDone = item.subs.filter((s) => s.done).length;
  return (
    <li className={`item c-item ${item.status}${item.importance === 1 ? " low" : ""}`} data-id={item.id}>
      <button
        type="button"
        className="status"
        aria-label={t("st.aria", { s: statusName(item.status), n: statusName(NEXT_STATUS[item.status]) })}
        onClick={() => dispatch({ type: "cycleStatus", id: item.id })}
      >
        <StatusIcon status={item.status} />
      </button>
      <button
        type="button"
        className="title-btn"
        aria-haspopup="dialog"
        title={item.title}
        onClick={(e) => onOpen(e.currentTarget.closest("li")?.getBoundingClientRect().top ?? 0)}
      >
        <span className="t">{item.title}</span>
        {item.assignee && <span className="who">{item.assignee}</span>}
        {item.subs.length > 0 && <span className="subc">{subsDone}/{item.subs.length}</span>}
      </button>
      <span className="c-due">
        {due?.kind === "late" && <span className="due-late">{t("due.late", { n: due.days })}</span>}
        {due?.kind === "today" && <span className="due-today">{t("due.today")}</span>}
        {due?.kind === "tomorrow" && <span>{t("due.tomorrow")}</span>}
        {due?.kind === "date" && <span>{mdLabel(lang, due.date)}</span>}
      </span>
      <button
        type="button"
        className="imp"
        aria-label={t("imp.aria", { l: impName })}
        title={t("imp.title", { l: impName })}
        onClick={() => dispatch({ type: "cycleImportance", id: item.id })}
      >
        <Bars level={item.importance} />
      </button>
    </li>
  );
}
