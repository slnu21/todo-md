//! TODO.md 데스크톱 셸.
//!
//! **할 일 로직은 한 줄도 두지 않는다.** 파일 읽기·쓰기와 창(위치·도킹·트레이)만 담당한다.
//! 로직이 Rust 에 들어가면 브라우저 모드가 반쪽이 되고 테스트가 두 벌 필요해진다.

use std::fs;
use std::path::{Path, PathBuf};

mod appbar;
mod package;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// 백업 세대 수. 단일 파일 포맷의 약점이 덮어쓰기 사고라 여기만 방어한다.
const BACKUP_GENERATIONS: usize = 3;

fn io_err(what: &str, path: &Path, e: std::io::Error) -> String {
    format!("{} {}: {}", path.display(), what, e)
}

/// `TODOMD_DATA_DIR` 로 따로 준 데이터 폴더(검증 스크립트·스크린샷). 없거나 비었으면 `None`.
fn env_data_dir() -> Option<PathBuf> {
    std::env::var("TODOMD_DATA_DIR").ok().filter(|d| !d.trim().is_empty()).map(PathBuf::from)
}

/// 데이터 폴더. `TODOMD_DATA_DIR` 이 있으면 그것 — e2e·스크린샷이 **사용자 실데이터를 건드리지 않게**.
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(d) = env_data_dir() {
        return Ok(d);
    }
    app.path()
        .app_data_dir()
        .map_err(|e| format!("앱 데이터 폴더를 찾지 못했다: {e}"))
}

/// `todo.json`·`settings.json`·`archive/2026.json` 처럼 **데이터 폴더 안의 이름만** 받는다.
/// 한 단계 하위 폴더(`archive/`)까지. `..`·절대 경로·숨김 파일은 거절한다.
fn data_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let parts: Vec<&str> = name.split('/').collect();
    let ok_part = |p: &str| {
        !p.is_empty()
            && p.len() <= 64
            && !p.starts_with('.')
            && p.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
    };
    let ok = !parts.is_empty()
        && parts.len() <= 2
        && parts.iter().all(|p| ok_part(p))
        && (parts.len() == 1 || parts[0] == "archive");
    if !ok {
        return Err(format!("데이터 파일 이름이 잘못됐다: {name}"));
    }
    let mut p = data_dir(app)?;
    for part in parts {
        p.push(part);
    }
    Ok(p)
}

/// 화면에 보여 줄 데이터 폴더(설정). Store 설치판이면 Windows 가 돌려 놓은 실제 자리(package.rs).
#[tauri::command]
fn get_data_dir(app: AppHandle) -> Result<String, String> {
    Ok(package::on_disk(data_dir(&app)?).to_string_lossy().into_owned())
}

/// Store(MSIX) 설치판인가 — 화면이 포터블 전용 기능(로그인 시 자동 실행 = HKCU Run)을 숨긴다.
#[tauri::command]
fn is_packaged() -> bool {
    package::family_name().is_some()
}

/// 없는 파일은 `None` — 첫 실행.
#[tauri::command]
fn read_data_file(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let p = data_path(&app, &name)?;
    if !p.exists() {
        return Ok(None);
    }
    fs::read_to_string(&p).map(Some).map_err(|e| io_err("읽기", &p, e))
}

/// 저장. 임시 파일에 쓴 뒤 교체하므로 쓰는 도중 죽어도 원본이 남는다.
#[tauri::command]
fn write_data_file(app: AppHandle, name: String, contents: String) -> Result<(), String> {
    let target = data_path(&app, &name)?;
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir).map_err(|e| io_err("폴더 만들기", dir, e))?;
    }
    let mut tmp_name = target.as_os_str().to_os_string();
    tmp_name.push(".tmp");
    let tmp = PathBuf::from(tmp_name);
    fs::write(&tmp, contents).map_err(|e| io_err("쓰기", &tmp, e))?;
    // std::fs::rename 은 Windows 에서도 대상이 있으면 교체한다(MoveFileEx REPLACE_EXISTING).
    fs::rename(&tmp, &target).map_err(|e| io_err("교체", &tmp, e))
}

/// `<파일>.bak1` ~ `.bak3` 으로 밀어낸다(가장 오래된 것은 버림). 파일이 없으면 아무것도 안 한다.
/// 저장마다가 아니라 **시작할 때** 부른다 — 저장마다 돌리면 0.5초 전 상태만 남는다.
#[tauri::command]
fn backup_data_file(app: AppHandle, name: String) -> Result<(), String> {
    let target = data_path(&app, &name)?;
    if !target.exists() {
        return Ok(());
    }
    let bak = |n: usize| -> PathBuf {
        let mut s = target.as_os_str().to_os_string();
        s.push(format!(".bak{n}"));
        PathBuf::from(s)
    };
    let oldest = bak(BACKUP_GENERATIONS);
    if oldest.exists() {
        fs::remove_file(&oldest).map_err(|e| io_err("삭제", &oldest, e))?;
    }
    for n in (1..BACKUP_GENERATIONS).rev() {
        let from = bak(n);
        if from.exists() {
            fs::rename(&from, bak(n + 1)).map_err(|e| io_err("이동", &from, e))?;
        }
    }
    fs::copy(&target, bak(1)).map_err(|e| io_err("백업", &target, e))?;
    Ok(())
}

