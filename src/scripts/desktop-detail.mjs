/**
 * 상세 창 확인(실제 exe) — 위젯 옆 별도 창, 누른 줄 높이, 메모가 위젯으로 건너가는지, Esc·바깥 클릭으로 숨는지.
 *   node scripts/desktop-detail.mjs <out-dir>
 */
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9349;
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

/**
 * 실제 OS 클릭 — CDP 의 가짜 클릭은 창 활성화를 바꾸지 못해 '바깥 클릭' 을 흉내 낼 수 없다.
 * 항상 위에 떠 있는 위젯의 제목 글자를 누르고(다른 창을 잘못 누를 일이 없는 자리) 커서를 원래 자리로 돌려놓는다.
 */
function osClick(x, y) {
  const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class M{[StructLayout(LayoutKind.Sequential)]public struct P{public int X,Y;}[DllImport("user32.dll")]public static extern bool GetCursorPos(out P p);[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")]public static extern void mouse_event(int f,int x,int y,int d,int e);}'; $p=New-Object M+P; [void][M]::GetCursorPos([ref]$p); [void][M]::SetCursorPos(${x},${y}); [M]::mouse_event(2,0,0,0,0); [M]::mouse_event(4,0,0,0,0); Start-Sleep -Milliseconds 80; [void][M]::SetCursorPos($p.X,$p.Y)`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps]);
}

/** 지금 OS 전경 창의 사각형(디버그: 상세 창이 실제로 활성화됐는지). */
function foregroundRect() {
  const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class F{[StructLayout(LayoutKind.Sequential)]public struct R{public int L,T,Ri,B;}[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out R r);}'; $r=New-Object F+R; [void][F]::GetWindowRect([F]::GetForegroundWindow(),[ref]$r); "$($r.L),$($r.T),$($r.Ri),$($r.B)"`;
  return execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).trim();
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const dataDir = mkdtempSync(join(tmpdir(), "todomd-detail-"));
const app = spawn(findExe(), [], {
  env: { ...process.env, TODOMD_DATA_DIR: dataDir, TODOMD_SEED: "sample", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` },
  stdio: "ignore",
});
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
  await sleep(1000);
  const visible = (label) => widget.evaluate((l) => window.__TAURI_INTERNALS__.invoke("is_window_visible", { label: l }), label);

  const row = widget.locator("li.item", { hasText: "업데이트 확인 저장소" });
  const rowTop = await row.evaluate((el) => el.getBoundingClientRect().top);
  const pagePromise = ctx.waitForEvent("page", { timeout: 10_000 });
  await row.getByRole("button", { name: /업데이트 확인 저장소/ }).click();
  const detail = await pagePromise;
  await detail.waitForSelector('[data-testid="detail"]', { timeout: 10_000 });
  await sleep(500);
  check("상세 창이 뜨고 누른 할 일을 보인다", (await detail.locator("#pp-title").inputValue()).includes("업데이트 확인 저장소"));
  check("상세 창이 보인다", await visible("detail"));

  const wg = await widget.evaluate(() => ({ x: screenX, y: screenY, w: outerWidth }));
  const dg = await detail.evaluate(() => ({ x: screenX, y: screenY, w: outerWidth, h: outerHeight }));
  check("상세 창 폭 = 360(배율 1 기준, 보이지 않는 테두리 없음)", dg.w === Math.round(360 * (await widget.evaluate(() => devicePixelRatio))), `w=${dg.w}`);
  check("위젯 안쪽 옆에 붙는다(오른쪽 도킹이면 왼쪽, 겹치지 않고 20px 안)", dg.x + dg.w <= wg.x && wg.x - (dg.x + dg.w) < 20, `widget=${JSON.stringify(wg)} detail=${JSON.stringify(dg)}`);
  check("누른 줄 높이 근처에 뜬다", Math.abs(dg.y - (wg.y + rowTop)) < 40 || dg.y + dg.h >= 1000, `rowTop=${rowTop} detailY=${dg.y}`);
  await detail.screenshot({ path: join(outDir, "detail-window.png") });

  const memo = detail.getByLabel("메모", { exact: true });
  await memo.fill("상세 창에서 남긴 메모");
  await memo.press("Enter");
  await sleep(600);
  check("상세 창 메모가 위젯 목록의 마지막 메모로 보인다", (await row.locator(".lastmemo").textContent())?.includes("상세 창에서 남긴 메모") ?? false);

  await detail.keyboard.press("Escape");
  await sleep(500);
  check("Esc 로 숨는다", !(await visible("detail")));

  // 다시 열고 위젯을 누르면(바깥 클릭) 숨는다. 여는 것도 **실제 OS 클릭**으로 — CDP 클릭으로 열면 앱이 OS 의
  // 앞쪽 프로세스가 아니라서 set_focus 가 거절되고, 활성화된 적 없는 창은 '비활성화'도 되지 않는다.
  const wpos = await widget.evaluate(() => ({ x: screenX, y: screenY, dpr: devicePixelRatio }));
  const toScreen = (p) => [Math.round(wpos.x + p.x * wpos.dpr), Math.round(wpos.y + p.y * wpos.dpr)];
  const t = await row.locator(".title-btn .t").evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + 12, y: r.top + r.height / 2 }; });
  osClick(...toScreen(t));
  await sleep(900);
  console.log("[dbg] 다시 연 뒤 전경 창:", foregroundRect());
  check("다시 누르면 같은 창이 다시 뜬다(창은 하나)", (await visible("detail")) && ctx.pages().length === 2, `pages=${ctx.pages().length}`);
  const name = await widget.locator(".w-bar .name").evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
  osClick(...toScreen(name));
  await sleep(700);
  console.log("[dbg] 바깥 클릭 뒤 전경 창:", foregroundRect());
  check("바깥(위젯)을 누르면 숨는다 — 실제 OS 클릭", !(await visible("detail")));
  await browser.close().catch(() => {});
} finally {
  await widget?.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
  await sleep(800);
  app.kill();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
if (results.some((r) => !r.ok)) process.exit(1);
