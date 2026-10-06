/**
 * 루트: 데이터를 읽고, 테마·언어를 적용하고, 위젯을 그린다. 데스크톱이면 창을 작업 영역 오른쪽 전체 높이에 놓는다.
 */
import { useEffect, useRef, useState } from "react";
import { plainOf } from "./core/date";
import { resolveLang, t, type Lang } from "./core/i18n";
import { relocalize } from "./core/report";
import { sampleData } from "./core/sample";
import { io } from "./io/io";
import { startHost } from "./view/bridge";
import { DATA_FILE, store, useStore } from "./view/store";
import { LangContext } from "./view/ui";
import { Widget } from "./view/Widget";

export function App() {
  const state = useStore();
  const [today, setToday] = useState(() => plainOf(new Date()));

  useEffect(() => {
    let stopHost = () => {};
    void (async () => {
      const seed = await io.seedRequested().catch(() => false);
      await store.load(seed ? (lang) => sampleData(plainOf(new Date()), lang) : undefined);
      stopHost = await startHost(store); // 보고 창에 상태를 뿌리고 변경을 받는다(데스크톱만)
    })();
    // 자정을 넘기면 '오늘'이 바뀐다 — 늘 떠 있는 창이라 1분마다 확인한다.
    // 날이 바뀌면 백업도 한 번 더(시작할 때 + 하루 한 번). 며칠씩 켜 두는 앱이라 시작 백업만으로는 오래된다.
    let backedUp = plainOf(new Date());
    const timer = setInterval(() => {
      const now = plainOf(new Date());
      setToday(now);
      if (now !== backedUp && !store.getSnapshot().blocked) {
        backedUp = now;
        void store.flush().then(() => io.backup(DATA_FILE)).catch(() => {});
      }
    }, 60_000);
    const flush = () => { void store.flush(); };
    window.addEventListener("beforeunload", flush);
    return () => { clearInterval(timer); stopHost(); window.removeEventListener("beforeunload", flush); };
  }, []);

  // 창 배치: 처음 읽은 뒤, 그리고 도킹 설정이 바뀔 때마다. 보이는 것도 이때 — 기본 위치에서 튀어 오르는 모습을 안 보이게.
  // 해상도·작업 표시줄이 바뀔 때 다시 맞추는 건 Rust 가 기억한 값으로 한다(appbar.rs).
  const dock = state.settings.dock;
  useEffect(() => {
    if (state.loaded) void io.applyPlacement(dock).catch(() => {});
  }, [state.loaded, dock]);

  // 테마: 시스템이면 표시 없음(CSS 가 prefers-color-scheme 을 따른다), 직접 고르면 data-theme 으로 고정.
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  const lang = resolveLang(state.settings.lang, navigator.language);
  useEffect(() => {
    document.documentElement.lang = lang;
    void io.setTrayLabels(t(lang, "tray.toggle"), t(lang, "tray.quit")).catch(() => {});
  }, [lang]);
  // 언어를 바꾸면 주간보고 규칙의 **기본값인 것만** 새 언어로(직접 고친 값은 그대로). 규칙을 안 고쳤으면(null) 할 일 없음.
  const prevLang = useRef<Lang | null>(null);
  useEffect(() => {
    const prev = prevLang.current;
    prevLang.current = lang;
    const report = store.getSnapshot().data.report;
    if (prev && prev !== lang && report) store.dispatch({ type: "setReport", rules: relocalize(report, prev, lang) });
  }, [lang]);

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