/// 데이터 폴더를 탐색기로 연다. `cmd /C start` 가 아니라 explorer 에 인자로 — 경로의 `&` 를 셸이 해석하지 않게.
#[tauri::command]
fn open_data_dir(app: AppHandle) -> Result<(), String> {
    let dir = data_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| io_err("폴더 만들기", &dir, e))?;
    // 탐색기는 패키지 밖이라 가상화를 모른다 — 실제 자리를 넘긴다(만든 뒤에 물어야 그 자리가 생겨 있다).
    let dir = package::on_disk(dir);
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&dir)
            .spawn()
            .map_err(|e| io_err("열기", &dir, e))?;
    }
    Ok(())
}

/// 위젯 배치(도킹/떠 있기 · 왼쪽/오른쪽 · 모니터 · 폭). 기억해 두고 해상도·작업 영역이 바뀌면 다시 맞춘다(appbar.rs).
#[tauri::command]
fn apply_placement(window: WebviewWindow, placement: appbar::Placement) -> Result<(), String> {
    appbar::apply(placement)?;
    window.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn list_monitors() -> Vec<appbar::MonitorInfo> {
    appbar::list_monitors()
}

/// 위젯 숨기기/보이기(트레이). 숨길 때 화면 예약도 푼다.
fn set_widget_visible(app: &AppHandle, visible: bool) {
    if let Some(w) = app.get_webview_window("main") {
        if visible {
            let _ = w.show();
            let _ = appbar::set_hidden(false);
            let _ = w.set_focus();
        } else {
            let _ = appbar::set_hidden(true);
            let _ = w.hide();
            if let Some(d) = app.get_webview_window("detail") {
                let _ = d.hide();
            }
        }
    }
}

#[tauri::command]
fn hide_widget(app: AppHandle) {
    set_widget_visible(&app, false);
}

const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_VALUE: &str = "TODO.md";

/// reg.exe 를 창 없이 돌린다(CREATE_NO_WINDOW). 레지스트리 FFI 를 늘리지 않으려고.
fn reg(args: &[&str]) -> std::io::Result<std::process::Output> {
    let mut c = std::process::Command::new("reg.exe");
    c.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000);
    }
    c.output()
}

/// 로그인 시 자동 실행 — HKCU Run 키. 값이 **지금 실행 중인 exe** 를 가리킬 때만 켜진 것으로 본다
/// (포터블 zip 을 옮기면 옛 경로가 남는다 — 그땐 꺼진 것으로 보여 다시 켜게 한다).
#[tauri::command]
fn get_autostart() -> bool {
    let exe = std::env::current_exe().map(|p| p.to_string_lossy().to_lowercase()).unwrap_or_default();
    match reg(&["query", RUN_KEY, "/v", RUN_VALUE]) {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).to_lowercase().contains(&exe),
        _ => false,
    }
}

#[tauri::command]
fn set_autostart(on: bool) -> Result<(), String> {
    let r = if on {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let data = format!("\"{}\"", exe.display());
        reg(&["add", RUN_KEY, "/v", RUN_VALUE, "/t", "REG_SZ", "/d", &data, "/f"])
    } else {
        reg(&["delete", RUN_KEY, "/v", RUN_VALUE, "/f"])
    };
    match r {
        Ok(o) if o.status.success() || !on => Ok(()),
        Ok(o) => Err(String::from_utf8_lossy(&o.stderr).into_owned()),
        Err(e) => Err(e.to_string()),
    }
}

/// 트레이 메뉴 글자(화면 언어를 따른다).
#[tauri::command]
fn set_tray_labels(app: AppHandle, toggle: String, quit: String) -> Result<(), String> {
    if let Some(items) = app.try_state::<TrayItems>() {
        items.toggle.set_text(toggle).map_err(|e| e.to_string())?;
        items.quit.set_text(quit).map_err(|e| e.to_string())?;
    }
    Ok(())
}

struct TrayItems {
    toggle: tauri::menu::MenuItem<tauri::Wry>,
    quit: tauri::menu::MenuItem<tauri::Wry>,
}

