/**
 * 빌드된 exe 를 띄워 **실제 WebView2 화면**을 캡처한다. 브라우저 e2e 가 못 보는 것(창 크기·위치,
 * 테두리 없는 창, Tauri 커맨드 경계)을 눈으로 확인하는 용도다.
 *
 *   node scripts/desktop-shot.mjs <out.png> [--data <폴더>] [--eval "<JS>"] [--keep]
 *
 * - WebView2 는 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 로 원격 디버깅 포트를 연다 → Playwright 가 CDP 로 붙는다.
 * - `--data` 를 주면 `TODOMD_DATA_DIR` 로 넘겨 **사용자 실데이터를 건드리지 않는다**(기본은 임시 폴더).
 * - 창 기하(위치·크기)는 stdout 에 JSON 한 줄로 찍는다.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9344;

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

const args = process.argv.slice(2);
const out = args[0];
if (!out) throw new Error("usage: desktop-shot.mjs <out.png> [--data dir] [--eval js] [--keep]");
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dataDir = opt("--data") ?? mkdtempSync(join(tmpdir(), "todomd-shot-"));
const evalJs = opt("--eval");

const exe = findExe();
if (!existsSync(exe)) throw new Error(`exe 없음: ${exe} — 먼저 npm run tauri build`);

const app = spawn(exe, [], {
  env: { ...process.env, TODOMD_DATA_DIR: dataDir, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` },
  stdio: "ignore",
});
try {
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!browser) throw new Error("CDP 에 붙지 못했다");
  const page = browser.contexts()[0].pages()[0];
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
  if (evalJs) { await page.evaluate(evalJs); await page.waitForTimeout(400); }
  const geo = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, sx: screenX, sy: screenY, screenW: screen.availWidth, screenH: screen.availHeight, dpr: devicePixelRatio }));
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ out, dataDir, ...geo }));
  // 강제 종료 전에 앱 스스로 끝내게 한다 — 도킹(화면 예약)을 풀 기회를 준다(빈 띠 방지).
  if (!args.includes("--keep")) {
    await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));
  }
  await browser.close().catch(() => {});
} finally {
  if (!args.includes("--keep")) app.kill();
}
