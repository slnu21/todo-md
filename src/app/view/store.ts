/**
 * 위젯 창의 상태 주인. 데이터를 읽고, action 을 core `reduce` 로 돌리고, 0.5초 모아 저장한다.
 * 화면은 `useStore()` 로 읽기만 한다.
 *
 * **읽지 못한 파일은 덮어쓰지 않는다** — 깨졌거나 더 새 버전이 쓴 파일이면 저장을 멈추고(`blocked`)
 * 화면에 알린다. 빈 데이터로 시작한 채 저장하면 원본이 사라지기 때문이다.
 */
import { useSyncExternalStore } from "react";
import { reduce, type Action } from "../core/actions";
import { archiveName, byYear, mergeArchive, parseArchive, splitOldDone } from "../core/archive";
import { plainOf, stampOf } from "../core/date";
import { resolveLang, type Lang } from "../core/i18n";
import { emptyData, type TodoData } from "../core/model";
import { parseData, serializeData } from "../core/schema";
import { parseSettings, serializeSettings, type Settings } from "../core/settings";
import { io } from "../io/io";
import { createSaver } from "../io/saver";

export const DATA_FILE = "todo.json";
export const SETTINGS_FILE = "settings.json";

export interface AppState {
  loaded: boolean;
  data: TodoData;
  settings: Settings;
  /** 읽지 못해 저장을 멈춘 이유. */
  blocked: "notJson" | "newerVersion" | null;
  /** 읽으며 고치거나 건너뛴 항목 수. */
  fixed: number;
  saveError: string | null;
  dataDir: string;
}

type Listener = () => void;

let seq = 0;
/** 짧고 겹치지 않는 id — 시각(36진) + 순번 + 난수. 파일 사이 충돌만 피하면 된다. */
export const newId = (): string =>
  `${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`;

export class Store {
  private state: AppState = {
    loaded: false, data: emptyData(), settings: parseSettings(null), blocked: null, fixed: 0, saveError: null, dataDir: "",
  };
  private listeners = new Set<Listener>();
  private dataSaver = createSaver((c) => io.write(DATA_FILE, c), (e) => this.set({ saveError: String(e) }));
  private settingsSaver = createSaver((c) => io.write(SETTINGS_FILE, c), (e) => this.set({ saveError: String(e) }));

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = (): AppState => this.state;

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  async load(seed?: (lang: Lang) => TodoData): Promise<void> {
    const [text, settingsText, dataDir] = await Promise.all([io.read(DATA_FILE), io.read(SETTINGS_FILE), io.dataDir()]);
    const settings = parseSettings(settingsText);
    if (text === null) {
      const data = seed ? seed(resolveLang(settings.lang, navigator.language)) : emptyData();
      this.set({ loaded: true, data, settings, dataDir });
      if (seed) this.dataSaver.schedule(serializeData(data));
      return;
    }
    const r = parseData(text);
    if (!r.ok) {
      this.dataSaver.disable();
      this.set({ loaded: true, settings, dataDir, blocked: r.reason === "newerVersion" ? "newerVersion" : "notJson" });
      return;
    }
    // 시작할 때 한 번 백업(.bak1~3) — 저장마다 돌리면 0.5초 전 상태만 남는다.
    await io.backup(DATA_FILE).catch(() => {});
    const data = await this.archiveOldDone(r.data);
    this.set({ loaded: true, data, settings, dataDir, fixed: r.warnings.length });
    if (data !== r.data) this.dataSaver.schedule(serializeData(data));
  }

  /**
   * 완료한 지 30일 지난 할 일을 archive/YYYY.json 으로. **보관 파일을 먼저 쓰고** 성공한 해만 todo.json 에서 뺀다 —
   * 쓰다 실패하면 그 해 항목은 그대로 남는다(다음 시작 때 다시 시도). 중복은 id 로 걸러진다.
   */
  private async archiveOldDone(data: TodoData): Promise<TodoData> {
    const { moved } = splitOldDone(data, plainOf(new Date()));
    if (!moved.length) return data;
    const done = new Set<string>();
    for (const [year, items] of byYear(moved)) {
      try {
        const merged = mergeArchive(parseArchive(await io.read(archiveName(year))), items, data);
        await io.write(archiveName(year), `${JSON.stringify(merged, null, 2)}\n`);
        items.forEach((i) => done.add(i.id));
      } catch {
        /* 이번엔 못 옮김 — todo.json 에 남겨 두고 다음 시작 때 다시 */
      }
    }
    return done.size ? { ...data, items: data.items.filter((i) => !done.has(i.id)) } : data;
  }

  dispatch = (action: Action): TodoData => {
    const next = reduce(this.state.data, action, { now: stampOf(new Date()), newId });
    if (next !== this.state.data) {
      this.set({ data: next });
      this.dataSaver.schedule(serializeData(next));
    }
    return next;
  };

  updateSettings = (fn: (s: Settings) => Settings): void => {
    const settings = fn(this.state.settings);
    this.set({ settings });
    this.settingsSaver.schedule(serializeSettings(settings));
  };

  dismissNotice = (): void => this.set({ fixed: 0, saveError: null });

  flush = async (): Promise<void> => {
    await Promise.all([this.dataSaver.flush(), this.settingsSaver.flush()]);
  };
}

export const store = new Store();

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
