/**
 * PC별 설정(`settings.json`). 데이터 파일과 **분리** — 데이터만 다른 PC 로 옮겨도 모니터 이름 같은
 * 이 PC 만의 값이 따라가 깨지지 않게. 틀린 값은 기본값으로 돌린다(설정은 잃어도 되는 것).
 */

export type ThemePref = "system" | "light" | "dark";
export type LangPref = "system" | "ko" | "en";
/** 도킹(화면 예약) · 떠 있기(항상 위) · 숨김(가장자리에 조각만 남기고, 마우스를 대면 펼침). */
export type DockMode = "dock" | "float" | "peek";
export type DockEdge = "left" | "right";
/** 숨김 모드에서 조각·목록·요약 카드가 나오는 높이. */
export type PeekVpos = "top" | "middle" | "bottom";
/** 가끔 보여주기 간격(분). 0 = 끔. 알림이 아니라 '목록을 잊지 않게' 보여 주는 것(2026-11-21 결정). */
export const PEEK_EVERY = [0, 30, 60, 120] as const;
export type PeekEvery = (typeof PEEK_EVERY)[number];
/** 요약 카드를 보여 두는 시간(초). */
export const PEEK_SHOW = [6, 12] as const;
export type PeekShow = (typeof PEEK_SHOW)[number];
/** 숨김 모드 폭(고정, 논리 px) — Rust appbar::PEEK_WIDTH 와 같다. */
export const PEEK_WIDTH = 300;
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
  /** 숨김 모드 전용(다른 모드에선 안 쓴다). 폭은 고정이라 없다. */
  peek: {
    vpos: PeekVpos;
    every: PeekEvery;
    showSec: PeekShow;
  };
  /** 입력줄의 마지막 프로젝트(Enter 뒤에도 유지 — 다음 실행에도). */
  lastProjectId: string;
  closeAction: CloseAction;
}

export const WIDTH_MIN = 300;
export const WIDTH_MAX = 440;

export function defaultSettings(): Settings {
  return {
    theme: "system",
    lang: "system",
    dock: { mode: "dock", edge: "right", monitor: "", width: 360 },
    peek: { vpos: "top", every: 60, showSec: 6 },
    lastProjectId: "",
    closeAction: "ask",
  };
}

const pick = <T extends string | number>(v: unknown, allowed: readonly T[], fallback: T): T =>
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
  const peek = (typeof raw.peek === "object" && raw.peek !== null ? raw.peek : {}) as Record<string, unknown>;
  const width = typeof dock.width === "number" && Number.isFinite(dock.width) ? Math.round(dock.width) : d.dock.width;
  return {
    theme: pick(raw.theme, ["system", "light", "dark"], d.theme),
    lang: pick(raw.lang, ["system", "ko", "en"], d.lang),
    dock: {
      mode: pick(dock.mode, ["dock", "float", "peek"], d.dock.mode),
      edge: pick(dock.edge, ["left", "right"], d.dock.edge),
      monitor: typeof dock.monitor === "string" ? dock.monitor : "",
      width: Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, width)),
    },
    peek: {
      vpos: pick(peek.vpos, ["top", "middle", "bottom"], d.peek.vpos),
      every: pick(peek.every, PEEK_EVERY, d.peek.every),
      showSec: pick(peek.showSec, PEEK_SHOW, d.peek.showSec),
    },
    lastProjectId: typeof raw.lastProjectId === "string" ? raw.lastProjectId : "",
    closeAction: pick(raw.closeAction, ["ask", "hide", "quit"], d.closeAction),
  };
}

export const serializeSettings = (s: Settings): string => JSON.stringify(s, null, 2) + "\n";
