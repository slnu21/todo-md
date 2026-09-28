//! TODO.md 데스크톱 셸.
//!
//! **할 일 로직은 한 줄도 두지 않는다.** 파일 읽기·쓰기와 창(위치·도킹·트레이)만 담당한다.
//! 로직이 Rust 에 들어가면 브라우저 모드가 반쪽이 되고 테스트가 두 벌 필요해진다.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// 백업 세대 수. 단일 파일 포맷의 약점이 덮어쓰기 사고라 여기만 방어한다.
const BACKUP_GENERATIONS: usize = 3;

fn io_err(what: &str, path: &Path, e: std::io::Error) -> String {
    format!("{} {}: {}", path.display(), what, e)
}

/// 데이터 폴더. `TODOMD_DATA_DIR` 이 있으면 그것 — e2e·스크린샷이 **사용자 실데이터를 건드리지 않게**.
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(d) = std::env::var("TODOMD_DATA_DIR") {
        if !d.trim().is_empty() {
            return Ok(PathBuf::from(d));
        }
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

#[tauri::command]
fn get_data_dir(app: AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.to_string_lossy().into_owned())
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
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&dir)
            .spawn()
            .map_err(|e| io_err("열기", &dir, e))?;
    }
    Ok(())
}

/// 위젯을 주 모니터 작업 영역(작업 표시줄 제외)의 오른쪽 끝에 **세로 전체 높이**로 놓고 보인다.
/// M1 은 배치만 한다 — 화면 예약(AppBar 도킹)·모니터 선택·왼쪽은 M3.
/// `width` 는 논리 픽셀(CSS px). 배율을 곱해 물리 픽셀로 놓는다.
#[tauri::command]
fn place_widget(window: WebviewWindow, width: u32) -> Result<(), String> {
    let monitor = match window.primary_monitor().map_err(|e| e.to_string())? {
        Some(m) => m,
        None => window
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or("모니터를 찾지 못했다")?,
    };
    let area = monitor.work_area();
    let scale = monitor.scale_factor();
    let w = ((width as f64) * scale).round() as u32;
    let x = area.position.x + area.size.width as i32 - w as i32;
    window
        .set_size(PhysicalSize::new(w, area.size.height))
        .map_err(|e| e.to_string())?;
    window
        .set_position(PhysicalPosition::new(x, area.position.y))
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    Ok(())
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
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_data_dir,
            read_data_file,
            write_data_file,
            backup_data_file,
            open_data_dir,
            place_widget,
            seed_requested,
            open_report_window,
            write_text_to,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
