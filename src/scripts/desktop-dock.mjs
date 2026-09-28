/**
 * 도킹 확인 — 실제 exe 로 **작업 영역(SPI_GETWORKAREA)** 을 재서 예약·해제를 확인한다(주 모니터).
 *   node scripts/desktop-dock.mjs <out-dir>
 *
 * ⚠ 도킹은 OS 전역 상태다. 테스트가 중간에 죽어도 예약이 남지 않게 finally 에서 반드시 quit 을 부르고,
 *   그 뒤에도 작업 영역이 원래대로인지 확인한다(Atlas 에서 빈 띠가 남았던 종류의 사고 방지).
 * Screen.WorkingArea 같은 캐시값이 아니라 매번 OS 에 묻는다.
 */
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9348;
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

const PS = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class WA{[StructLayout(LayoutKind.Sequential)]public struct R{public int L,T,Ri,B;}[DllImport("user32.dll")]public static extern bool SystemParametersInfo(int a,int b,ref R r,int c);}'; $r=New-Object WA+R; [void][WA]::SystemParametersInfo(0x30,0,[ref]$r,0); "$($r.L),$($r.T),$($r.Ri),$($r.B)"`;
function workArea() {
  const [l, t, r, b] = execFileSync("powershell", ["-NoProfile", "-Command", PS], { encoding: "utf8" }).trim().split(",").map(Number);
  return { l, t, r, b };
}
const fmt = (a) => `${a.l},${a.t}-${a.r},${a.b}`;
const same = (a, b) => a.l === b.l && a.t === b.t && a.r === b.r && a.b === b.b;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const before = workArea();
const dataDir = mkdtempSync(join(tmpdir(), "todomd-dock-"));
const app = spawn(findExe(), [], {
  env: { ...process.env, TODOMD_DATA_DIR: dataDir, TODOMD_SEED: "sample", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` },
  stdio: "ignore",
});
let exited = false;
app.on("exit", () => { exited = true; });
let page;
try {
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { await sleep(250); }
  }
  if (!browser) throw new Error("CDP 에 붙지 못했다");
  page = browser.contexts()[0].pages()[0];
  await page.waitForSelector('[data-testid="widget"]');
  await sleep(1200);
  const scale = await page.evaluate(() => devicePixelRatio);
  const w = Math.round(360 * scale);
  const geo = () => page.evaluate(() => ({ x: screenX, y: screenY, w: outerWidth, h: outerHeight }));
  const place = (p) => page.evaluate((pl) => window.__TAURI_INTERNALS__.invoke("apply_placement", { placement: pl }), p);

  let a = workArea();
  check("① 기본(오른쪽 도킹): 작업 영역 오른쪽이 폭만큼 줄었다", a.r === before.r - w && a.l === before.l, `${fmt(before)} → ${fmt(a)} (w=${w})`);
  let g = await geo();
  check("   창이 오른쪽 끝·작업 영역 전체 높이", g.x === a.r && g.h === before.b - before.t, JSON.stringify(g));
  await page.screenshot({ path: join(outDir, "dock-right.png") });

  await place({ mode: "dock", edge: "left", monitor: "", width: 360 });
  await sleep(700);
  a = workArea();
  check("② 왼쪽 도킹: 왼쪽이 줄고 오른쪽은 원래대로", a.l === before.l + w && a.r === before.r, fmt(a));
  g = await geo();
  check("   창이 왼쪽 끝", g.x === before.l, JSON.stringify(g));

  await place({ mode: "dock", edge: "right", monitor: "", width: 420 });
  await sleep(700);
  a = workArea();
  check("③ 폭 420: 예약도 420 만큼", a.r === before.r - Math.round(420 * scale), fmt(a));

  // 모니터가 둘 이상이면: 두 번째 모니터에 도킹 → 창이 그 모니터 오른쪽 끝, 주 모니터 작업 영역은 그대로
  const mons = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("list_monitors"));
  const second = mons.find((m) => !m.primary);
  if (second) {
    await place({ mode: "dock", edge: "right", monitor: second.name, width: 360 });
    await sleep(800);
    a = workArea();
    g = await geo();
    const w2 = Math.round(360 * second.scale);
    check("⑦ 두 번째 모니터 도킹: 창이 그 모니터 오른쪽 끝", g.x === second.x + second.width - w2, `${second.name} ${JSON.stringify(g)}`);
    check("   주 모니터 작업 영역은 그대로", same(a, before), fmt(a));
    await page.screenshot({ path: join(outDir, "dock-monitor2.png") });
  } else {
    check("⑦ 두 번째 모니터 도킹 — 모니터가 하나라 건너뜀", true);
  }
  // 없는 모니터(연결 해제) → 주 모니터 같은 쪽
  await place({ mode: "dock", edge: "right", monitor: "\\.\DISPLAY99", width: 360 });
  await sleep(800);
  a = workArea();
  check("⑧ 없는 모니터면 주 모니터 같은 쪽으로", a.r === before.r - w, fmt(a));

  await place({ mode: "float", edge: "right", monitor: "", width: 360 });
  await sleep(700);
  a = workArea();
  check("④ 떠 있기: 예약 없음(작업 영역 원래대로)", same(a, before), fmt(a));
  g = await geo();
  check("   창은 오른쪽 가장자리에서 띄워 놓임", g.x + g.w < before.r && g.x + g.w > before.r - 40, JSON.stringify(g));
  await page.screenshot({ path: join(outDir, "float.png") });

  await place({ mode: "dock", edge: "right", monitor: "", width: 360 });
  await sleep(500);
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("hide_widget"));
  await sleep(700);
  a = workArea();
  check("⑤ 트레이로 숨기면 예약도 풀린다", same(a, before), fmt(a));
  await place({ mode: "dock", edge: "right", monitor: "", width: 360 });
  await sleep(700);
  a = workArea();
  check("   다시 보이면 다시 예약", a.r === before.r - w, fmt(a));

  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
  for (let i = 0; i < 40 && !exited; i++) await sleep(100);
  await sleep(500);
  a = workArea();
  check("⑥ 종료하면 예약이 풀린다(빈 띠 없음)", exited && same(a, before), `exited=${exited} ${fmt(a)}`);
} finally {
  if (!exited) {
    // 도중에 실패했어도 예약을 남기지 않는다 — 앱 스스로 풀게 한 뒤에만 죽인다.
    await page?.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
    await sleep(800);
    if (!exited) app.kill();
  }
}
const after = workArea();
check("끝난 뒤 작업 영역 = 시작 전", same(after, before), `${fmt(before)} / ${fmt(after)}`);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
if (results.some((r) => !r.ok)) process.exit(1);
