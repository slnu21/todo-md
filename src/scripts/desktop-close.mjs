/**
 * × 버튼 확인(실제 exe) — 처음엔 묻고(숨기기/종료), 고른 값을 settings.json 에 기억, 설정에서 바꾸면 그대로 따른다.
 * 같은 임시 데이터 폴더로 세 번 실행한다(설정 파일이 실행을 넘어 이어지는지 보려고).
 *   node scripts/desktop-close.mjs <out-dir>
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9351;
const outDir = process.argv[2] ?? ".";
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

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const dataDir = mkdtempSync(join(tmpdir(), "todomd-close-"));
const closeAction = () => {
  try { return JSON.parse(readFileSync(join(dataDir, "settings.json"), "utf8")).closeAction ?? "(없음)"; } catch { return "(파일 없음)"; }
};

/** exe 를 띄우고 위젯 페이지를 넘긴다. `fn` 이 끝나면 quit → 프로세스가 스스로 끝나는지까지 본다. */
async function run(label, fn) {
  const app = spawn(findExe(), [], {
    env: { ...process.env, TODOMD_DATA_DIR: dataDir, TODOMD_SEED: "sample", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` },
    stdio: "ignore",
  });
  const exited = new Promise((r) => app.once("exit", () => r(true)));
  let browser;
  try {
    for (let i = 0; i < 60 && !browser; i++) {
      try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { await sleep(250); }
    }
    if (!browser) throw new Error(`${label}: CDP 에 붙지 못했다`);
    const widget = browser.contexts()[0].pages()[0];
    await widget.waitForSelector('[data-testid="widget"]');
    await sleep(800);
    const visible = () => widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("is_window_visible", { label: "main" }));
    const selfQuit = await fn({ widget, visible, exited });
    if (!selfQuit) void widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
    check(`${label}: 프로세스가 5초 안에 끝난다`, await Promise.race([exited, sleep(5000).then(() => false)]));
  } finally {
    await browser?.close().catch(() => {});
    app.kill();
    await sleep(500);
  }
}

// 1회차: 처음 × → 묻는다. Esc 로 취소, 다시 × → '숨기기' → 숨고 기억.
await run("1회차", async ({ widget, visible }) => {
  const x = widget.getByRole("button", { name: "닫기" });
  await x.click();
  const pop = widget.locator("#close-pop");
  check("처음 × 는 묻는다(숨기기/종료)", await pop.isVisible());
  await sleep(300); // 여는 애니메이션 뒤에 찍는다
  await widget.screenshot({ path: join(outDir, "close-ask.png") });
  await widget.keyboard.press("Escape");
  check("Esc 로 묻기 취소 — 창은 그대로", !(await pop.isVisible()) && (await visible()));
  await x.click();
  await pop.getByRole("button", { name: /숨기기/ }).click();
  await sleep(1200); // 설정 저장(0.5초 모음)
  check("'숨기기' 를 고르면 위젯이 숨는다", !(await visible()));
  check("고른 값을 settings.json 에 기억(hide)", closeAction() === "hide", closeAction());
  return false;
});

// 2회차: 기억한 값 — × 는 묻지 않고 바로 숨긴다. 설정에서 '종료' 로 바꾼다.
await run("2회차", async ({ widget, visible }) => {
  const x = widget.getByRole("button", { name: /숨기기/ });
  check("× 이름이 지금 동작을 말한다(숨기기)", await x.isVisible());
  await widget.getByRole("button", { name: "설정" }).click();
  const seg = widget.getByRole("group", { name: "× 버튼" });
  check("설정에 × 버튼 선택이 있고 '숨기기' 가 눌려 있다", (await seg.getByRole("button", { name: "숨기기" }).getAttribute("aria-pressed")) === "true");
  await sleep(300);
  await widget.screenshot({ path: join(outDir, "close-settings.png") });
  await seg.getByRole("button", { name: "종료" }).click();
  await widget.getByRole("button", { name: "설정" }).click();
  await sleep(1200);
  check("설정에서 바꾼 값을 기억(quit)", closeAction() === "quit", closeAction());
  check("아직 창은 보인다(설정만 바꿈)", await visible());
  return false;
});

// 3회차: × = 종료 — 묻지 않고 프로세스가 끝난다.
await run("3회차", async ({ widget, exited }) => {
  await widget.getByRole("button", { name: "TODO.md 종료" }).first().click().catch(() => {}); // 페이지가 사라지며 끊길 수 있다
  const done = await Promise.race([exited, sleep(5000).then(() => false)]);
  check("× 가 '종료' 면 묻지 않고 끝난다", done);
  return true;
});

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
if (results.some((r) => !r.ok)) process.exit(1);
