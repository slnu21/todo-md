/**
 * 중복 실행 막기 확인(실제 exe) — 두 번째 실행은 스스로 끝나고, 숨겨 둔 첫 위젯이 다시 보인다.
 * 검증 exe 는 `TODOMD_DATA_DIR` 을 쓰므로 평소엔 막기가 꺼져 있다 → `TODOMD_SINGLE_INSTANCE=1` 로 켠다.
 * ⚠ 사용 중인 TODO.md 가 떠 있으면 같은 잠금을 쓰므로 **돌리지 않는다**(검증 exe 가 그 앱을 깨운다).
 *   node scripts/desktop-single.mjs
 */
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9353;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const running = () =>
  execFileSync("tasklist", ["/FI", "IMAGENAME eq todo-md.exe", "/NH"], { encoding: "utf8" })
    .split("\n")
    .filter((l) => l.toLowerCase().startsWith("todo-md.exe")).length;

if (running() > 0) {
  console.log("SKIP  TODO.md 가 이미 실행 중 — 트레이에서 종료한 뒤 다시 돌린다(같은 잠금을 쓴다)");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const dataDir = mkdtempSync(join(tmpdir(), "todomd-single-"));
const env = { ...process.env, TODOMD_DATA_DIR: dataDir, TODOMD_SEED: "sample", TODOMD_SINGLE_INSTANCE: "1" };
const first = spawn(findExe(), [], { env: { ...env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` }, stdio: "ignore" });
const firstExited = new Promise((r) => first.once("exit", () => r(true)));
let widget;
try {
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { await sleep(250); }
  }
  if (!browser) throw new Error("CDP 에 붙지 못했다");
  widget = browser.contexts()[0].pages()[0];
  await widget.waitForSelector('[data-testid="widget"]');
  await sleep(800);
  const visible = () => widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("is_window_visible", { label: "main" }));

  await widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("hide_widget"));
  await sleep(400);
  check("첫 위젯을 트레이로 숨겼다", !(await visible()));

  const second = spawn(findExe(), [], { env, stdio: "ignore" });
  const secondExited = await Promise.race([new Promise((r) => second.once("exit", () => r(true))), sleep(5000).then(() => false)]);
  if (!secondExited) second.kill();
  check("두 번째 실행은 5초 안에 스스로 끝난다", secondExited);
  await sleep(600);
  check("숨겨 둔 첫 위젯이 다시 보인다", await visible());
  check("todo-md.exe 는 하나", running() === 1, `n=${running()}`);

  void widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
  check("종료하면 첫 프로세스도 끝난다", await Promise.race([firstExited, sleep(5000).then(() => false)]));
  await browser.close().catch(() => {});
} finally {
  first.kill();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
if (results.some((r) => !r.ok)) process.exit(1);
