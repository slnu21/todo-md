/**
 * 위젯 창 한 장: 제목 줄(설정·닫기) → 작은 달력 → 입력줄 → 프로젝트별 목록. 상세는 위에 겹치는 패널(M1).
 * 화면 상태(고른 날짜·달력 보기·열린 상세·설정 팝오버)는 여기서만 들고, 데이터는 store 가 쥔다.
 * `peek` 가 있으면 숨김 모드의 컴팩트 판: 아이콘 제목 줄 + 고정 핀, 주 달력, 접힌 입력줄, 한 줄 목록(PeekShell 이 감싼다).
 */
import { useEffect, useState } from "react";
import type { Action } from "../core/actions";
import type { PlainDate } from "../core/date";
import type { TodoData } from "../core/model";
import { activeProjects, moveTargets } from "../core/select";
import type { CloseAction, Settings } from "../core/settings";
import { defaultReport } from "../core/report";
import { io } from "../io/io";
import type { AppState } from "./store";
import { ReportView } from "./ReportView";
import { Calendar, type CalView } from "./Calendar";
import { CompactList } from "./CompactList";
import { Detail } from "./Detail";
import { exportAll } from "./exportData";
import { ItemList } from "./ItemList";
import { QuickInput } from "./QuickInput";
import { SearchPanel } from "./SearchPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { PeekCtl } from "./PeekShell";
import { FindIcon, GearIcon, PinIcon, ReportIcon, useT } from "./ui";

