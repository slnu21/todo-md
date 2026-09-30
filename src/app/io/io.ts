/**
 * 파일·창 경계. **파일 I/O 는 반드시 여기를 거친다**(Tauri API 를 다른 곳에서 직접 부르지 않는다).
 * 브라우저(`npm run dev`·e2e)에서는 localStorage 로 흉내 낸다 — Tauri 없이도 전 화면이 동작해야 한다.
 */
import { invoke } from "@tauri-apps/api/core";

/** Rust appbar::Placement 와 같은 모양. */
export interface Placement {
  mode: "dock" | "float";
  edge: "left" | "right";
  monitor: string;
  width: number;
}

export interface MonitorInfo {
  name: string;
  primary: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface Io {
  kind: "tauri" | "browser";
  /** 데이터 폴더 안의 파일. 없으면 null. */
  read(name: string): Promise<string | null>;
  /** 원자적 저장(임시 파일 → 교체). */
  write(name: string, contents: string): Promise<void>;
  /** `.bak1~3` 으로 밀어내기. 시작할 때와 하루 한 번 부른다. */
  backup(name: string): Promise<void>;
  dataDir(): Promise<string>;
  openDataDir(): Promise<void>;
  /** 위젯 배치(도킹/떠 있기 · 가장자리 · 모니터 · 폭). 기억해 두고 해상도가 바뀌면 Rust 가 다시 맞춘다. */
  applyPlacement(p: Placement): Promise<void>;
  listMonitors(): Promise<MonitorInfo[]>;
  /** 트레이로 숨기기(예약도 푼다). */
  hideWidget(): Promise<void>;
  getAutostart(): Promise<boolean>;
  setAutostart(on: boolean): Promise<void>;
  setTrayLabels(toggle: string, quit: string): Promise<void>;
  /** 할 일 상세 별도 창(데스크톱). `anchorY` = 누른 줄의 위젯 안 높이(px). */
  openDetail(itemId: string, anchorY: number): Promise<void>;
  getDetailTarget(): Promise<string | null>;
  hideDetail(): Promise<void>;
  quit(): Promise<void>;
  /** 예시 데이터 요청(스크린샷·e2e). 데이터 파일이 없을 때만 쓴다. */
  seedRequested(): Promise<boolean>;
  /** 주간보고 창 열기(데스크톱). 브라우저는 위젯 위 패널로 그리므로 여기를 안 부른다. */
  openReportWindow(title: string): Promise<void>;
  /** 저장 대화상자 → 텍스트 파일(`kind` = 대화상자 형식 거르개). 취소하면 false. 브라우저는 다운로드. */
  saveText(defaultName: string, contents: string, kind?: TextKind): Promise<boolean>;
}

export type TextKind = "md" | "json";
const TEXT_KINDS: Record<TextKind, { filter: string; mime: string }> = {
  md: { filter: "Markdown", mime: "text/markdown;charset=utf-8" },
  json: { filter: "JSON", mime: "application/json;charset=utf-8" },
};

const tauriIo: Io = {
  kind: "tauri",
  read: (name) => invoke<string | null>("read_data_file", { name }),
  write: (name, contents) => invoke("write_data_file", { name, contents }),
  backup: (name) => invoke("backup_data_file", { name }),
  dataDir: () => invoke<string>("get_data_dir"),
  openDataDir: () => invoke("open_data_dir"),
  applyPlacement: (placement) => invoke("apply_placement", { placement }),
  listMonitors: () => invoke<MonitorInfo[]>("list_monitors"),
  hideWidget: () => invoke("hide_widget"),
  getAutostart: () => invoke<boolean>("get_autostart"),
  setAutostart: (on) => invoke("set_autostart", { on }),
  setTrayLabels: (toggle, quit) => invoke("set_tray_labels", { toggle, quit }),
  openDetail: (itemId, anchorY) => invoke("open_detail_window", { itemId, anchorY }),
  getDetailTarget: () => invoke<string | null>("get_detail_target"),
  hideDetail: () => invoke("hide_detail"),
  quit: () => invoke("quit_app"),
  seedRequested: () => invoke<boolean>("seed_requested"),
  openReportWindow: (title) => invoke("open_report_window", { title }),
  saveText: async (defaultName, contents, kind = "md") => {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: defaultName, filters: [{ name: TEXT_KINDS[kind].filter, extensions: [kind] }] });
    if (!path) return false;
    await invoke("write_text_to", { path, contents });
    return true;
  },
};

const PREFIX = "todomd:";

/** 브라우저 저장소. 접근이 막혀 있어도(사생활 보호 모드 등) 앱은 떠야 한다 — 전부 try/catch. */
const browserIo: Io = {
  kind: "browser",
  read: async (name) => {
    try { return localStorage.getItem(PREFIX + name); } catch { return null; }
  },
  write: async (name, contents) => {
    try { localStorage.setItem(PREFIX + name, contents); } catch { /* 저장소가 막힌 브라우저 — 메모리로만 동작 */ }
  },
  backup: async () => {},
  dataDir: async () => "(browser localStorage)",
  openDataDir: async () => {},
  applyPlacement: async () => {},
  // 브라우저에는 모니터를 물을 방법이 없다 — 설정 화면이 그림을 그릴 수 있게 화면 하나를 흉내 낸다.
  listMonitors: async () => [{ name: "", primary: true, x: 0, y: 0, width: screen.width, height: screen.height, scale: devicePixelRatio }],
  hideWidget: async () => {},
  getAutostart: async () => false,
  setAutostart: async () => {},
  setTrayLabels: async () => {},
  openDetail: async () => {},
  getDetailTarget: async () => null,
  hideDetail: async () => {},
  quit: async () => {},
  seedRequested: async () => new URLSearchParams(location.search).get("seed") === "sample",
  openReportWindow: async () => {},
  saveText: async (defaultName, contents, kind = "md") => {
    const url = URL.createObjectURL(new Blob([contents], { type: TEXT_KINDS[kind].mime }));
    const a = Object.assign(document.createElement("a"), { href: url, download: defaultName });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  },
};

export const isTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const io: Io = isTauri() ? tauriIo : browserIo;

/** 클립보드 복사. 막혀 있으면 false — 화면이 대신 글을 선택해 준다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
