/**
 * 고배율 확인(실제 exe) — 모니터 배율을 **잠깐 바꿔** 위젯·상세·보고 창의 실제 크기·위치를 Win32 로 잰다.
 *   node scripts/desktop-dpi.mjs <out-dir> [--monitor primary|DISPLAY1] [--scale 150]
 *
 * - 기본은 **주 모니터가 아닌** 모니터(있으면)에 위젯을 도킹한다 → 주 모니터(그대로 100%)와 배율이 다른 '섞인 배율'.
 *   상세 창은 주 모니터에서 만들어진 뒤 위젯 옆으로 옮겨지므로 이 경우가 가장 위험하다.
 * - 실행 중 배율을 원래대로 되돌려(WM_DPICHANGED) 위젯이 다시 맞춰지는지도 본다.
 * - ⚠ 배율은 Windows 설정 값이라 OS 전역이다. finally 에서 반드시 원래 값으로 되돌린다(scripts/dpi-scale.ps1).
 *   그 모니터의 다른 창들이 잠깐 다시 배치된다.
 */
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CDP_PORT = 9353;
const args = process.argv.slice(2);
const outDir = args[0] ?? ".";
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const target = Number(opt("--scale") ?? 150);
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

const dpiPs = (...a) => execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(HERE, "dpi-scale.ps1"), ...a], { encoding: "utf8" });
const scales = () => Object.fromEntries(dpiPs("list").trim().split(/\r?\n/).map((l) => { const [n, p] = l.trim().split(" "); return [n, Number(p)]; }));

/** pid 의 보이는 최상위 창들(물리 px) + 그 창이 놓인 모니터의 작업 영역.
 * 재는 쪽(PowerShell)이 DPI 를 모르면 Windows 가 좌표를 배율로 나눠 준다 → 스레드를 모니터별 DPI 인식(-4)으로. */
function windowsOf(pid) {
  const ps = `Add-Type -TypeDefinition 'using System;using System.Text;using System.Runtime.InteropServices;using System.Collections.Generic;
public class EW{[StructLayout(LayoutKind.Sequential)]public struct R{public int L,T,Ri,B;}
[StructLayout(LayoutKind.Sequential)]public struct MI{public int cb;public R m;public R w;public int f;}
public delegate bool P(IntPtr h,IntPtr l);
[DllImport("user32.dll")]static extern bool EnumWindows(P p,IntPtr l);
[DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
[DllImport("user32.dll")]static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out R r);
[DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern int GetWindowText(IntPtr h,StringBuilder s,int n);
[DllImport("user32.dll")]static extern IntPtr MonitorFromWindow(IntPtr h,int f);
[DllImport("user32.dll")]static extern bool GetMonitorInfo(IntPtr m,ref MI i);
[DllImport("user32.dll")]static extern uint GetDpiForWindow(IntPtr h);
[DllImport("user32.dll")]static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
public static List<string> Of(uint pid){SetThreadDpiAwarenessContext(new IntPtr(-4));var o=new List<string>();EnumWindows((h,l)=>{uint p;GetWindowThreadProcessId(h,out p);if(p==pid&&IsWindowVisible(h)){R r;GetWindowRect(h,out r);var s=new StringBuilder(256);GetWindowText(h,s,256);var mi=new MI();mi.cb=Marshal.SizeOf(typeof(MI));GetMonitorInfo(MonitorFromWindow(h,2),ref mi);
o.Add(s+"|"+r.L+","+r.T+","+r.Ri+","+r.B+"|"+mi.w.L+","+mi.w.T+","+mi.w.Ri+","+mi.w.B+"|"+GetDpiForWindow(h));}return true;},IntPtr.Zero);return o;}}'; [EW]::Of(${pid})`;
  return execFileSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [title, r, w, dpi] = line.split("|");
    const [l, t, ri, b] = r.split(",").map(Number);
    const [wl, wt, wr, wb] = w.split(",").map(Number);
    return { title, l, t, r: ri, b, w: ri - l, h: b - t, work: { l: wl, t: wt, r: wr, b: wb }, dpi: Number(dpi) };
  });
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });

