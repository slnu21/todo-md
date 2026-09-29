/**
 * PC별 설정(`settings.json`). 데이터 파일과 **분리** — 데이터만 다른 PC 로 옮겨도 모니터 이름 같은
 * 이 PC 만의 값이 따라가 깨지지 않게. 틀린 값은 기본값으로 돌린다(설정은 잃어도 되는 것).
 */

export type ThemePref = "system" | "light" | "dark";
export type LangPref = "system" | "ko" | "en";
export type DockMode = "dock" | "float";
export type DockEdge = "left" | "right";
/** 위젯 × 를 눌렀을 때. "ask" = 처음 한 번 묻고 고른 값으로 바꾼다(설정에서 되돌릴 수 있다). */
export type CloseAction = "ask" | "hide" | "quit";

export interface Settings {
  theme: ThemePref;
  lang: LangPref;
  dock: {
    mode: DockMode;
    edge: DockEdge;
    /** 모니터 장치 이름. "" = 주 모니터. 없어진 모니터면 주 모니터 같은 쪽으로(M3). */
    monitor: string;
    width: number;
  };
  /** 입력줄의 마지막 프로젝트(Enter 뒤에도 유지 — 다음 실행에도). */
  lastProjectId: string;
  closeAction: CloseAction;
}

export const WIDTH_MIN = 300;
export const WIDTH_MAX = 440;

export function defaultSettings(): Settings {
  return { theme: "system", lang: "system", dock: { mode: "dock", edge: "right", monitor: "", width: 360 }, lastProjectId: "", closeAction: "ask" };
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

export function parseSettings(text: string | null): Settings {
  const d = defaultSettings();
  if (!text) return d;
  let raw: Record<string, unknown>;
  try {
    const v = JSON.parse(text);
    if (typeof v !== "object" || v === null) return d;
    raw = v as Record<string, unknown>;
  } catch {
    return d;
  }
  const dock = (typeof raw.dock === "object" && raw.dock !== null ? raw.dock : {}) as Record<string, unknown>;
  const width = typeof dock.width === "number" && Number.isFinite(dock.width) ? Math.round(dock.width) : d.dock.width;
  return {
    theme: pick(raw.theme, ["system", "light", "dark"], d.theme),
    lang: pick(raw.lang, ["system", "ko", "en"], d.lang),
    dock: {
      mode: pick(dock.mode, ["dock", "float"], d.dock.mode),
      edge: pick(dock.edge, ["left", "right"], d.dock.edge),
      monitor: typeof dock.monitor === "string" ? dock.monitor : "",
      width: Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, width)),
    },
    lastProjectId: typeof raw.lastProjectId === "string" ? raw.lastProjectId : "",
    closeAction: pick(raw.closeAction, ["ask", "hide", "quit"], d.closeAction),
  };
}

export const serializeSettings = (s: Settings): string => JSON.stringify(s, null, 2) + "\n";
