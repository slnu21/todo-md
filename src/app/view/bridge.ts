/**
 * 창 사이 다리. **데이터의 주인은 위젯 창 하나**다(두 창이 같은 파일을 쓰면 서로 덮어쓴다).
 * - 위젯 창(host): 상태가 바뀔 때마다 `todo://state` 로 뿌리고, `todo://action` 을 받아 자기 store 로 돌린다.
 * - 보고 창(client): 뜨자마자 `todo://hello` 로 상태를 청하고, 변경은 `todo://action` 으로 위젯에 보낸다.
 * 브라우저 모드에는 창이 하나라 다리가 필요 없다(보고는 위젯 위 패널).
 */
import type { Action } from "../core/actions";
import type { TodoData } from "../core/model";
import type { Settings } from "../core/settings";
import { isTauri } from "../io/io";
import type { Store } from "./store";

export interface Shared {
  data: TodoData;
  settings: Settings;
}

const STATE = "todo://state";
const ACTION = "todo://action";
const HELLO = "todo://hello";

/** 보고 창인가 — 데스크톱은 Rust 가 초기화 스크립트로 심은 표시, 브라우저는 `?view=report`(개발용). */
export const isReportView = (): boolean =>
  (window as unknown as { __TODOMD_VIEW__?: string }).__TODOMD_VIEW__ === "report" ||
  new URLSearchParams(location.search).get("view") === "report";

/** 위젯 창에서 한 번. 반환값은 정리 함수. */
export async function startHost(store: Store): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { emit, listen } = await import("@tauri-apps/api/event");
  let last: Shared | null = null;
  const send = () => {
    const s = store.getSnapshot();
    if (!s.loaded) return;
    // 같은 객체면 다시 안 보낸다(store 는 바뀔 때만 새 객체를 만든다).
    if (last && last.data === s.data && last.settings === s.settings) return;
    last = { data: s.data, settings: s.settings };
    void emit(STATE, last);
  };
  const unsub = store.subscribe(send);
  const unHello = await listen(HELLO, () => { last = null; send(); });
  const unAction = await listen<Action>(ACTION, (e) => { store.dispatch(e.payload); });
  send();
  return () => { unsub(); unHello(); unAction(); };
}

/** 보고 창에서. 상태가 올 때마다 `onState`. 반환값: dispatch 와 정리 함수. */
export async function startClient(onState: (s: Shared) => void): Promise<{ dispatch: (a: Action) => void; stop: () => void }> {
  const { emit, listen } = await import("@tauri-apps/api/event");
  const unState = await listen<Shared>(STATE, (e) => onState(e.payload));
  await emit(HELLO);
  return { dispatch: (a) => { void emit(ACTION, a); }, stop: unState };
}
