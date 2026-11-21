/**
 * 숨김 모드 껍데기. 창 상태 셋을 돌린다:
 * - **접힘**: 가장자리에 6px 조각만(위젯이 차지하는 높이만큼). 이 조각이 곧 마우스 감지 영역 — 0.3초 머물면 펼친다.
 * - **펼침**: 컴팩트 위젯(Widget peek). 커서가 나가면 접는다. 단 고정 핀 · 상세 창 · (창에 포커스가 있을 때) 팝오버·입력 중엔 안 접는다.
 * - **카드**: 정해 둔 간격마다 요약을 잠깐(6·12초) 보여 준다. 알림이 아니다 — 포커스를 안 가져가고, 소리·토스트 없음,
 *   전체 화면 앱·방해 금지 중엔 쉰다(2026-11-21 결정). 카드에 마우스를 올리면 펼친다.
 *
 * 창 크기는 Rust(appbar::peek_rect)가 정한다 — 여기서는 상태와 내용 높이만 알린다(io.peekLayout).
 * 브라우저에서는 창이 그대로라 같은 DOM 이 화면 가장자리에 그려져 흉내만 낸다(e2e 용).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PlainDate } from "../core/date";
import { INBOX_ID, type TodoData } from "../core/model";
import { peekDue, peekSummary } from "../core/peek";
import type { Settings } from "../core/settings";
import { dueInfo } from "../core/select";
import { io, type PeekState } from "../io/io";
import { StatusIcon, useT } from "./ui";

/** 숨김 모드에서 Widget 에 넘기는 손잡이. */
export interface PeekCtl {
  open: boolean;
  pinned: boolean;
  onPin: () => void;
  /** busy = 접지 말 것(창에 포커스가 있을 때만), full = 창을 작업 영역 높이까지(팝오버가 잘리지 않게). */
  onBusy: (busy: boolean, full: boolean) => void;
  collapse: () => void;
}

const HOVER_MS = 300;
/** 펼친 동안 '나갔나' 묻는 간격. 두 번 연속 나가 있으면 접는다(≈ 0.35~0.7초). */
const TICK_MS = 350;
const FIRST_CARD_MS = 1500;
const CHECK_CARD_MS = 15_000;
const CARD_MAX = 4;

