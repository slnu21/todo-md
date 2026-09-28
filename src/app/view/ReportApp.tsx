/**
 * 데스크톱 보고 창의 루트(`index.html?view=report`). 데이터는 위젯 창이 쥐고 있고, 여기서는 다리로 받아 그린다.
 * 규칙을 바꾸면 `setReport` action 을 위젯 창으로 보낸다 — 파일은 위젯 창만 쓴다.
 */
import { useEffect, useState } from "react";
import type { Action } from "../core/actions";
import { plainOf } from "../core/date";
import { resolveLang } from "../core/i18n";
import { defaultReport } from "../core/report";
import { startClient, type Shared } from "./bridge";
import { ReportView } from "./ReportView";
import { LangContext } from "./ui";

export function ReportApp() {
  const [shared, setShared] = useState<Shared | null>(null);
  const [dispatch, setDispatch] = useState<((a: Action) => void) | null>(null);
  const [today, setToday] = useState(() => plainOf(new Date()));

  useEffect(() => {
    let stop = () => {};
    void startClient(setShared).then((c) => { stop = c.stop; setDispatch(() => c.dispatch); });
    const timer = setInterval(() => setToday(plainOf(new Date())), 60_000);
    return () => { stop(); clearInterval(timer); };
  }, []);

  const theme = shared?.settings.theme ?? "system";
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  if (!shared || !dispatch) return <main className="report-shell" data-testid="loading" />;
  const lang = resolveLang(shared.settings.lang, navigator.language);
  return (
    <LangContext.Provider value={lang}>
      <ReportView
        data={shared.data}
        rules={shared.data.report ?? defaultReport(lang)}
        today={today}
        lang={lang}
        onRules={(rules) => dispatch({ type: "setReport", rules })}
      />
    </LangContext.Provider>
  );
}
