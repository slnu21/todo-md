/**
 * 위젯 창 한 장: 제목 줄(설정·닫기) → 작은 달력 → 입력줄 → 프로젝트별 목록. 상세는 위에 겹치는 패널(M1).
 * 화면 상태(고른 날짜·달력 보기·열린 상세·설정 팝오버)는 여기서만 들고, 데이터는 store 가 쥔다.
 */
import { useEffect, useState } from "react";
import type { Action } from "../core/actions";
import type { PlainDate } from "../core/date";
import { INBOX_ID, type TodoData } from "../core/model";
import { activeProjects } from "../core/select";
import type { Settings } from "../core/settings";
import { defaultReport } from "../core/report";
import { io } from "../io/io";
import type { AppState } from "./store";
import { ReportView } from "./ReportView";
import { Calendar, type CalView } from "./Calendar";
import { Detail } from "./Detail";
import { ItemList } from "./ItemList";
import { QuickInput } from "./QuickInput";
import { SettingsPanel } from "./SettingsPanel";
import { GearIcon, useT } from "./ui";

export function Widget({
  state, today, dispatch, updateSettings, onQuit, onOpenDataDir, onDismiss,
}: {
  state: AppState;
  today: PlainDate;
  /** 새 상태를 돌려준다 — 방금 만든 프로젝트 id 를 찾는 데 쓴다. */
  dispatch: (a: Action) => TodoData;
  updateSettings: (fn: (s: Settings) => Settings) => void;
  onQuit: () => void;
  onOpenDataDir: () => void;
  onDismiss: () => void;
}) {
  const { lang, t } = useT();
  const { data, settings } = state;
  const [reportOpen, setReportOpen] = useState(false);
  const [selDate, setSelDate] = useState<PlainDate | "">("");
  const [cal, setCal] = useState<CalView>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1, week: false };
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openItem = openId ? data.items.find((i) => i.id === openId) ?? null : null;
  useEffect(() => { if (openId && !openItem) setOpenId(null); }, [openId, openItem]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (reportOpen) setReportOpen(false);
      else if (settingsOpen) setSettingsOpen(false);
      else if (openId) setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, openId, reportOpen]);

  const projects = activeProjects(data);
  const projectName = (id: string) => (id === INBOX_ID ? t("inbox.name") : data.projects.find((p) => p.id === id)?.name ?? "");

  return (
    <div className="widget" data-testid="widget">
      <div className="w-bar">
        <span className="name">{t("app.name")}</span>
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
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <GearIcon />
          {t("bar.settings")}
        </button>
        {/* × = 트레이로 숨기기(종료는 트레이 메뉴·설정). 브라우저에는 트레이가 없어 두지 않는다. */}
        {io.kind === "tauri" && (
          <button type="button" className="iconbtn" aria-label={t("bar.hide")} title={t("bar.hide")} onClick={() => void io.hideWidget()}>×</button>
        )}
      </div>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          dataDir={state.dataDir}
          onChange={updateSettings}
          onOpenDataDir={onOpenDataDir}
          onQuit={onQuit}
        />
      )}

      {state.blocked && <div className="banner" role="alert">{t(state.blocked === "newerVersion" ? "err.newerVersion" : "err.notJson")}</div>}
      {state.saveError && <div className="banner" role="alert" onClick={onDismiss}>{t("err.save", { msg: state.saveError })}</div>}
      {state.fixed > 0 && <div className="banner warn" role="status" onClick={onDismiss}>{t("warn.fixed", { n: state.fixed })}</div>}

      <Calendar
        data={data}
        today={today}
        selDate={selDate}
        view={cal}
        onView={setCal}
        onPick={(d) => setSelDate((cur) => (cur === d ? "" : d))}
      />
      <QuickInput
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
      <ItemList
        data={data}
        today={today}
        selDate={selDate}
        onClearDate={() => setSelDate("")}
        onOpen={(id, anchorY) =>
          // 데스크톱은 위젯 옆 별도 창(바깥을 누르면 숨는다), 브라우저는 위젯 위 패널.
          io.kind === "tauri" ? void io.openDetail(id, anchorY) : setOpenId((cur) => (cur === id ? null : id))
        }
        dispatch={dispatch}
      />
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
          projectName={projectName(openItem.projectId)}
          today={today}
          onClose={() => setOpenId(null)}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}