/// 주간보고 창. 이미 있으면 앞으로 가져온다. 데이터는 위젯 창이 주인 — 보고 창은 이벤트로 받고 보낸다(bridge.ts).
///
/// **async 여야 한다.** Windows 에서 동기 커맨드 안에서 창을 만들면 메인 스레드 교착으로 WebView 가 멈춘다
/// (CDP 로 보면 "Target crashed"). Tauri 문서의 제약.
#[tauri::command]
async fn open_report_window(app: AppHandle, title: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("report") {
        let _ = w.unminimize();
        return w.set_focus().map_err(|e| e.to_string());
    }
    // 쿼리(`index.html?view=report`)를 넘기면 `?` 까지 파일 경로로 읽혀 빈 창(about:blank)이 된다.
    // 같은 index.html 을 열고, 이 창이 보고 창이라는 표시를 초기화 스크립트로 심는다(bridge.ts isReportView).
    WebviewWindowBuilder::new(&app, "report", WebviewUrl::App("index.html".into()))
        .initialization_script("window.__TODOMD_VIEW__ = 'report';")
        .title(title)
        .inner_size(940.0, 760.0)
        .min_inner_size(420.0, 480.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 상세 창에 띄울 할 일. 새로 뜬 창은 이벤트를 놓칠 수 있어(아직 듣기 전) 여기서 물어 간다.
struct DetailTarget(std::sync::Mutex<Option<String>>);

#[tauri::command]
fn get_detail_target(target: tauri::State<DetailTarget>) -> Option<String> {
    target.0.lock().ok().and_then(|t| t.clone())
}

/// 할 일 상세 = 위젯 **안쪽 옆**에 뜨는 별도 창(테두리 없음·항상 위). `anchor_y` = 누른 항목의 위젯 안 높이(논리 px).
/// 바깥을 누르면(다른 창이 활성화되면) 숨는다 — appbar::attach_autohide(WM_ACTIVATE). **async**: 창 생성은 동기 커맨드에서 교착(pitfalls).
#[tauri::command]
async fn open_detail_window(app: AppHandle, item_id: String, anchor_y: f64) -> Result<(), String> {
    use tauri::Emitter;
    if let Some(t) = app.try_state::<DetailTarget>() {
        *t.0.lock().map_err(|_| "잠금 실패")? = Some(item_id.clone());
    }
    let main = app.get_webview_window("main").ok_or("main 창이 없다")?;
    let scale = main.scale_factor().map_err(|e| e.to_string())?;
    let pos = main.outer_position().map_err(|e| e.to_string())?;
    let size = main.outer_size().map_err(|e| e.to_string())?;
    let mon = main.current_monitor().map_err(|e| e.to_string())?.ok_or("모니터를 찾지 못했다")?;
    let area = *mon.work_area();
    let (dw, dh) = ((360.0 * scale).round() as i32, ((640.0 * scale).round() as i32).min(area.size.height as i32));
    let gap = (6.0 * scale).round() as i32;
    let x = if appbar::current_edge() == "left" { pos.x + size.width as i32 + gap } else { pos.x - dw - gap };
    let top = area.position.y;
    let bottom = area.position.y + area.size.height as i32;
    let y = (pos.y + (anchor_y * scale).round() as i32 - (12.0 * scale) as i32).clamp(top, (bottom - dh).max(top));

    let w = match app.get_webview_window("detail") {
        Some(w) => {
            w.emit("todo://detail", &item_id).map_err(|e| e.to_string())?;
            w
        }
        None => {
            let w = WebviewWindowBuilder::new(&app, "detail", WebviewUrl::App("index.html".into()))
                .initialization_script("window.__TODOMD_VIEW__ = 'detail';")
                .title("TODO.md")
                .decorations(false)
                .shadow(false) // 그림자용 보이지 않는 테두리(양쪽 8px)를 없앤다 — 안 끄면 폭이 360 → 344 로 줄어 보인다
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .visible(false)
                .build()
                .map_err(|e| e.to_string())?;
            // SetWindowSubclass 는 **창을 만든 스레드(메인)** 에서만 된다 — async 커맨드(작업 스레드)에서 부르면
            // 조용히 실패해 바깥 클릭에도 숨지 않았다. 메인 스레드로 넘겨 붙인다.
            #[cfg(windows)]
            {
                let h = w.hwnd().map_err(|e| e.to_string())?.0 as isize;
                let handle = app.clone();
                app.run_on_main_thread(move || {
                    appbar::attach_autohide(h, move || {
                        // 창 프로시저 안이라 바로 부르지 않고 작업 스레드를 거쳐 이벤트 루프 메시지로 숨긴다.
                        let handle = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Some(d) = handle.get_webview_window("detail") {
                                let _ = d.hide();
                            }
                        });
                    })
                })
                .map_err(|e| e.to_string())?;
            }
            w
        }
    };
    #[cfg(windows)]
    appbar::place_topmost(w.hwnd().map_err(|e| e.to_string())?.0 as isize, x, y, dw, dh)?;
    w.show().map_err(|e| e.to_string())?;
    w.set_focus().map_err(|e| e.to_string())
}

