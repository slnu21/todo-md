/**
 * 숨김 모드 확인 — 실제 exe 의 **창 사각형(GetWindowRect)** 과 **실제 커서(SetCursorPos)** 로 본다(주 모니터).
 *   node scripts/desktop-peek.mjs <out-dir>
 *
 * ⚠ 커서를 잠깐 옮긴다(끝나면 제자리로). 전체 화면 앱(게임 등)이 앞에 있으면 끄고 돌린다.
 * 데이터·설정은 TODOMD_DATA_DIR 임시 폴더 — 실데이터를 건드리지 않는다.
 *
 * 보는 것: 접힘 = 폭 6px·오른쪽 끝·내용 높이(작업 영역 전체 아님)·화면 예약 없음 / 조각에 머물면 300px 로 펼침 /
 * 벗어나면 접힘 / 가끔 보여주기 카드가 **포커스를 안 가져간다** / 나오는 자리(아래)·왼쪽 / 도킹↔숨김 전환 때 예약 / 종료 뒤 예약 없음.
 */
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

const W32 = `Add-Type -TypeDefinition 'using System;using System.Text;using System.Runtime.InteropServices;public class W{[StructLayout(LayoutKind.Sequential)]public struct R{public int L,T,Ri,B;}[StructLayout(LayoutKind.Sequential)]public struct P{public int X,Y;}public delegate bool EP(IntPtr h,IntPtr l);[DllImport("user32.dll")]public static extern bool EnumWindows(EP f,IntPtr l);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out R r);[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool GetCursorPos(out P p);[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")]public static extern bool SystemParametersInfo(int a,int b,ref R r,int c);}';`;
const ps = (body) => execFileSync("powershell", ["-NoProfile", "-Command", W32 + body], { encoding: "utf8" }).trim();

function workArea() {
  const [l, t, r, b] = ps(`$r=New-Object W+R; [void][W]::SystemParametersInfo(0x30,0,[ref]$r,0); "$($r.L),$($r.T),$($r.Ri),$($r.B)"`).split(",").map(Number);
  return { l, t, r, b };
}
/** 이 프로세스의 보이는 'TODO.md' 창(위젯) 사각형, 물리 px. */
function widgetRect(pid) {
  const out = ps(`$o=@(); [W]::EnumWindows({param($h,$l) $p=0; [void][W]::GetWindowThreadProcessId($h,[ref]$p); if($p -eq ${pid} -and [W]::IsWindowVisible($h)){ $s=New-Object Text.StringBuilder 64; [void][W]::GetWindowText($h,$s,64); if($s.ToString() -eq 'TODO.md'){ $r=New-Object W+R; [void][W]::GetWindowRect($h,[ref]$r); $script:o+="$($r.L),$($r.T),$($r.Ri),$($r.B)" } }; $true }, [IntPtr]::Zero) | Out-Null; $o -join ';'`);
  const first = out.split(";").filter(Boolean)[0];
  if (!first) return null;
  const [l, t, r, b] = first.split(",").map(Number);
  return { l, t, r, b, w: r - l, h: b - t };
}
const foregroundPid = () => Number(ps(`$p=0; [void][W]::GetWindowThreadProcessId([W]::GetForegroundWindow(),[ref]$p); $p`));
const cursor = () => ps(`$p=New-Object W+P; [void][W]::GetCursorPos([ref]$p); "$($p.X),$($p.Y)"`).split(",").map(Number);
const moveCursor = (x, y) => ps(`[void][W]::SetCursorPos(${x},${y})`);

