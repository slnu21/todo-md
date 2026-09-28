/**
 * 파일·창 경계. **파일 I/O 는 반드시 여기를 거친다**(Tauri API 를 다른 곳에서 직접 부르지 않는다).
 * 브라우저(`npm run dev`·e2e)에서는 localStorage 로 흉내 낸다 — Tauri 없이도 전 화면이 동작해야 한다.
 */
import { invoke } from "@tauri-apps/api/core";

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
  /** 위젯을 작업 영역 오른쪽 전체 높이에 놓고 보인다(M1). 브라우저에서는 아무것도 안 한다. */
  placeWidget(width: number): Promise<void>;
  quit(): Promise<void>;
  /** 예시 데이터 요청(스크린샷·e2e). 데이터 파일이 없을 때만 쓴다. */
  seedRequested(): Promise<boolean>;
  /** 주간보고 창 열기(데스크톱). 브라우저는 위젯 위 패널로 그리므로 여기를 안 부른다. */
  openReportWindow(title: string): Promise<void>;
  /** 저장 대화상자 → 텍스트 파일. 취소하면 false. 브라우저는 다운로드. */
  saveText(defaultName: string, contents: string): Promise<boolean>;
}

const tauriIo: Io = {
  kind: "tauri",
  read: (name) => invoke<string | null>("read_data_file", { name }),
  write: (name, contents) => invoke("write_data_file", { name, contents }),
  backup: (name) => invoke("backup_data_file", { name }),
  dataDir: () => invoke<string>("get_data_dir"),
  openDataDir: () => invoke("open_data_dir"),
  placeWidget: (width) => invoke("place_widget", { width }),
  quit: () => invoke("quit_app"),
  seedRequested: () => invoke<boolean>("seed_requested"),
  openReportWindow: (title) => invoke("open_report_window", { title }),
  saveText: async (defaultName, contents) => {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: defaultName, filters: [{ name: "Markdown", extensions: ["md"] }] });
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
  placeWidget: async () => {},
  quit: async () => {},
  seedRequested: async () => new URLSearchParams(location.search).get("seed") === "sample",
  openReportWindow: async () => {},
  saveText: async (defaultName, contents) => {
    const url = URL.createObjectURL(new Blob([contents], { type: "text/markdown;charset=utf-8" }));
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
