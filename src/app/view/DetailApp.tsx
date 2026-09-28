/**
 * 데스크톱 상세 창의 루트. 위젯 옆에 뜨는 테두리 없는 창 — 바깥을 누르면(포커스를 잃으면) Rust 가 숨긴다.
 * 어떤 할 일을 볼지는 처음엔 Rust 에 물어 가져오고(`get_detail_target`, 새 창은 이벤트를 놓칠 수 있다),
 * 이미 떠 있는 창에는 `todo://detail` 이벤트로 온다. 데이터·변경은 보고 창과 같은 다리(bridge.ts).
 */
import { useEffect, useState } from "react";
import type { Action } from "../core/actions";
import { plainOf } from "../core/date";
import { resolveLang } from "../core/i18n";
import { INBOX_ID } from "../core/model";
import { io } from "../io/io";
import { startClient, type Shared } from "./bridge";
import { Detail } from "./Detail";
import { LangContext, useT } from "./ui";

export function DetailApp() {
  const [shared, setShared] = useState<Shared | null>(null);
  const [dispatch, setDispatch] = useState<((a: Action) => void) | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [today, setToday] = useState(() => plainOf(new Date()));

  useEffect(() => {
    let stop = () => {};
    let unDetail = () => {};
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unDetail = await listen<string>("todo://detail", (e) => setItemId(e.payload));
      setItemId(await io.getDetailTarget());
      const c = await startClient(setShared);
      stop = c.stop;
      setDispatch(() => c.dispatch);
    })();
    const timer = setInterval(() => setToday(plainOf(new Date())), 60_000);
    return () => { stop(); unDetail(); clearInterval(timer); };
  }, []);

  const theme = shared?.settings.theme ?? "system";
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  if (!shared || !dispatch) return <main className="detail-shell" data-testid="loading" />;
  const lang = resolveLang(shared.settings.lang, navigator.language);
  return (
    <LangContext.Provider value={lang}>
      <DetailWindow shared={shared} itemId={itemId} today={today} dispatch={dispatch} />
    </LangContext.Provider>
  );
}

function DetailWindow({ shared, itemId, today, dispatch }: { shared: Shared; itemId: string | null; today: string; dispatch: (a: Action) => void }) {
  const { t } = useT();
  const item = itemId ? shared.data.items.find((i) => i.id === itemId) : undefined;
  // 지워졌거나 없는 할 일이면 창을 숨긴다.
  useEffect(() => { if (itemId && !item) void io.hideDetail(); }, [itemId, item]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") void io.hideDetail(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!item) return <main className="detail-shell" />;
  const project = shared.data.projects.find((p) => p.id === item.projectId);
  return (
    <main className="detail-shell">
      <Detail
        key={item.id}
        item={item}
        projectName={item.projectId === INBOX_ID ? t("inbox.name") : project?.name ?? ""}
        today={today}
        onClose={() => void io.hideDetail()}
        dispatch={dispatch}
      />
    </main>
  );
}