const original = scales();
const names = Object.keys(original);
const primary = execFileSync("powershell", ["-NoProfile", "-Command", "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.DeviceName"], { encoding: "utf8" }).trim();
// --monitor primary | DISPLAY2 처럼 끝 이름만(Git Bash 등이 `\\.\` 앞부분을 먹는 일이 있어 이름 끝으로 찾는다)
const want = opt("--monitor");
const monitor = want === "primary" ? primary : want ? names.find((n) => n.toUpperCase().endsWith(want.toUpperCase().replace(/^[\\.]+/, ""))) : names.find((n) => n !== primary) ?? names[0];
if (!monitor) throw new Error(`모니터 없음: ${want} (있는 것: ${names.join(", ")})`);
console.log("[dpi] 원래 배율:", JSON.stringify(original), "→", monitor, target + "%");

let app;
let widget;
try {
  dpiPs("set", monitor, String(target));
  await sleep(2000);
  check(`배율을 ${target}% 로 바꿨다`, scales()[monitor] === target, JSON.stringify(scales()));

  const dataDir = mkdtempSync(join(tmpdir(), "todomd-dpi-"));
  writeFileSync(join(dataDir, "settings.json"), JSON.stringify({ closeAction: "quit", dock: { mode: "dock", edge: "right", monitor, width: 360 } }));
  app = spawn(findExe(), [], {
    env: { ...process.env, TODOMD_DATA_DIR: dataDir, TODOMD_SEED: "sample", WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${CDP_PORT}` },
    stdio: "ignore",
  });
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch { await sleep(250); }
  }
  if (!browser) throw new Error("CDP 에 붙지 못했다");
  const ctx = browser.contexts()[0];
  widget = ctx.pages()[0];
  await widget.waitForSelector('[data-testid="widget"]');
  await sleep(1500);

  const s = target / 100;
  const mons = await widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("list_monitors"));
  const mon = mons.find((m) => m.name === monitor);
  check("Rust 가 본 모니터 배율", Math.abs(mon.scale - s) < 0.01, JSON.stringify(mon));

  const findWidget = () => windowsOf(app.pid).find((w) => w.title === "TODO.md" && w.h > 600 * s);
  let wg = findWidget();
  check("위젯: 페이지 배율 = 모니터 배율, 논리 폭 360", (await widget.evaluate(() => devicePixelRatio)) === s && (await widget.evaluate(() => innerWidth)) === 360,
    `dpr=${await widget.evaluate(() => devicePixelRatio)} innerWidth=${await widget.evaluate(() => innerWidth)}`);
  check(`위젯: 물리 폭 = 360×${s}, 그 모니터 오른쪽 끝·작업 영역 전체 높이`,
    wg && wg.w === Math.round(360 * s) && wg.r === mon.x + mon.width && wg.t === wg.work.t && wg.b === wg.work.b && wg.dpi === target * 0.96,
    JSON.stringify(wg));
  check("위젯: 작업 영역이 위젯 폭만큼 줄었다(도킹 예약)", wg && wg.work.r === wg.l, JSON.stringify(wg?.work));
  await widget.screenshot({ path: join(outDir, `dpi-${target}-widget.png`) });

  // 상세 창 — 주 모니터(배율 다름)에서 만들어져 위젯 옆으로 옮겨진다.
  const row = widget.locator("li.item").first();
  const rowTop = await row.evaluate((el) => el.getBoundingClientRect().top);
  const pp = ctx.waitForEvent("page", { timeout: 10_000 });
  await row.locator(".title-btn").click();
  const detail = await pp;
  await detail.waitForSelector('[data-testid="detail"]');
  await sleep(900);
  const dt = windowsOf(app.pid).find((w) => w.title === "TODO.md" && w !== undefined && w.l < wg.l && w.h <= 660 * s);
  const ddpr = await detail.evaluate(() => devicePixelRatio);
  const diw = await detail.evaluate(() => innerWidth);
  check("상세: 페이지 배율 = 모니터 배율, 논리 폭 360", ddpr === s && diw === 360, `dpr=${ddpr} innerWidth=${diw}`);
  check(`상세: 물리 폭 360×${s}, 위젯 바로 왼쪽(간격 6×${s})·같은 모니터`,
    dt && dt.w === Math.round(360 * s) && wg.l - dt.r === Math.round(6 * s) && dt.l >= mon.x && dt.dpi === target * 0.96, JSON.stringify(dt));
  check("상세: 누른 줄 높이 근처(또는 화면 아래에 붙음)", dt && (Math.abs(dt.t - (wg.t + rowTop * s)) < 40 * s || dt.b === wg.work.b), `rowTop=${rowTop} detail.t=${dt?.t}`);
  await detail.screenshot({ path: join(outDir, `dpi-${target}-detail.png`) });
  await detail.keyboard.press("Escape");
  await sleep(400);

  // 보고 창
  const rp = ctx.waitForEvent("page", { timeout: 10_000 });
  await widget.locator(".w-bar button").nth(1).click();
  const report = await rp;
  await report.waitForSelector('[data-testid="report-out"]');
  await sleep(900);
  const rw = windowsOf(app.pid).find((w) => w.title !== "TODO.md" && w.w > 600); // 제목의 '—' 는 콘솔 인코딩에 깨질 수 있어 크기로
  const rdpr = await report.evaluate(() => devicePixelRatio);
  const inner = await report.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  // 기본 940×760(논리). 작업 영역이 작으면(1080p·150% = 논리 920×672) 그 안에 들어가게 줄어든다.
  check("보고: 페이지 배율 = 그 모니터 배율, 논리 크기 = 940×760 또는 작업 영역에 맞춰 줄인 값", rw && Math.abs(rw.dpi / 96 - rdpr) < 0.01 && inner.w >= 420 && inner.w <= 942 && inner.h >= 480 && inner.h <= 762,
    `dpr=${rdpr} inner=${inner.w}x${inner.h} win=${JSON.stringify(rw)}`);
  check("보고: 위젯과 같은 모니터의 작업 영역 안, 가운데", rw && rw.l >= rw.work.l && rw.r <= rw.work.r && rw.t >= rw.work.t && rw.b <= rw.work.b
    && Math.abs((rw.l + rw.r) / 2 - (rw.work.l + rw.work.r) / 2) <= 2, JSON.stringify(rw));
  await report.screenshot({ path: join(outDir, `dpi-${target}-report.png`) });
  await report.close().catch(() => {});

  // 실행 중 배율 복귀 → WM_DPICHANGED → 위젯이 다시 맞춰진다
  dpiPs("set", monitor, String(original[monitor]));
  await sleep(2500);
  const s0 = original[monitor] / 100;
  wg = windowsOf(app.pid).find((w) => w.title === "TODO.md" && w.h > 600 * s0);
  check(`실행 중 배율 ${original[monitor]}% 로 복귀: 위젯 물리 폭 360×${s0}·오른쪽 끝·전체 높이`,
    wg && wg.w === Math.round(360 * s0) && wg.r === mon.x + mon.width && wg.t === wg.work.t && wg.b === wg.work.b && wg.work.r === wg.l, JSON.stringify(wg));
  check("   페이지 배율도 따라온다", (await widget.evaluate(() => devicePixelRatio)) === s0);
  await widget.screenshot({ path: join(outDir, `dpi-back-widget.png`) });
  const pp2 = row.locator(".title-btn").click();
  await pp2;
  await sleep(900);
  const dt2 = windowsOf(app.pid).find((w) => w.title === "TODO.md" && w.l < wg.l && w.h <= 660 * s0);
  check("   복귀 뒤 상세 창 물리 폭·간격", dt2 && dt2.w === Math.round(360 * s0) && wg.l - dt2.r === Math.round(6 * s0), JSON.stringify(dt2));
  await detail.screenshot({ path: join(outDir, `dpi-back-detail.png`) });
} catch (e) {
  check("중단 없이 끝까지", false, String(e?.stack ?? e).split("\n").slice(0, 3).join(" / "));
} finally {
  if (widget) await widget.evaluate(() => window.__TAURI_INTERNALS__.invoke("quit_app")).catch(() => {});
  await sleep(800);
  app?.kill();
  const now = scales();
  if (now[monitor] !== original[monitor]) dpiPs("set", monitor, String(original[monitor]));
  const after = scales();
  check("배율이 원래대로", JSON.stringify(after) === JSON.stringify(original), JSON.stringify(after));
}

let fail = 0;
for (const r of results) { if (!r.ok) fail++; console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`); }
process.exit(fail ? 1 : 0);