export function Widget({
  state, today, dispatch, updateSettings, onQuit, onOpenDataDir, onDismiss, peek,
}: {
  state: AppState;
  today: PlainDate;
  /** 새 상태를 돌려준다 — 방금 만든 프로젝트 id 를 찾는 데 쓴다. */
  dispatch: (a: Action) => TodoData;
  updateSettings: (fn: (s: Settings) => Settings) => void;
  onQuit: () => void;
  onOpenDataDir: () => void;
  onDismiss: () => void;
  /** 숨김 모드일 때만 — 컴팩트 판으로 그리고, 바쁜 동안(팝오버·입력) 접히지 않게 알린다. */
  peek?: PeekCtl;
}) {
  const { lang, t } = useT();
  const { data, settings } = state;
  const [reportOpen, setReportOpen] = useState(false);
  const [selDate, setSelDate] = useState<PlainDate | "">("");
  const [cal, setCal] = useState<CalView>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, week: !!peek }; // 숨김 모드는 주 보기로 시작
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  /** 숨김 모드: 입력줄 펼침(평소엔 '할 일 추가' 한 줄). */
  const [quickOpen, setQuickOpen] = useState(false);

  const openItem = openId ? data.items.find((i) => i.id === openId) ?? null : null;
  useEffect(() => { if (openId && !openItem) setOpenId(null); }, [openId, openItem]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+F = 찾기(이미 열려 있으면 검색칸으로). WebView 기본 찾기 막대 대신.
      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (findOpen) document.querySelector<HTMLInputElement>('[data-testid="search"] input[type="search"]')?.focus();
        else { setSettingsOpen(false); setCloseAsk(false); setFindOpen(true); }
        return;
      }
      if (e.key !== "Escape") return;
      if (reportOpen) setReportOpen(false);
      else if (closeAsk) setCloseAsk(false);
      else if (settingsOpen) setSettingsOpen(false);
      else if (openId) setOpenId(null);
      else if (findOpen) setFindOpen(false);
      else if (quickOpen) setQuickOpen(false);
      else peek?.collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, openId, reportOpen, closeAsk, findOpen, quickOpen, peek]);

  // 숨김 모드: 팝오버·찾기·상세(브라우저)·보고(브라우저)가 열리면 창을 작업 영역 높이까지 키우고(full),
  // 그것들 + 펼친 입력줄이 있는 동안은 마우스가 나가도 접지 않는다(busy — 창에 포커스가 있을 때만, PeekShell).
  const full = settingsOpen || closeAsk || findOpen || !!openId || reportOpen;
  const onBusy = peek?.onBusy;
  useEffect(() => { onBusy?.(full || quickOpen, full); }, [onBusy, full, quickOpen]);
  // 접히면 펼쳐 두었던 것들을 닫는다 — 다음에 펼칠 때 깨끗한 목록부터.
  const peekOpen = peek?.open;
  useEffect(() => {
    if (peekOpen !== false) return;
    setSettingsOpen(false); setCloseAsk(false); setFindOpen(false); setOpenId(null); setReportOpen(false); setQuickOpen(false);
  }, [peekOpen]);

  // × = 설정대로 숨기기(트레이)·종료. "ask" 면 처음 한 번 묻고, 고른 값을 기억한다(설정에서 바꿈).
  const runClose = (a: Exclude<CloseAction, "ask">) => (a === "hide" ? void io.hideWidget() : onQuit());
  const onCloseClick = () => {
    if (settings.closeAction !== "ask") return runClose(settings.closeAction);
    setSettingsOpen(false);
    setCloseAsk((v) => !v);
  };
  const chooseClose = (a: Exclude<CloseAction, "ask">) => {
    setCloseAsk(false);
    updateSettings((s) => ({ ...s, closeAction: a })); // 종료여도 onQuit 이 저장을 비우고(flush) 끝낸다
    runClose(a);
  };
  const closeLabel = settings.closeAction === "hide" ? t("bar.hide") : settings.closeAction === "quit" ? t("set.quit") : t("bar.close");

  const projects = activeProjects(data);
  // 데스크톱은 위젯 옆 별도 창(바깥을 누르면 숨는다), 브라우저는 위젯 위 패널. 목록·찾기가 같이 쓴다.
  const openDetail = (id: string, anchorY: number) =>
    io.kind === "tauri" ? void io.openDetail(id, anchorY) : setOpenId((cur) => (cur === id ? null : id));

  return (
    <div className={"widget" + (peek ? " compact" : "")} data-testid="widget">
      <div className="w-bar">
        <span className="name">{t("app.name")}</span>
        {peek ? (
          <>
            <button
              type="button"
              className="iconbtn ib"
              aria-pressed={findOpen}
              aria-label={t("bar.find")}
              title={`${t("bar.find")} (Ctrl+F)`}
              onClick={() => { setSettingsOpen(false); setCloseAsk(false); setFindOpen((v) => !v); }}
            >
              <FindIcon />
            </button>
            <button
              type="button"
              className="iconbtn ib"
              aria-label={t("bar.report")}
              title={t("bar.report")}
              onClick={() => (io.kind === "tauri" ? void io.openReportWindow(`TODO.md — ${t("r.title")}`) : setReportOpen(true))}
            >
              <ReportIcon />
            </button>
            <button
              type="button"
              className="iconbtn ib"
              aria-label={t("bar.settings")}
              title={t("bar.settings")}
              aria-expanded={settingsOpen}
              aria-controls="settings-pop"
              onClick={() => { setCloseAsk(false); setSettingsOpen((v) => !v); }}
            >
              <GearIcon />
            </button>
            <button
              type="button"
              className="iconbtn ib pin"
              aria-pressed={peek.pinned}
              aria-label={peek.pinned ? t("peek.unpin") : t("peek.pin")}
              title={peek.pinned ? t("peek.unpin") : t("peek.pin")}
              onClick={peek.onPin}
            >
              <PinIcon />
            </button>
          </>
        ) : (
          <>
        <button
          type="button"
          className="chipbtn"
          aria-pressed={findOpen}
          title={`${t("bar.find")} (Ctrl+F)`}
          onClick={() => { setSettingsOpen(false); setCloseAsk(false); setFindOpen((v) => !v); }}
        >
          {t("bar.find")}
        </button>
        <button
          type="button"
          className="chipbtn"
          onClick={() => (io.kind === "tauri" ? void io.openReportWindow(`TODO.md — ${t("r.title")}`) : setReportOpen(true))}
        >
          {t("bar.report")}
        </button>
        <button
          type="button"
          className="chipbtn"
          aria-expanded={settingsOpen}
          aria-controls="settings-pop"
          onClick={() => { setCloseAsk(false); setSettingsOpen((v) => !v); }}
        >
          <GearIcon />
          {t("bar.settings")}
        </button>
          </>
        )}
        {/* × = 숨기기(트레이) 또는 종료 — settings.closeAction. 브라우저에는 트레이·종료가 없어 두지 않는다. */}
        {io.kind === "tauri" && (
          <button
            type="button"
            className="iconbtn"
            aria-label={closeLabel}
            title={closeLabel}
            aria-expanded={settings.closeAction === "ask" ? closeAsk : undefined}
            aria-controls={settings.closeAction === "ask" ? "close-pop" : undefined}
            onClick={onCloseClick}
          >
            ×
          </button>
        )}
      </div>

      {closeAsk && (
        <div className="pop" id="close-pop" role="dialog" aria-label={t("close.title")}>
          <div>
            <h4>{t("close.title")}</h4>
            <div className="close-choices">
              <button type="button" className="choice" autoFocus onClick={() => chooseClose("hide")}>
                <b>{t("close.hide")}</b>
                <small>{t("close.hideSub")}</small>
              </button>
              <button type="button" className="choice" onClick={() => chooseClose("quit")}>
                <b>{t("close.quit")}</b>
                <small>{t("close.quitSub")}</small>
              </button>
            </div>
          </div>
          <p className="note">{t("close.note")}</p>
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          dataDir={state.dataDir}
          onChange={updateSettings}
          onOpenDataDir={onOpenDataDir}
          onExport={() => exportAll(data, t("inbox.name"))}
          onQuit={onQuit}
        />
      )}

      {state.blocked && <div className="banner" role="alert">{t(state.blocked === "newerVersion" ? "err.newerVersion" : "err.notJson")}</div>}
      {state.saveError && <div className="banner" role="alert" onClick={onDismiss}>{t("err.save", { msg: state.saveError })}</div>}
      {state.fixed > 0 && <div className="banner warn" role="status" onClick={onDismiss}>{t("warn.fixed", { n: state.fixed })}</div>}

      {findOpen ? (
        <SearchPanel data={data} today={today} onOpen={openDetail} onClose={() => setFindOpen(false)} />
      ) : (
        <>
          <Calendar
            data={data}
            today={today}
            selDate={selDate}
            view={cal}
            onView={setCal}
            onPick={(d) => setSelDate((cur) => (cur === d ? "" : d))}
          />
          {peek && !quickOpen ? (
            <button type="button" className="quick-closed" onClick={() => setQuickOpen(true)}>
              <span aria-hidden="true">+</span>{t("peek.add")}
            </button>
          ) : (
          <QuickInput
            autoFocus={!!peek}
            projects={projects}
            projectId={settings.lastProjectId}
            onProject={(id) => updateSettings((s) => ({ ...s, lastProjectId: id }))}
            selDate={selDate}
            onAdd={(a) => dispatch({ type: "addItem", ...a })}
            onCreateProject={(name) => {
              const before = new Set(data.projects.map((p) => p.id));
              const next = dispatch({ type: "addProject", name });
              return next.projects.find((p) => !before.has(p.id))?.id ?? null;
            }}
          />
          )}
          {peek ? (
            <CompactList data={data} today={today} selDate={selDate} onClearDate={() => setSelDate("")} onOpen={openDetail} dispatch={dispatch} />
          ) : (
          <ItemList
            data={data}
            today={today}
            selDate={selDate}
            onClearDate={() => setSelDate("")}
            onOpen={openDetail}
            dispatch={dispatch}
          />
          )}
        </>
      )}
      {reportOpen && (
        <div className="report-overlay" role="dialog" aria-label={t("r.title")}>
          <ReportView
            data={data}
            rules={data.report ?? defaultReport(lang)}
            today={today}
            lang={lang}
            onRules={(rules) => dispatch({ type: "setReport", rules })}
            onClose={() => setReportOpen(false)}
          />
        </div>
      )}
      {openItem && (
        <Detail
          item={openItem}
          projects={moveTargets(data, openItem.projectId)}
          today={today}
          onClose={() => setOpenId(null)}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}