export function PeekShell({
  data, today, settings, children,
}: {
  data: TodoData;
  today: PlainDate;
  settings: Settings;
  children: (ctl: PeekCtl) => ReactNode;
}) {
  const { t } = useT();
  const { every, showSec } = settings.peek;
  const edge = settings.dock.edge;
  const [state, setState] = useState<PeekState>("collapsed");
  const [pinned, setPinned] = useState(false);
  const [full, setFull] = useState(false);
  const [panelH, setPanelH] = useState(0);
  const [cardH, setCardH] = useState(0);
  const [maxH, setMaxH] = useState(() => maxHeight());

  const stateRef = useRef(state);
  stateRef.current = state;
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const busyRef = useRef(false);
  /** 브라우저(커서를 OS 에 못 묻는다)에서 쓰는 DOM 판단. */
  const overDom = useRef(false);
  const hoverT = useRef(0);
  /** 마지막으로 목록을 보여 준(카드 또는 사용자가 펼친) 시각. */
  const lastShown = useRef(Date.now());
  const panelRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const summary = useMemo(() => peekSummary(data, today, CARD_MAX), [data, today]);
  const openCount = summary.open;

  const openPanel = useCallback(() => {
    clearTimeout(hoverT.current);
    lastShown.current = Date.now();
    setState("open");
  }, []);
  const collapse = useCallback(() => setState("collapsed"), []);
  const onBusy = useCallback((busy: boolean, f: boolean) => { busyRef.current = busy; setFull(f); }, []);
  const onPin = useCallback(() => setPinned((v) => !v), []);

  // ── 높이 재기: 위젯·카드의 실제 높이(작업 영역 상한 안) → Rust 가 창을 그 높이로 놓는다.
  useLayoutEffect(() => {
    const els: [HTMLElement | null, (h: number) => void][] = [[panelRef.current, setPanelH], [cardRef.current, setCardH]];
    const ro = new ResizeObserver(() => {
      for (const [el, set] of els) if (el) set(Math.ceil(el.getBoundingClientRect().height));
    });
    for (const [el, set] of els) if (el) { ro.observe(el); set(Math.ceil(el.getBoundingClientRect().height)); }
    return () => ro.disconnect();
  }, [state]);
  useEffect(() => {
    const onResize = () => setMaxH(maxHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const height = state === "card" ? cardH : full ? maxH : panelH;
  useEffect(() => {
    if (height > 0) void io.peekLayout(state, height).catch(() => {});
  }, [state, height]);

  // ── 펼친 동안: 나갔으면 접는다.
  useEffect(() => {
    if (state !== "open") return;
    let misses = 0;
    let alive = true;
    const id = setInterval(async () => {
      const inside = (await io.peekCursorInside().catch(() => null)) ?? overDom.current;
      const detail = await io.isDetailVisible().catch(() => false);
      if (!alive) return;
      const keep = pinnedRef.current || inside || detail || (document.hasFocus() && busyRef.current);
      misses = keep ? 0 : misses + 1;
      if (misses >= 2) setState("collapsed");
    }, TICK_MS);
    return () => { alive = false; clearInterval(id); };
  }, [state]);

  // ── 가끔 보여주기. 막혀 있으면(전체 화면·방해 금지) lastShown 을 안 바꿔 — 풀리면 다음 확인 때 바로 보인다.
  const tryCard = useCallback(async () => {
    if (stateRef.current !== "collapsed" || openCount === 0) return;
    if (!(await io.peekCanShowCard().catch(() => true))) return;
    if (stateRef.current !== "collapsed") return;
    lastShown.current = Date.now();
    setState("card");
  }, [openCount]);
  useEffect(() => {
    if (every <= 0) return;
    const first = setTimeout(() => void tryCard(), FIRST_CARD_MS); // 켜자마자 한 번 — 여기 있다는 걸 알린다
    return () => clearTimeout(first);
  }, []); // 시작할 때 한 번만
  useEffect(() => {
    if (every <= 0) return;
    const id = setInterval(() => {
      if (peekDue(Date.now(), lastShown.current, every, openCount)) void tryCard();
    }, CHECK_CARD_MS);
    return () => clearInterval(id);
  }, [every, openCount, tryCard]);
  useEffect(() => {
    if (state !== "card") return;
    const id = setTimeout(() => { if (stateRef.current === "card") setState("collapsed"); }, showSec * 1000);
    return () => clearTimeout(id);
  }, [state, showSec]);

  const ctl = useMemo<PeekCtl>(() => ({ open: state === "open", pinned, onPin, onBusy, collapse }), [state, pinned, onPin, onBusy, collapse]);
  const style = { "--peek-max": `${maxH}px`, "--peek-h": `${panelH}px`, "--show": `${showSec}s` } as CSSProperties;
  const pname = (id: string) => (id === INBOX_ID ? t("inbox.name") : data.projects.find((p) => p.id === id)?.name ?? "");

  return (
    <div
      className="peek"
      data-state={state}
      data-edge={edge}
      data-testid="peek"
      style={style}
      onPointerEnter={() => { overDom.current = true; }}
      onPointerLeave={() => { overDom.current = false; clearTimeout(hoverT.current); }}
    >
      <div className={"peek-panel" + (full ? " full" : "")} ref={panelRef} aria-hidden={state !== "open"}>
        {children(ctl)}
      </div>
      {state === "collapsed" && (
        <button
          type="button"
          className="peek-sliver"
          aria-label={t("peek.edge")}
          title={t("peek.edge")}
          onPointerEnter={() => { clearTimeout(hoverT.current); hoverT.current = window.setTimeout(openPanel, HOVER_MS); }}
          onPointerLeave={() => clearTimeout(hoverT.current)}
          onClick={openPanel}
        />
      )}
      {state === "card" && (
        <div className="peek-card" ref={cardRef} role="status" aria-label={t("peek.cardAria")} data-testid="peek-card" onPointerEnter={openPanel} onClick={openPanel}>
          <div className="pk-head">
            <b>{t("app.name")}</b>
            <span>{t("peek.left", { n: summary.open })}</span>
          </div>
          <div className="pk-counts">
            <span>{t("peek.cDoing")} <b>{summary.doing}</b></span>
            <span className="today">{t("peek.cToday")} <b>{summary.dueToday}</b></span>
            <span className="late">{t("peek.cLate")} <b>{summary.late}</b></span>
          </div>
          <ul>
            {summary.top.map((it) => {
              const due = dueInfo(it, today);
              return (
                <li key={it.id} className={it.status}>
                  <StatusIcon status={it.status} />
                  <span className="t">{it.title}</span>
                  {due?.kind === "late" ? <span className="due-late">{t("due.late", { n: due.days })}</span>
                    : due?.kind === "today" ? <span className="due-today">{t("due.today")}</span>
                      : <span className="side">{pname(it.projectId)}</span>}
                </li>
              );
            })}
          </ul>
          <div className="pk-more">{summary.more > 0 && `${t("peek.more", { n: summary.more })} · `}{t("peek.hover")}</div>
          <div className="pk-timer" />
        </div>
      )}
    </div>
  );
}

/** 위젯 최대 높이(CSS px). 데스크톱은 작업 영역(위아래 12px 여백) — 창 높이를 그 값으로 바꾸므로 창 크기로 재면 안 된다.
 *  브라우저는 창 안이 전부. */
function maxHeight(): number {
  return io.kind === "tauri" ? Math.max(200, screen.availHeight - 24) : window.innerHeight;
}
