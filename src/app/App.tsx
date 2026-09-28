/**
 * 루트: 데이터를 읽고, 테마·언어를 적용하고, 위젯을 그린다. 데스크톱이면 창을 작업 영역 오른쪽 전체 높이에 놓는다.
 */
import { useEffect, useState } from "react";
import { plainOf } from "./core/date";
import { resolveLang } from "./core/i18n";
import { sampleData } from "./core/sample";
import { io } from "./io/io";
import { store, useStore } from "./view/store";
import { LangContext } from "./view/ui";
import { Widget } from "./view/Widget";
import "./view/app.css";

export function App() {
  const state = useStore();
  const [today, setToday] = useState(() => plainOf(new Date()));

  useEffect(() => {
    void (async () => {
      const seed = await io.seedRequested().catch(() => false);
      await store.load(seed ? () => sampleData(plainOf(new Date())) : undefined);
    })();
    // 자정을 넘기면 '오늘'이 바뀐다 — 늘 떠 있는 창이라 1분마다 확인한다.
    const timer = setInterval(() => setToday(plainOf(new Date())), 60_000);
    const flush = () => { void store.flush(); };
    window.addEventListener("beforeunload", flush);
    return () => { clearInterval(timer); window.removeEventListener("beforeunload", flush); };
  }, []);

  // 창 배치는 처음 읽은 뒤 한 번(폭은 설정값). 보이는 것도 이때 — 기본 위치에서 튀어 오르는 모습을 안 보이게.
  useEffect(() => {
    if (state.loaded) void io.placeWidget(state.settings.dock.width).catch(() => {});
  }, [state.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 테마: 시스템이면 표시 없음(CSS 가 prefers-color-scheme 을 따른다), 직접 고르면 data-theme 으로 고정.
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  const lang = resolveLang(state.settings.lang, navigator.language);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  if (!state.loaded) return <main className="widget" data-testid="loading" />;

  return (
    <LangContext.Provider value={lang}>
      <Widget
        state={state}
        today={today}
        dispatch={store.dispatch}
        updateSettings={store.updateSettings}
        onQuit={async () => { await store.flush(); await io.quit(); }}
        onOpenDataDir={() => void io.openDataDir()}
        onDismiss={store.dismissNotice}
      />
    </LangContext.Provider>
  );
}