/// 창이 보이는가(검증 스크립트용 — WebView2 는 창을 숨겨도 visibilityState 를 안 바꿀 때가 있어 페이지로는 모른다).
#[tauri::command]
fn is_window_visible(app: AppHandle, label: String) -> bool {
    app.get_webview_window(&label).and_then(|w| w.is_visible().ok()).unwrap_or(false)
}

#[tauri::command]
fn hide_detail(app: AppHandle) {
    if let Some(w) = app.get_webview_window("detail") {
        let _ = w.hide();
    }
}

/// 사용자가 저장 대화상자에서 고른 경로에 텍스트를 쓴다(주간보고 .md). 대화상자를 거친 경로만 온다.
#[tauri::command]
fn write_text_to(path: String, contents: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    fs::write(&p, contents).map_err(|e| io_err("쓰기", &p, e))
}

/// 스크린샷·e2e 용 예시 데이터 요청(`TODOMD_SEED=sample`). 데이터 파일이 **없을 때만** 쓰인다.
#[tauri::command]
fn seed_requested() -> bool {
    std::env::var("TODOMD_SEED").map(|v| v == "sample").unwrap_or(false)
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    appbar::release();
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 해제 ③ — 릴리스는 panic=abort 라 되감기가 없다. 패닉 훅이 화면 예약을 풀 마지막 기회.
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        appbar::release();
        default_hook(info);
    }));

    let mut builder = tauri::Builder::default();
    // 중복 실행 막기 — 두 번째 실행은 떠 있는 위젯을 보이고(숨겨 뒀으면 다시 도킹) 스스로 끝난다.
    // 안 막으면 위젯이 둘, 도킹 예약이 두 배, 같은 todo.json 을 두 프로세스가 번갈아 덮어쓴다.
    // 데이터 폴더를 따로 준 실행(TODOMD_DATA_DIR)은 제외 — 쓰는 파일이 달라 겹쳐도 되고, 막으면 사용자 앱이
    // 떠 있을 때 검증 exe 가 바로 꺼진다. 검증(desktop-single.mjs)은 `TODOMD_SINGLE_INSTANCE=1` 로 강제로 켠다.
    // 플러그인은 **맨 먼저** 등록해야 한다(플러그인 문서).
    let force = std::env::var("TODOMD_SINGLE_INSTANCE").map(|v| v == "1").unwrap_or(false);
    if env_data_dir().is_none() || force {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| set_widget_visible(app, true)));
    }
    builder
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_data_dir,
            is_packaged,
            read_data_file,
            write_data_file,
            backup_data_file,
            open_data_dir,
            apply_placement,
            list_monitors,
            hide_widget,
            get_autostart,
            set_autostart,
            set_tray_labels,
            open_detail_window,
            get_detail_target,
            hide_detail,
            is_window_visible,
            seed_requested,
            open_report_window,
            write_text_to,
            quit_app
        ])
        .setup(|app| {
            let main = app.get_webview_window("main").ok_or("main 창이 없다")?;
            #[cfg(windows)]
            appbar::attach(main.hwnd()?.0 as isize);

            // 트레이: 왼쪽 클릭 = 보이기/숨기기, 메뉴 = 보이기/숨기기 · 종료. 작업 표시줄 버튼은 없다(skipTaskbar).
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
            let toggle = MenuItem::with_id(app, "toggle", "보이기 / 숨기기", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &quit])?;
            app.manage(TrayItems { toggle: toggle.clone(), quit: quit.clone() });
            app.manage(DetailTarget(std::sync::Mutex::new(None)));
            let mut tray = TrayIconBuilder::with_id("main")
                .tooltip("TODO.md")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id().as_ref() {
                    "toggle" => {
                        let visible = app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(true);
                        set_widget_visible(app, !visible);
                    }
                    "quit" => {
                        appbar::release();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                        let app = tray.app_handle();
                        let visible = app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(true);
                        set_widget_visible(app, !visible);
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // 해제 ① — 위젯 창이 닫히면(Alt+F4 등) 예약을 풀고 앱을 끝낸다. 보고 창이 닫히는 건 상관없다.
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed = event {
                    appbar::release();
                    window.app_handle().exit(0);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            // 해제 ② — 어떤 길로 끝나든 마지막에 한 번 더(멱등).
            if let tauri::RunEvent::Exit = event {
                appbar::release();
            }
        });
}
