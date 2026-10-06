/**
 * Microsoft Store 스크린샷 — 실제 exe 화면(예시 데이터)을 찍어 1920×1080 한 장으로 합성한다.
 *   node scripts/store-shots.mjs <out-dir> [--lang ko|en]
 *
 * - 데스크톱 전체를 찍지 않는다(사용자 창·바탕화면이 들어가므로). 앱 창만 CDP 로 찍고, 화면 위 실제 위치 그대로
 *   중립 배경에 얹는다. 보고 창의 OS 제목 줄은 CDP 가 못 찍어 비슷한 줄을 그려 넣는다.
 * - 데이터는 `TODOMD_DATA_DIR` 임시 폴더 + `TODOMD_SEED=sample`(실데이터 안 건드림). 실행마다 도킹 → 종료 시 해제.
 * - 결과: store-<lang>-1-dock.png · 2-detail.png · 3-report.png · 4-dark.png
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9352;
const W = 1920, H = 1080;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const outDir = resolve(args[0] ?? ".");
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "ko";
mkdirSync(outDir, { recursive: true });

function findExe() {
  if (process.env.TODOMD_EXE) return process.env.TODOMD_EXE;
  const config = join(ROOT, "src-tauri", ".cargo", "config.toml");
  let targetDir = join(ROOT, "src-tauri", "target");
  if (existsSync(config)) {
    const m = /^\s*target-dir\s*=\s*"(.+)"/m.exec(readFileSync(config, "utf8"));
    if (m) targetDir = m[1];
  }
  return join(targetDir, "release", "todo-md.exe");
}

const TEXT = {
  ko: {
    caps: [
      ["화면 한쪽에 늘 보이는 할 일 목록", "작업 표시줄처럼 도킹 — 최대화한 창도 덮지 않습니다"],
      ["할 일마다 시각이 찍히는 메모", "\"그거 어떻게 됐어?\"에 바로 답합니다"],
      ["버튼 하나로 마크다운 주간보고", "금주 실적 · 차주 계획 — 복사하거나 .md 로 저장"],
      ["다크 테마 · 한국 공휴일 달력", "계정도 인터넷도 필요 없습니다 — 데이터는 내 PC 에만"],
    ],
  },
  en: {
    caps: [
      ["A to-do list that stays on screen", "Docks like the taskbar — maximized windows never cover it"],
      ["A timestamped memo log", "Always know where every to-do stands"],
      ["One click to a Markdown weekly report", "This week's results, next week's plan — copy or save as .md"],
      ["Dark theme · calendar with due dates", "No account, no internet — your data stays on your PC"],
    ],
  },
}[lang];

// 날짜 입력칸(input type=date)의 '년-월-일' 같은 글자는 앱 언어가 아니라 WebView2 로캘을 따른다 — 영어판은 로캘도 영어로.
const webviewLang = lang === "en" ? "--lang=en-US" : "--lang=ko-KR";

/** exe 를 한 번 띄워 필요한 창들을 찍는다. 반환: { name: { file, x, y, w, h } } (화면 px). */
async function capture(theme, scenes) {
  const dataDir = mkdtempSync(join(tmpdir(), "todomd-store-"));
  writeFileSync(join(dataDir, "settings.json"), JSON.stringify({ theme, lang, closeAction: "quit", dock: { mode: "dock", edge: "right", monitor: "", width: 360 } }));
  const app = spawn(findExe(), [], {
    env: { ...process.env, TODOMD_DATA_DIR: dataDir, TODOMD_SEED: "sample", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT} ${webviewLang}` },
    stdio: "ignore",
  });
  const shots = {};
  let widget;
  try {
    let browser;
    for (let i = 0; i < 60 && !browser; i++) {
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { await sleep(250); }
    }
    if (!browser) throw new Error("CDP 에 붙지 못했다");
    const ctx = browser.contexts()[0];
    widget = ctx.pages()[0];
    await widget.waitForSelector('[data-testid="widget"]');
    await sleep(1200);
    const snap = async (page, name) => {
      const file = join(outDir, `raw-${lang}-${theme}-${name}.png`);
      await page.screenshot({ path: file });
      const g = await page.evaluate(() => ({ x: screenX, y: screenY, w: innerWidth, h: innerHeight, dpr: devicePixelRatio }));
      if (g.dpr !== 1) console.warn(`[warn] 배율 ${g.dpr} — 합성 위치는 배율 1 기준`);
      shots[name] = { file, ...g };
    };
    for (const s of scenes) await s(widget, ctx, snap);
    await widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
    await sleep(600);
    await browser.close().catch(() => {});
  } finally {
    app.kill();
  }
  return shots;
}

const sceneWidget = async (widget, _ctx, snap) => snap(widget, "widget");
const sceneDetail = async (widget, ctx, snap) => {
  const row = widget.locator("li.item").first(); // 정렬상 맨 위 = 진행 중·높음(메모·하위가 있는 예시)
  const p = ctx.waitForEvent("page", { timeout: 10_000 });
  await row.locator(".title-btn").click();
  const detail = await p;
  await detail.waitForSelector('[data-testid="detail"]');
  await sleep(800);
  await snap(widget, "widget-d");
  await snap(detail, "detail");
  await detail.keyboard.press("Escape");
  await sleep(400);
};
const sceneReport = async (widget, ctx, snap) => {
  const p = ctx.waitForEvent("page", { timeout: 10_000 });
  await widget.locator(".w-bar button").nth(1).click(); // 제목 줄: 찾기 · 보고 · 설정 · ×
  const report = await p;
  await report.waitForSelector('[data-testid="report-out"]');
  await sleep(800);
  shots_title.report = await report.title();
  await snap(report, "report");
};
const shots_title = {};

const light = await capture("light", [sceneWidget, sceneDetail, sceneReport]);
const dark = await capture("dark", [sceneWidget]);

// ── 합성 ───────────────────────────────────────────────────────────────
const url = (f) => "data:image/png;base64," + readFileSync(f).toString("base64");
const font = "data:font/woff2;base64," + readFileSync(join(ROOT, "app", "assets", "fonts", "PretendardVariable.woff2")).toString("base64");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

function html({ wins, cap, dark: isDark }) {
  const bg = isDark
    ? "radial-gradient(1200px 800px at 25% 30%, #2a3550 0%, #161b26 60%, #0f1219 100%)"
    : "radial-gradient(1200px 800px at 25% 30%, #dfe9f7 0%, #c9d6ea 55%, #b4c3dc 100%)";
  const fg = isDark ? "#e8ecf3" : "#1d2433";
  const sub = isDark ? "#a9b3c4" : "#46506a";
  const body = wins.map((w) => {
    const bar = w.titlebar ? `<div class="tb${isDark ? " d" : ""}"><span>${w.titlebar}</span><span class="ctl">—&nbsp;&nbsp;&nbsp;☐&nbsp;&nbsp;&nbsp;✕</span></div>` : "";
    const top = w.y - (w.titlebar ? 32 : 0);
    return `<div class="win${w.shadow ? " sh" : ""}" style="left:${w.x}px;top:${top}px;width:${w.w}px">${bar}<img src="${url(w.file)}" width="${w.w}" height="${w.h}"></div>`;
  }).join("");
  // 위젯 아래 빈 띠 = Windows 작업 표시줄 자리(작업 영역 밖). 아이콘 없는 띠로만 채운다.
  const workBottom = Math.max(...wins.map((w) => w.y + w.h));
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face{font-family:Pretendard;src:url(${font}) format("woff2");font-weight:45 920}
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${bg};font-family:Pretendard,"Malgun Gothic","Segoe UI",sans-serif}
    .cap{position:absolute;left:120px;top:${cap.top ?? 380}px;width:${cap.width ?? 1300}px;color:${fg}}
    .cap h1{font-size:60px;line-height:1.2;margin:0 0 22px;font-weight:700;letter-spacing:-.5px}
    .cap p{font-size:28px;line-height:1.45;margin:0;color:${sub}}
    .win{position:absolute;display:flex;flex-direction:column}
    .win.sh{box-shadow:0 18px 50px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.08);border-radius:8px;overflow:hidden}
    .win img{display:block}
    .tb{height:32px;background:#f3f3f3;color:#222;font:13px "Segoe UI","Malgun Gothic",sans-serif;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
    .tb.d{background:#202020;color:#eee}
    .tb .ctl{opacity:.7;font-size:12px}
    .taskbar{position:absolute;left:0;right:0;top:${workBottom}px;bottom:0;background:${isDark ? "rgba(28,28,28,.92)" : "rgba(238,240,245,.88)"};border-top:1px solid ${isDark ? "#333" : "#d6dae3"}}
  </style><body><div class="taskbar"></div>${cap.hide ? "" : `<div class="cap"><h1>${cap.h}</h1><p>${cap.p}</p></div>`}${body}</body>`;
}

async function compose(name, opts) {
  await page.setContent(html(opts));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(outDir, `store-${lang}-${name}.png`) });
  console.log("wrote", `store-${lang}-${name}.png`);
}

const dock = (s) => ({ file: s.file, x: s.x, y: s.y, w: s.w, h: s.h, shadow: false });
const [c1, c2, c3, c4] = TEXT.caps;
await compose("1-dock", { wins: [dock(light.widget)], cap: { h: c1[0], p: c1[1] } });
await compose("2-detail", { wins: [dock(light["widget-d"]), { ...dock(light.detail), shadow: true }], cap: { h: c2[0], p: c2[1], width: 1000 } });
// 보고 창은 화면 가운데에 뜬다 — 문구와 겹치지 않게 왼쪽 아래로 옮기고 문구는 위에.
const r = light.report;
await compose("3-report", {
  wins: [dock(light.widget), { file: r.file, x: 120, y: 260, w: r.w, h: r.h, shadow: true, titlebar: shots_title.report || "TODO.md" }],
  cap: { h: c3[0], p: c3[1], top: 70, width: 1300 },
});
await compose("4-dark", { wins: [dock(dark.widget)], cap: { h: c4[0], p: c4[1] }, dark: true });
await browser.close();
