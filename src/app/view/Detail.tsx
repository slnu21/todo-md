/**
 * 할 일 상세 — 제목·상태·중요도·마감·담당·하위 항목·**메모 기록**.
 * 메모는 Enter 마다 한 줄 + 적은 시각 자동, 날짜별 묶음, 오래된 것이 위(입력칸이 맨 아래라 최신 기록과 맞닿는다).
 * M1 은 위젯 안 패널이다. M3 에서 위젯 옆 별도 창으로 옮긴다(같은 컴포넌트).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Action } from "../core/actions";
import { timeOfStamp, type PlainDate } from "../core/date";
import { longDay, mdLabel, type Key } from "../core/i18n";
import { INBOX_ID, type Item, type Project, type Status } from "../core/model";
import { memoDays } from "../core/select";
import { LineInput } from "./ItemList";
import { Bars, IMPORTANCES, Seg, useT } from "./ui";

const STATUSES: Status[] = ["todo", "doing", "done"];

export function Detail({
  item, projects, today, onClose, dispatch,
}: {
  item: Item;
  /** 옮길 수 있는 프로젝트(core/select moveTargets). 보관된 것은 지금 프로젝트일 때만 들어 있고 고를 수 없다. */
  projects: Project[];
  today: PlainDate;
  onClose: () => void;
  dispatch: (a: Action) => void;
}) {
  const { lang, t } = useT();
  const [title, setTitle] = useState(item.title);
  const [owner, setOwner] = useState(item.assignee);
  const [armDelete, setArmDelete] = useState(false);
  const [editingMemo, setEditingMemo] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 다른 할 일로 바뀌면 편집 중 값을 새로 받는다.
  useEffect(() => { setTitle(item.title); setOwner(item.assignee); setArmDelete(false); setEditingMemo(null); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [title]);
  // 최신 기록과 입력칸이 맞닿도록 — 열 때와 메모가 늘 때 맨 아래로.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && item.memos.length) el.scrollTop = el.scrollHeight;
  }, [item.id, item.memos.length]);

  const commitTitle = () => {
    if (title.trim() && title !== item.title) dispatch({ type: "updateItem", id: item.id, patch: { title } });
    else setTitle(item.title);
  };
  const commitOwner = () => {
    if (owner !== item.assignee) dispatch({ type: "updateItem", id: item.id, patch: { assignee: owner } });
  };
  const doneSubs = item.subs.filter((s) => s.done).length;

  return (
    <div
      className="detail"
      role="dialog"
      aria-labelledby="pp-title"
      data-testid="detail"
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
    >
      <div className="pp-head">
        <div>
          <select
            className="proj"
            aria-label={t("pp.projectHint")}
            title={t("pp.projectHint")}
            value={item.projectId}
            onChange={(e) => dispatch({ type: "moveItem", id: item.id, projectId: e.target.value })}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} disabled={p.archived}>{p.id === INBOX_ID ? t("inbox.name") : p.name}</option>
            ))}
          </select>
          <textarea
            id="pp-title"
            ref={titleRef}
            className="pp-title"
            rows={1}
            aria-label={t("pp.titleAria")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); commitTitle(); (e.target as HTMLTextAreaElement).blur(); }
            }}
          />
        </div>
        <button type="button" className="iconbtn" aria-label={t("pp.close")} onClick={onClose}>×</button>
      </div>

      <div className="pp-body" ref={bodyRef}>
        <div className="props">
          <span>{t("pp.status")}</span>
          <Seg
            label={t("pp.status")}
            items={STATUSES.map((s) => ({ v: s, label: t(`status.${s}` as Key) }))}
            value={item.status}
            onPick={(s) => dispatch({ type: "setStatus", id: item.id, status: s })}
          />
          <span>{t("pp.imp")}</span>
          <Seg
            label={t("pp.imp")}
            items={IMPORTANCES.map((l) => ({ v: l, label: <Bars level={l} />, aria: t("imp.title", { l: t(`imp.${l}` as Key) }), title: t(`imp.${l}` as Key) }))}
            value={item.importance}
            onPick={(l) => dispatch({ type: "updateItem", id: item.id, patch: { importance: l } })}
          />
          <span>{t("pp.due")}</span>
          <input
            type="date"
            className="field"
            aria-label={t("pp.due")}
            value={item.due}
            onChange={(e) => dispatch({ type: "updateItem", id: item.id, patch: { due: e.target.value } })}
          />
          <span>{t("pp.owner")}</span>
          <input
            className="field"
            aria-label={t("pp.owner")}
            placeholder={t("pp.ownerPh")}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onBlur={commitOwner}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) commitOwner(); }}
          />
        </div>

        <div className="pp-sec">
          <h4><span>{t("pp.subs")}</span><span>{doneSubs}/{item.subs.length}</span></h4>
          {item.subs.map((s) => (
            <div key={s.id} className={"sub" + (s.done ? " done" : "")}>
              <label>
                <input type="checkbox" checked={s.done} onChange={(e) => dispatch({ type: "toggleSub", itemId: item.id, subId: s.id, done: e.target.checked })} />
                <span>{s.title}</span>
              </label>
              <button type="button" className="x" aria-label={t("sub.delAria")} onClick={() => dispatch({ type: "deleteSub", itemId: item.id, subId: s.id })}>×</button>
            </div>
          ))}
          <LineInput placeholder={t("sub.ph")} onEnter={(v) => dispatch({ type: "addSub", itemId: item.id, title: v })} />
        </div>

        <div className="pp-sec">
          <h4><span>{t("pp.memos")}</span><span>{t("pp.lines", { n: item.memos.length })}</span></h4>
          {item.memos.length === 0 ? (
            <p className="log-empty">{t("pp.emptyLog")}</p>
          ) : (
            <ul className="log" data-testid="memo-log">
              {memoDays(item).map((d) => [
                <li key={"h" + d.date} className="day-h">{longDay(lang, d.date, today)}</li>,
                ...d.memos.map((m) => (
                  <li key={m.id} className="m">
                    <time dateTime={m.at}>{timeOfStamp(m.at)}</time>
                    {editingMemo === m.id ? (
                      <MemoEdit
                        initial={m.text}
                        onDone={(text) => {
                          if (text !== null) dispatch({ type: "editMemo", itemId: item.id, memoId: m.id, text });
                          setEditingMemo(null);
                        }}
                      />
                    ) : (
                      <span onDoubleClick={() => setEditingMemo(m.id)}>{m.text}</span>
                    )}
                    <span className="m-acts">
                      {editingMemo !== m.id && (
                        <button type="button" className="x" aria-label={t("memo.editAria")} title={t("memo.editAria")} onClick={() => setEditingMemo(m.id)}>✎</button>
                      )}
                      <button type="button" className="x" aria-label={t("memo.delAria")} onClick={() => dispatch({ type: "deleteMemo", itemId: item.id, memoId: m.id })}>×</button>
                    </span>
                  </li>
                )),
              ])}
            </ul>
          )}
          <LineInput
            className="field memo-in"
            placeholder={t("pp.memoPh")}
            ariaLabel={t("pp.memoAria")}
            autoFocus
            onEnter={(v) => dispatch({ type: "addMemo", itemId: item.id, text: v })}
          />
        </div>
      </div>

      <div className="pp-foot">
        <span>{t("pp.created", { date: mdLabel(lang, item.createdAt.slice(0, 10)), time: timeOfStamp(item.createdAt) })}</span>
        <button
          type="button"
          className="danger"
          onClick={() => {
            if (!armDelete) { setArmDelete(true); return; }
            dispatch({ type: "deleteItem", id: item.id });
            onClose();
          }}
        >
          {armDelete ? t("pp.confirm") : t("pp.delete")}
        </button>
      </div>
    </div>
  );
}

/**
 * 메모 한 줄 고치기 — 줄바꿈되는 입력칸(메모는 길 수 있다). Enter·바깥 클릭 = 저장, Esc = 취소(`null`).
 * 한글 조합 중 Enter 는 무시. 적은 시각은 그대로(기록이라서 — reduce `editMemo`).
 */
function MemoEdit({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const { t } = useT();
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const finish = (r: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(r);
  };
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
  }, [v]);
  return (
    <textarea
      ref={ref}
      className="memo-edit"
      rows={1}
      aria-label={t("memo.editInput")}
      value={v}
      autoFocus
      onFocus={(e) => { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n); }}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => finish(v)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Enter") { e.preventDefault(); finish(v); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(null); }
      }}
    />
  );
}
