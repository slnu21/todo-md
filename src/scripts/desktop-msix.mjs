/**
 * Store(MSIX) 설치판 확인 — 패키지로 돌 때만 달라지는 것들.
 *   powershell -File ..\packaging\pack-msix.ps1 -Register   # 먼저(개발자 모드, 서명·관리자 불필요)
 *   node scripts/desktop-msix.mjs
 *   powershell -File ..\packaging\pack-msix.ps1 -Unregister # 끝나면
 *
 * 확인: 패키지 인식 · %APPDATA% 쓰기가 패키지 전용 자리로 가고 진짜 %APPDATA% 에는 안 생김 · 설정의 데이터 폴더가
 * 그 실제 자리 · 자동 실행 체크 숨김 · 도킹 · 두 번째 실행은 끝나고 하나만 · 종료하면 도킹이 풀림.
 *
 * ⚠ 패키지 앱은 우리 환경 변수를 물려받지 않는다. 디버그 포트(WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS)는
 * **사용자 환경 변수에 몇 초만** 넣고 띄운 뒤 원래 값으로 되돌린다(finally). 관리자 없이 되는 길이 이것뿐이었다
 * (HKCU\Software\Policies 의 WebView2 정책 키는 관리자 전용).
 * ⚠ 진짜 %APPDATA%\com.slnu21.todo-md 가 이미 있으면(포터블판 사용자) 멈춘다 — 실데이터를 건드리지 않게.
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PORT = 9357;
const IDENTITY = process.env.TODOMD_MSIX_IDENTITY ?? "SlnU.TODO.md";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (cmd) => execFileSync("powershell", ["-NoProfile", "-Command", cmd], { encoding: "utf8" }).trim();
const count = () => Number(ps("(Get-Process todo-md -ErrorAction SilentlyContinue | Measure-Object).Count"));
const workRight = () =>
  Number(ps(`Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class WAx{[StructLayout(LayoutKind.Sequential)]public struct R{public int L,T,Ri,B;}[DllImport("user32.dll")]public static extern bool SystemParametersInfo(int a,int b,ref R r,int c);}'; $r=New-Object WAx+R; [void][WAx]::SystemParametersInfo(0x30,0,[ref]$r,0); $r.Ri`));
const screenW = () => Number(ps("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width"));

const pkg = JSON.parse(ps(`Get-AppxPackage ${IDENTITY} | Select-Object PackageFamilyName, InstallLocation | ConvertTo-Json`) || "null");
if (!pkg) { console.log(`SKIP  ${IDENTITY} 가 등록돼 있지 않다 → pack-msix.ps1 -Register`); process.exit(2); }
if (count() > 0) { console.log("SKIP  todo-md 가 이미 떠 있다 — 끄고 다시"); process.exit(2); }
const realDir = join(process.env.APPDATA, "com.slnu21.todo-md");
if (existsSync(realDir)) { console.log(`SKIP  진짜 ${realDir} 가 있다(포터블판 데이터) — 건드리지 않으려고 멈춘다`); process.exit(2); }
const privDir = join(process.env.LOCALAPPDATA, "Packages", pkg.PackageFamilyName, "LocalCache", "Roaming", "com.slnu21.todo-md");

function launch(withPort) {
  const set = withPort
    ? `$b=[Environment]::GetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','User'); [Environment]::SetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','--remote-debugging-port=${PORT}','User'); try {`
    : "try {";
  const reset = withPort ? "} finally { [Environment]::SetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS',$b,'User') }" : "} finally {}";
  ps(`${set} Invoke-CommandInDesktopPackage -PackageFamilyName '${pkg.PackageFamilyName}' -AppId TodoMd -Command '${join(pkg.InstallLocation, "todo-md.exe")}'; Start-Sleep -Seconds 3 ${reset}`);
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
let browser;
try {
  launch(true);
  check("사용자 환경 변수를 되돌렸다", ps("[Environment]::GetEnvironmentVariable('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','User')") === "");
  for (let i = 0; i < 40 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch { await sleep(250); }
  }
  if (!browser) throw new Error("CDP 에 붙지 못했다");
  const page = browser.contexts()[0].pages()[0];
  await page.waitForSelector('[data-testid="widget"]');
  await sleep(800);
  const invoke = (cmd, args) => page.evaluate(([c, a]) => window.__TAURI_INTERNALS__.invoke(c, a), [cmd, args]);

  check("패키지로 도는 것을 안다", (await invoke("is_packaged")) === true);
  check("도킹 — 작업 영역 오른쪽이 줄었다", workRight() < screenW(), `right=${workRight()}`);

  // 할 일 하나 → 저장(0.5초 모음) → 가상화된 자리에만 생겨야 한다.
  await page.getByPlaceholder(/할 일을 적고|Type a to-do/).fill("MSIX 저장 확인");
  await page.keyboard.press("Enter");
  await sleep(1500);
  const privTodo = join(privDir, "todo.json");
  check("쓰기가 패키지 전용 자리(LocalCache\\Roaming)로 간다", existsSync(privTodo) && readFileSync(privTodo, "utf8").includes("MSIX 저장 확인"), privTodo);
  check("진짜 %APPDATA% 에는 폴더가 생기지 않는다", !existsSync(realDir));
  const shown = await invoke("get_data_dir");
  check("설정에 보이는 데이터 폴더 = 실제 자리", shown.toLowerCase() === privDir.toLowerCase(), shown);

  await page.getByRole("button", { name: /설정|Settings/ }).click();
  await sleep(500);
  check("설정: 자동 실행 체크가 없다(포터블 전용)", (await page.getByText(/로그인 시 자동 실행|Launch at sign-in/).count()) === 0);
  check("설정: 데이터 폴더 글자도 실제 자리", ((await page.locator(".pop .path").textContent()) ?? "").toLowerCase() === privDir.toLowerCase());
  await page.getByRole("button", { name: /설정|Settings/ }).click();

  launch(false); // 두 번째 실행
  await sleep(1500);
  check("두 번째 실행은 끝나고 하나만 남는다", count() === 1, `n=${count()}`);

  void invoke("quit_app").catch(() => {});
  let gone = false;
  for (let i = 0; i < 20 && !gone; i++) { await sleep(250); gone = count() === 0; }
  check("종료하면 프로세스가 끝난다", gone);
  check("종료하면 도킹이 풀린다", workRight() === screenW(), `right=${workRight()}`);
} finally {
  await browser?.close().catch(() => {});
  if (count() > 0) ps("Get-Process todo-md -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }");
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  — " + r.detail : ""}`);
console.log(`(패키지 데이터: ${privDir} — 패키지를 지우면 함께 지워진다)`);
if (results.some((r) => !r.ok)) process.exit(1);
