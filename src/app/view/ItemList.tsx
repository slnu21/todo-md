/**
 * 프로젝트별 목록. 소제목(스크롤해도 위에 붙음) 아래 할 일 체크리스트.
 * 정렬·묶음·마감 칩 값은 전부 core/select 에서 받는다 — 여기서 계산하지 않는다.
 */
import { useRef, useState } from "react";
import type { Action } from "../core/actions";
import { NEXT_STATUS } from "../core/actions";
import { dateOfStamp, timeOfStamp, type PlainDate } from "../core/date";
import { mdLabel, type Key } from "../core/i18n";
import { INBOX_ID, type Item, type Project, type TodoData } from "../core/model";
import { archivedRows, dueInfo, dueOnCount, isYesterday, lastMemo, listGroups, openCount } from "../core/select";
import { Bars, StatusIcon, useT } from "./ui";

type Dispatch = (a: Action) => void;

export function ItemList({
  data, today, selDate, onClearDate, onOpen, dispatch,
}: {
  data: TodoData;
  today: PlainDate;
  selDate: PlainDate | "";
  onClearDate: () => void;
  /** `anchorY` = 누른 줄의 위젯 안 높이 — 데스크톱 상세 창을 그 높이에 띄운다. */
  onOpen: (id: string, anchorY: number) => void;
  dispatch: Dispatch;
}) {
  const { lang, t } = useT();
  const [showDone, setShowDone] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const groups = listGroups(data, today, selDate || undefined);
  const archived = archivedRows(data);
  const name = (p: Project) => (p.id === INBOX_ID ? t("inbox.name") : p.name);
  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  };
  const noItems = data.items.every((i) => i.status === "done" || data.projects.find((p) => p.id === i.projectId)?.archived);

  function archive(p: Project) {
    if (openCount(data, p.id) > 0) setConfirming(p.id);
    else dispatch({ type: "archiveProject", id: p.id, doneAll: false }); // 남은 일이 없으면 묻지 않는다
  }

  return (
    <div className="w-list" data-testid="list">
      {selDate && (
        <div className="filter">
          <span>{t("list.filter", { date: mdLabel(lang, selDate), n: dueOnCount(data, selDate) })}</span>
          <button type="button" className="textbtn" onClick={onClearDate}>{t("list.all")}</button>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.project.id} className="group" data-project={g.project.id} aria-label={name(g.project)}>
          <div className="group-head">
            <h3>{name(g.project)}</h3>
            <span className="gh-actions">
              {g.project.id !== INBOX_ID && (
                <button type="button" className="gh-btn" aria-label={t("arc.aria", { p: name(g.project) })} onClick={() => archive(g.project)}>
                  {t("gh.archive")}
                </button>
              )}
              <span className="counts">
                {t("list.left", { n: g.open.length })}
                {g.late > 0 && <>, <span className="late">{t("list.late", { n: g.late })}</span></>}
              </span>
            </span>
          </div>
          {confirming === g.project.id && (
            <div className="confirm" role="group">
              <span>{t("arc.confirm", { n: openCount(data, g.project.id) })}</span>
              <span className="acts">
                <button type="button" className="primary" autoFocus onClick={() => { dispatch({ type: "archiveProject", id: g.project.id, doneAll: true }); setConfirming(null); }}>
                  {t("arc.doneAll")}
                </button>
                <button type="button" onClick={() => { dispatch({ type: "archiveProject", id: g.project.id, doneAll: false }); setConfirming(null); }}>
                  {t("arc.keep")}
                </button>
                <button type="button" onClick={() => setConfirming(null)}>{t("arc.cancel")}</button>
              </span>
            </div>
          )}
          <ul className="items">
            {[...g.open, ...(showDone.has(g.project.id) ? g.done : [])].map((it) => (
              <Row
                key={it.id}
                item={it}
                today={today}
                expanded={expanded.has(it.id)}
                onExpand={() => setExpanded((s) => toggle(s, it.id))}
                onCollapse={() => setExpanded((s) => { const n = new Set(s); n.delete(it.id); return n; })}
                onOpen={(y) => onOpen(it.id, y)}
                dispatch={dispatch}
              />
            ))}
          </ul>
          <AddLine project={g.project} label={name(g.project)} due={selDate} dispatch={dispatch} />
          {g.done.length > 0 && (
            <button type="button" className="textbtn done-toggle" onClick={() => setShowDone((s) => toggle(s, g.project.id))}>
              {showDone.has(g.project.id) ? t("list.hideDone") : t("list.showDone", { n: g.done.length })}
            </button>
          )}
        </section>
      ))}
      {selDate && groups.length === 0 && <p className="empty">{t("list.emptyDay")}</p>}
      {!selDate && noItems && <p className="empty">{t("list.emptyAll")}</p>}
      {archived.length > 0 && !selDate && (
        <div className="archive-box">
          <span>{t("arc.title", { n: archived.length })}</span>{" "}
          <button type="button" className="textbtn" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? t("arc.hide") : t("arc.show")}
          </button>
          {showArchived && (
            <ul>
              {archived.map((r) => (
                <li key={r.project.id}>
                  <span>{r.project.name}<small>{t("arc.meta", { d: r.done, o: r.open })}</small></span>
                  <button type="button" className="textbtn" onClick={() => dispatch({ type: "restoreProject", id: r.project.id })}>{t("arc.restore")}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  item, today, expanded, onExpand, onCollapse, onOpen, dispatch,
}: {
  item: Item;
  today: PlainDate;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onOpen: (anchorY: number) => void;
  dispatch: Dispatch;
}) {
  const { lang, t } = useT();
  const due = dueInfo(item, today);
  const memo = lastMemo(item);
  const subsDone = item.subs.filter((s) => s.done).length;
  const statusName = (s: Item["status"]) => t(`status.${s}` as Key);
  const impName = t(`imp.${item.importance}` as Key);
  const subToggleRef = useRef<HTMLButtonElement>(null);
  const memoWhen = memo
    ? dateOfStamp(memo.at) === today ? timeOfStamp(memo.at)
      : isYesterday(dateOfStamp(memo.at), today) ? t("ago.yesterday")
        : `${+memo.at.slice(5, 7)}/${+memo.at.slice(8, 10)}`
    : "";

  return (
    <li className={`item ${item.status}${item.importance === 1 ? " low" : ""}`} data-id={item.id}>
      <div className="row">
        <button
          type="button"
          className="status"
          aria-label={t("st.aria", { s: statusName(item.status), n: statusName(NEXT_STATUS[item.status]) })}
          onClick={() => dispatch({ type: "cycleStatus", id: item.id })}
        >
          <StatusIcon status={item.status} />
        </button>
        <div className="body">
          <button
            type="button"
            className="title-btn"
            aria-haspopup="dialog"
            onClick={(e) => onOpen(e.currentTarget.closest("li")?.getBoundingClientRect().top ?? 0)}
          >
            <span className="t">{item.title}</span>
          </button>
          {memo && <div className="lastmemo"><time dateTime={memo.at}>{memoWhen}</time>{memo.text}</div>}
          <div className="meta">
            <button
              type="button"
              className="imp"
              aria-label={t("imp.aria", { l: impName })}
              title={t("imp.title", { l: impName })}
              onClick={() => dispatch({ type: "cycleImportance", id: item.id })}
            >
              <Bars level={item.importance} />
            </button>
            {due?.kind === "late" && <span className="due-late">{t("due.late", { n: due.days })}</span>}
            {due?.kind === "today" && <span className="due-today">{t("due.today")}</span>}
            {due?.kind === "tomorrow" && <span>{t("due.tomorrow")}</span>}
            {due?.kind === "date" && <span>{mdLabel(lang, due.date)}</span>}
            {item.assignee && <span className="who">{item.assignee}</span>}
            <button ref={subToggleRef} type="button" className="subtoggle" aria-expanded={expanded} onClick={onExpand}>
              {item.subs.length ? t("sub.count", { a: subsDone, b: item.subs.length }) : t("sub.add")}
            </button>
            {item.memos.length > 0 && <span>{t("memo.count", { n: item.memos.length })}</span>}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="subs-box">
          {item.subs.map((s) => (
            <label key={s.id} className={"sub" + (s.done ? " done" : "")}>
              <input type="checkbox" checked={s.done} onChange={(e) => dispatch({ type: "toggleSub", itemId: item.id, subId: s.id, done: e.target.checked })} />
              <span>{s.title}</span>
            </label>
          ))}
          <LineInput
            placeholder={t("sub.ph")}
            autoFocus={item.subs.length === 0}
            onEnter={(v) => dispatch({ type: "addSub", itemId: item.id, title: v })}
            onCancel={(how, to) => {
              // Esc = 언제나 접기(포커스는 펼침 버튼으로). 비운 채 떠나면 = 하위가 없을 때만 접기(추가하려고 연 칸이라서).
              // 펼침 버튼으로 옮겨 간 거면 그 클릭이 접으므로 여기서 접지 않는다(접었다 다시 펼쳐지는 것 방지).
              if (how === "escape") { onCollapse(); subToggleRef.current?.focus(); }
              else if (item.subs.length === 0 && to !== subToggleRef.current) onCollapse();
            }}
          />
        </div>
      )}
    </li>
  );
}

function AddLine({ project, label, due, dispatch }: { project: Project; label: string; due: PlainDate | ""; dispatch: Dispatch }) {
  const { t } = useT();
  return (
    <LineInput
      ariaLabel={t("list.addAria", { p: label })}
      placeholder={t("list.addTo", { p: label })}
      onEnter={(v) => dispatch({ type: "addItem", projectId: project.id, title: v, due })}
    />
  );
}

/**
 * 한 줄 입력: Enter 로 내보내고 비운 뒤 포커스를 그대로 둔다(연달아 적기). 한글 조합 중 Enter 는 무시.
 * `onCancel` 이 있으면 Esc(조합 중 제외)로, 그리고 **비운 채 포커스를 잃으면**(`relatedTarget` = 옮겨 간 곳) 부른다.
 */
export function LineInput({
  placeholder, ariaLabel, onEnter, onCancel, autoFocus, className = "line-in",
}: {
  placeholder: string;
  ariaLabel?: string;
  onEnter: (v: string) => void;
  onCancel?: (how: "escape" | "blur", to: Element | null) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const [v, setV] = useState("");
  return (
    <input
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      value={v}
      autoFocus={autoFocus}
      onChange={(e) => setV(e.target.value)}
      onBlur={(e) => { if (onCancel && !v.trim()) onCancel("blur", e.relatedTarget as Element | null); }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.stopPropagation();
          setV("");
          onCancel("escape", null);
          return;
        }
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        e.preventDefault();
        if (!v.trim()) return;
        onEnter(v);
        setV("");
      }}
    />
  );
}
