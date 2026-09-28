/**
 * 데스크톱 보고 창 확인 — 브라우저 e2e 가 못 보는 **창 사이 다리**(bridge.ts)를 실제 exe 로 본다.
 *   node scripts/desktop-report.mjs <out-dir>
 * 1) 예시 데이터로 exe 를 띄우고 위젯의 '보고'를 누른다 → 보고 창(view=report)이 새로 뜨는지
 * 2) 보고 창에 위젯의 데이터가 건너왔는지(결과 첫 줄)
 * 3) 보고 창에서 프리셋을 바꾸면 **위젯 창이** todo.json 에 저장하는지(파일을 직접 읽어 확인)
 * 4) 두 창 캡처
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9345;
const outDir = process.argv[2] ?? ".";

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

const dataDir = mkdtempSync(join(tmpdir(), "todomd-report-"));
const app = spawn(findExe(), [], {
  env: { ...process.env, TODOMD_DATA_DIR: dataDir, TODOMD_SEED: "sample", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` },
  stdio: "ignore",
});
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); };
try {
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  if (!browser) throw new Error("CDP 에 붙지 못했다");
  const ctx = browser.contexts()[0];
  const widget = ctx.pages()[0];
  await widget.waitForSelector('[data-testid="widget"]');
  await widget.waitForTimeout(800);

  const reportPromise = ctx.waitForEvent("page", { timeout: 10_000 });
  await widget.getByRole("button", { name: "보고", exact: true }).click();
  const report = await reportPromise;
  await report.waitForSelector('[data-testid="report-out"]', { timeout: 10_000 });
  // 보고 창은 같은 index.html 에 초기화 스크립트로 표시를 심는다(주소로는 구별 안 됨) — 화면으로 판정
  check("보고 창이 뜬다", (await report.locator('[data-testid="report"]').count()) === 1 && (await report.locator('[data-testid="widget"]').count()) === 0);

  const first = (await report.getByTestId("report-out").textContent())?.split("\n")[0] ?? "";
  check("위젯 데이터가 보고 창으로 건너온다", first.startsWith("## 금주 실적"), first);
  await report.screenshot({ path: join(outDir, "desktop-report.png") });

  await report.getByRole("button", { name: "간단 요약" }).click();
  await report.waitForTimeout(1200); // action → 위젯 reduce → 0.5초 모아 저장
  const saved = JSON.parse(readFileSync(join(dataDir, "todo.json"), "utf8"));
  check("보고 창의 변경을 위젯 창이 파일에 저장한다", saved.report?.preset === "brief", `version=${saved.version} preset=${saved.report?.preset}`);
  const briefText = (await report.getByTestId("report-out").textContent()) ?? "";
  check("변경이 보고 창으로 되돌아와 다시 그려진다(간단 요약 = '(진행)' 표기)", briefText.includes("(진행)"));

  // 보고 창이 열린 채로 위젯에서 할 일을 바꾸면 보고 창도 바뀐다
  await widget.getByLabel("할 일", { exact: true }).fill("보고 창에 보여야 할 새 일");
  await widget.getByLabel("할 일", { exact: true }).press("Enter");
  await widget.locator("li.item", { hasText: "보고 창에 보여야 할 새 일" }).locator(".status").click(); // 진행 → 실적에 들어감
  await report.waitForTimeout(600);
  const txt = (await report.getByTestId("report-out").textContent()) ?? "";
  check("위젯의 변경이 열린 보고 창에 반영된다", txt.includes("보고 창에 보여야 할 새 일"));

  // 두 번째로 누르면 새 창이 아니라 기존 창을 앞으로
  await widget.getByRole("button", { name: "보고", exact: true }).click();
  await widget.waitForTimeout(800);
  check("보고 창은 하나만", ctx.pages().length === 2, `pages=${ctx.pages().length}`);
  await widget.screenshot({ path: join(outDir, "desktop-widget.png") });
  await browser.close().catch(() => {});
} finally {
  app.kill();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
if (results.some((r) => !r.ok)) process.exit(1);