const fmt = (a) => (a ? `${a.l},${a.t}-${a.r},${a.b}` : "없음");
const same = (a, b) => a.l === b.l && a.t === b.t && a.r === b.r && a.b === b.b;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const before = workArea();
const cursorStart = cursor();
const dataDir = mkdtempSync(join(tmpdir(), "todomd-peek-"));
// 가끔 보여주기 30분 — 켜자마자 한 번(1.5초 뒤) 카드가 나온다. 그 카드로 '포커스 안 뺏음'을 본다.
writeFileSync(join(dataDir, "settings.json"), JSON.stringify({ dock: { mode: "peek", edge: "right", monitor: "", width: 360 }, peek: { vpos: "top", every: 30, showSec: 6 } }));
// 커서를 화면 가운데에 두고 시작(우연히 가장자리에 있으면 바로 펼쳐진다)
moveCursor(Math.round((before.l + before.r) / 2), Math.round((before.t + before.b) / 2));
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
  await page.waitForSelector('[data-testid="peek"]', { state: "attached" });
  const scale = await page.evaluate(() => devicePixelRatio);
  const stateOf = () => page.getByTestId("peek").getAttribute("data-state");
  const place = (p) => page.evaluate((pl) => window.__TAURI_INTERNALS__.invoke("apply_placement", { placement: pl }), p);
  const gap = Math.round(12 * scale);

  // ① 카드: 켜고 1.5초 뒤 — 포커스를 가져가지 않아야 한다. 카드를 띄우기 전 전경 창을 기억해 비교한다.
  const fgBefore = foregroundPid();
  let card = null;
  for (let i = 0; i < 30 && !card; i++) {
    await sleep(150);
    if ((await stateOf()) === "card") card = widgetRect(app.pid);
  }
  check("① 켜면 한 번 요약 카드가 나온다", !!card, fmt(card));
  if (card) {
    await page.screenshot({ path: join(outDir, "peek-card.png") });
    check("   카드는 오른쪽 끝·폭 300", card.r === before.r && card.w === Math.round(300 * scale), fmt(card));
    const fg = foregroundPid();
    check("   카드가 포커스를 가져가지 않는다", fg !== app.pid, `전경 pid ${fgBefore} → ${fg}, 앱 ${app.pid}`);
  }
  for (let i = 0; i < 60 && (await stateOf()) !== "collapsed"; i++) await sleep(200);
  await sleep(300);

  // ② 접힘
  let r = widgetRect(app.pid);
  check("② 접힘: 폭 6px 조각이 오른쪽 끝에", !!r && r.w === Math.round(6 * scale) && r.r === before.r, fmt(r));
  check("   높이는 내용만큼(작업 영역 전체가 아니다)·위 여백 12", !!r && r.h < before.b - before.t - 2 * gap && r.t === before.t + gap, fmt(r));
  check("   화면 예약 없음(작업 영역 그대로)", same(workArea(), before), fmt(workArea()));
  const sliverH = r?.h ?? 0;

  // ③ 조각에 커서 → 펼침
  moveCursor(before.r - 2, (r?.t ?? 100) + 40);
  await sleep(900);
  r = widgetRect(app.pid);
  check("③ 조각에 머물면 펼친다: 폭 300·같은 높이", (await stateOf()) === "open" && !!r && r.w === Math.round(300 * scale) && r.r === before.r && Math.abs(r.h - sliverH) <= 2, fmt(r));
  await page.screenshot({ path: join(outDir, "peek-open.png") });
  // 펼친 채 설정을 열면 창이 작업 영역 높이까지 커진다(팝오버가 잘리지 않게)
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await sleep(600);
  r = widgetRect(app.pid);
  check("   설정을 열면 작업 영역 높이까지 커진다", !!r && r.t === before.t + gap && r.b === before.b - gap, fmt(r));
  await page.screenshot({ path: join(outDir, "peek-settings.png") });
  await page.keyboard.press("Escape");
  await sleep(500);
  r = widgetRect(app.pid);
  check("   닫으면 내용 높이로 돌아온다", !!r && Math.abs(r.h - sliverH) <= 2, fmt(r));

  // ④ 벗어나면 접힘
  moveCursor(Math.round((before.l + before.r) / 2), Math.round((before.t + before.b) / 2));
  await sleep(1300);
  r = widgetRect(app.pid);
  check("④ 커서가 나가면 접힌다", (await stateOf()) === "collapsed" && !!r && r.w === Math.round(6 * scale), fmt(r));

  // ⑤ 조각 아래(작업 영역 끝 근처)는 반응하지 않는다 — 위젯 높이 밖
  if (r && r.b + 40 < before.b) {
    moveCursor(before.r - 2, before.b - 10);
    await sleep(900);
    check("⑤ 조각 높이 밖(작업 표시줄 근처)에선 안 펼친다", (await stateOf()) === "collapsed");
    moveCursor(Math.round((before.l + before.r) / 2), Math.round((before.t + before.b) / 2));
  } else {
    check("⑤ 조각이 작업 영역 끝까지라 건너뜀", true);
  }

  // ⑥ 나오는 자리 = 아래
  await place({ mode: "peek", edge: "right", monitor: "", width: 360, vpos: "bottom" });
  await sleep(600);
  r = widgetRect(app.pid);
  check("⑥ 아래: 작업 영역 아래 여백 12에 붙는다", !!r && r.b === before.b - gap && r.r === before.r, fmt(r));

  // ⑦ 왼쪽 — 사용자처럼 **설정 화면에서** 바꾼다(place 로 Rust 만 옮기면 화면은 여전히 오른쪽 배치라 반대로 미끄러진다)
  await place({ mode: "peek", edge: "right", monitor: "", width: 360, vpos: "top" });
  await sleep(500);
  r = widgetRect(app.pid);
  moveCursor(before.r - 2, (r?.t ?? 100) + 40);
  await sleep(900);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByRole("button", { name: "주 모니터 왼쪽" }).click();
  await sleep(500);
  await page.keyboard.press("Escape"); // 설정 닫기 — 커서는 오른쪽 끝(이제 위젯 밖)이라 곧 접힌다
  // 접히는 동안 패널이 어느 쪽으로 빠지는지 연속으로 본다(오른쪽으로 빠지면 양수)
  const xs = [];
  for (let i = 0; i < 120 && (await stateOf()) !== "collapsed"; i++) {
    xs.push(await page.locator(".peek-panel").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41));
    await sleep(10);
  }
  const moving = xs.filter((x) => x !== 0);
  check("⑦ 왼쪽(설정에서): 접힐 때 왼쪽으로 빠진다", moving.length > 0 && moving.every((x) => x < 0), `중간 값 ${moving.slice(0, 6).map(Math.round).join(",")}`);
  await sleep(400);
  r = widgetRect(app.pid);
  check("   왼쪽 끝 조각", !!r && r.l === before.l && r.w === Math.round(6 * scale), fmt(r));
  moveCursor(before.l + 1, (r?.t ?? 100) + 40);
  await sleep(900);
  r = widgetRect(app.pid);
  check("   왼쪽 조각에 머물면 오른쪽으로 펼친다", !!r && r.l === before.l && r.w === Math.round(300 * scale), fmt(r));
  moveCursor(Math.round((before.l + before.r) / 2), Math.round((before.t + before.b) / 2));
  await sleep(1300);

  // ⑧ 도킹 ↔ 숨김
  await place({ mode: "dock", edge: "right", monitor: "", width: 360, vpos: "top" });
  await sleep(700);
  check("⑧ 도킹으로 바꾸면 예약한다", workArea().r === before.r - Math.round(360 * scale), fmt(workArea()));
  await place({ mode: "peek", edge: "right", monitor: "", width: 360, vpos: "top" });
  await sleep(700);
  check("   다시 숨김이면 예약을 푼다", same(workArea(), before), fmt(workArea()));

  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
  for (let i = 0; i < 40 && !exited; i++) await sleep(100);
  await sleep(400);
  check("⑨ 종료하면 끝(예약 없음)", exited && same(workArea(), before), `exited=${exited} ${fmt(workArea())}`);
} finally {
  if (!exited) {
    await page?.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
    await sleep(800);
    if (!exited) app.kill();
  }
  moveCursor(...cursorStart);
}
check("끝난 뒤 작업 영역 = 시작 전", same(workArea(), before), `${fmt(before)} / ${fmt(workArea())}`);
for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.detail ? "  — " + x.detail : ""}`);
if (results.some((x) => !x.ok)) process.exit(1);
