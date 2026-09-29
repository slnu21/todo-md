//! 위젯 배치 — **도킹**(SHAppBarMessage 로 화면 한쪽을 작업 표시줄처럼 예약)과 **떠 있기**(항상 위, 예약 없음).
//!
//! 모니터·작업 영역·DPI 는 전부 Win32 로 직접 구한다. 해상도 변경 같은 시스템 메시지를 받는 창 프로시저
//! 안에서 Tauri 창 API 를 부르면 교착 위험이 있어서다(창 생성에서 실제로 겪었다 — docs/pitfalls.md).
//!
//! ⚠ 도킹은 **OS 전역 상태**다. ABM_NEW 로 등록하면 ABM_REMOVE 를 부를 때까지 그 폭이 예약된 채로 남아,
//! 앱이 사라져도 데스크톱에 **빈 띠**가 남는다(Atlas 위젯에서 겪은 것). 그래서 해제를 세 곳에서 부른다:
//! 창 닫힘 · 앱 종료(RunEvent::Exit) · 패닉 훅(릴리스는 panic=abort 라 훅이 마지막 기회). 숨길 때도 해제한다.

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use windows::core::{BOOL, PCWSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO, MONITORINFOEXW};
use windows::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI};
use windows::Win32::UI::Shell::{
    DefSubclassProc, SHAppBarMessage, SetWindowSubclass, ABE_LEFT, ABE_RIGHT, ABM_NEW, ABM_QUERYPOS, ABM_REMOVE,
    ABM_SETPOS, ABN_POSCHANGED, APPBARDATA,
};
use windows::Win32::UI::WindowsAndMessaging::{
    RegisterWindowMessageW, SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_SHOWWINDOW, WM_ACTIVATE,
    WM_DISPLAYCHANGE, WM_DPICHANGED, WM_SETTINGCHANGE,
};

const MONITORINFOF_PRIMARY: u32 = 1;
const SPI_SETWORKAREA: usize = 0x002F;
/// 떠 있기 모드에서 가장자리와 띄우는 거리(논리 px).
const FLOAT_GAP: f64 = 12.0;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    /// "dock" | "float"
    pub mode: String,
    /// "left" | "right"
    pub edge: String,
    /// 모니터 장치 이름(`\\.\DISPLAY1`). "" 이거나 없어진 모니터면 주 모니터.
    pub monitor: String,
    /// 논리 px(CSS px). 모니터 배율을 곱해 놓는다.
    pub width: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub name: String,
    pub primary: bool,
    /// 물리 px — 설정 화면의 모니터 그림 비율에만 쓴다.
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub scale: f64,
}

struct Mon {
    info: MonitorInfo,
    full: RECT,
    work: RECT,
}

struct State {
    hwnd: isize,
    callback_msg: u32,
    registered: bool,
    placement: Option<Placement>,
    hidden: bool,
}

static STATE: Mutex<State> = Mutex::new(State { hwnd: 0, callback_msg: 0, registered: false, placement: None, hidden: false });
/// 다시 맞추는 중에 온 알림(우리가 SETPOS 해서 생긴 ABN_POSCHANGED 등)으로 되돌아오는 고리를 끊는다.
///
/// ⚠ 재진입 교착: SetWindowPos·SHAppBarMessage 는 **같은 스레드에서** 우리 창 프로시저를 다시 부를 수 있다.
/// 그 사이 STATE 를 잠그고 있으므로 프로시저가 STATE 를 잠그면 스스로 막힌다(std Mutex 는 재진입 불가).
/// 그래서 ① 프로시저는 STATE 를 잠그지 않고 알림 번호를 원자값(CALLBACK)으로 읽고,
/// ② 배치를 바꾸는 모든 경로는 APPLYING 을 세워 두어 그 사이 온 알림은 다시 맞추기를 건너뛴다.
static APPLYING: AtomicBool = AtomicBool::new(false);
static CALLBACK: AtomicU32 = AtomicU32::new(0);

/// APPLYING 을 세운 채로 실행(이미 서 있으면 그대로 — 중첩 호출도 안전).
fn guarded<T>(f: impl FnOnce() -> T) -> T {
    let was = APPLYING.swap(true, Ordering::SeqCst);
    let r = f();
    if !was {
        APPLYING.store(false, Ordering::SeqCst);
    }
    r
}

fn hwnd_of(raw: isize) -> HWND {
    HWND(raw as *mut core::ffi::c_void)
}

unsafe extern "system" fn enum_proc(hmon: HMONITOR, _hdc: HDC, _rc: *mut RECT, data: LPARAM) -> BOOL {
    let out = &mut *(data.0 as *mut Vec<Mon>);
    let mut mi = MONITORINFOEXW::default();
    mi.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
    if GetMonitorInfoW(hmon, &mut mi as *mut MONITORINFOEXW as *mut MONITORINFO).as_bool() {
        let len = mi.szDevice.iter().position(|&c| c == 0).unwrap_or(mi.szDevice.len());
        let name = String::from_utf16_lossy(&mi.szDevice[..len]);
        let (mut dx, mut dy) = (96u32, 96u32);
        let _ = GetDpiForMonitor(hmon, MDT_EFFECTIVE_DPI, &mut dx, &mut dy);
        let r = mi.monitorInfo.rcMonitor;
        out.push(Mon {
            info: MonitorInfo {
                name,
                primary: mi.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0,
                x: r.left,
                y: r.top,
                width: r.right - r.left,
                height: r.bottom - r.top,
                scale: dx as f64 / 96.0,
            },
            full: r,
            work: mi.monitorInfo.rcWork,
        });
    }
    BOOL(1)
}

fn monitors() -> Vec<Mon> {
    let mut out: Vec<Mon> = Vec::new();
    unsafe {
        let _ = EnumDisplayMonitors(None, None, Some(enum_proc), LPARAM(&mut out as *mut Vec<Mon> as isize));
    }
    out
}

/// 위젯이 붙은 쪽("left"/"right"). 상세 창을 위젯 **안쪽** 옆에 놓을 때 쓴다.
pub fn current_edge() -> String {
    STATE.lock().ok().and_then(|s| s.placement.as_ref().map(|p| p.edge.clone())).unwrap_or_else(|| "right".into())
}

pub fn list_monitors() -> Vec<MonitorInfo> {
    monitors().into_iter().map(|m| m.info).collect()
}

/// 고른 모니터. 이름이 없거나 사라졌으면 주 모니터(같은 쪽 가장자리는 호출자가 유지).
fn pick(mons: &[Mon], name: &str) -> Option<usize> {
    if !name.is_empty() {
        if let Some(i) = mons.iter().position(|m| m.info.name == name) {
            return Some(i);
        }
    }
    mons.iter().position(|m| m.info.primary).or(if mons.is_empty() { None } else { Some(0) })
}

fn abd(hwnd: HWND, callback: u32) -> APPBARDATA {
    APPBARDATA { cbSize: std::mem::size_of::<APPBARDATA>() as u32, hWnd: hwnd, uCallbackMessage: callback, ..Default::default() }
}

fn remove_locked(st: &mut State) {
    if st.registered && st.hwnd != 0 {
        let mut d = abd(hwnd_of(st.hwnd), st.callback_msg);
        unsafe {
            SHAppBarMessage(ABM_REMOVE, &mut d);
        }
        st.registered = false;
    }
}

/// 도킹 해제(멱등). 창 닫힘·앱 종료·패닉·숨김에서 부른다.
pub fn release() {
    guarded(|| {
        if let Ok(mut st) = STATE.lock() {
            remove_locked(&mut st);
        }
    })
}

fn apply_locked(st: &mut State) -> Result<(), String> {
    let Some(p) = st.placement.clone() else { return Ok(()) };
    if st.hwnd == 0 || st.hidden {
        return Ok(());
    }
    let hwnd = hwnd_of(st.hwnd);
    let mons = monitors();
    let i = pick(&mons, &p.monitor).ok_or("모니터를 찾지 못했다")?;
    let m = &mons[i];
    let w = ((p.width as f64) * m.info.scale).round() as i32;
    let right = p.edge != "left";

    let rc = if p.mode == "dock" {
        if !st.registered {
            let mut d = abd(hwnd, st.callback_msg);
            if unsafe { SHAppBarMessage(ABM_NEW, &mut d) } == 0 {
                return Err("도킹 등록(ABM_NEW)에 실패했다".into());
            }
            st.registered = true;
        }
        // 모니터 전체 높이로 청하고 → 셸이 작업 표시줄 등을 피해 깎아 준 자리(QUERYPOS)에 → 폭을 다시 맞춰 확정(SETPOS).
        let mut d = abd(hwnd, st.callback_msg);
        d.uEdge = if right { ABE_RIGHT } else { ABE_LEFT };
        d.rc = m.full;
        if right { d.rc.left = d.rc.right - w } else { d.rc.right = d.rc.left + w }
        unsafe { SHAppBarMessage(ABM_QUERYPOS, &mut d) };
        if right { d.rc.left = d.rc.right - w } else { d.rc.right = d.rc.left + w }
        unsafe { SHAppBarMessage(ABM_SETPOS, &mut d) };
        d.rc
    } else {
        remove_locked(st);
        // 떠 있기: 예약 없이 작업 영역 전체 높이, 가장자리에서 살짝 띄운다.
        let gap = (FLOAT_GAP * m.info.scale).round() as i32;
        let a = m.work;
        let left = if right { a.right - w - gap } else { a.left + gap };
        RECT { left, top: a.top + gap, right: left + w, bottom: a.bottom - gap }
    };
    unsafe {
        SetWindowPos(hwnd, Some(HWND_TOPMOST), rc.left, rc.top, rc.right - rc.left, rc.bottom - rc.top, SWP_NOACTIVATE | SWP_SHOWWINDOW)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 배치를 기억하고 적용한다. 이후 해상도·배율·작업 표시줄이 바뀌면 이 값으로 다시 맞춘다.
pub fn apply(p: Placement) -> Result<(), String> {
    guarded(|| {
        let mut st = STATE.lock().map_err(|_| "상태 잠금 실패")?;
        st.placement = Some(p);
        st.hidden = false;
        apply_locked(&mut st)
    })
}

/// 숨길 때는 예약도 푼다 — 안 그러면 보이지 않는 위젯이 화면 한쪽을 계속 차지한다.
pub fn set_hidden(hidden: bool) -> Result<(), String> {
    guarded(|| {
        let mut st = STATE.lock().map_err(|_| "상태 잠금 실패")?;
        st.hidden = hidden;
        if hidden {
            remove_locked(&mut st);
            Ok(())
        } else {
            apply_locked(&mut st)
        }
    })
}

fn reapply() {
    if APPLYING.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Ok(mut st) = STATE.lock() {
        let _ = apply_locked(&mut st);
    }
    APPLYING.store(false, Ordering::SeqCst);
}

unsafe extern "system" fn subclass_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM, _id: usize, _data: usize) -> LRESULT {
    let callback = CALLBACK.load(Ordering::SeqCst); // STATE 를 잠그지 않는다(재진입 교착 — 위 주석)
    let relevant = msg == WM_DISPLAYCHANGE
        || msg == WM_DPICHANGED
        || (msg == WM_SETTINGCHANGE && wp.0 == SPI_SETWORKAREA)
        || (callback != 0 && msg == callback && wp.0 as u32 == ABN_POSCHANGED);
    let r = DefSubclassProc(hwnd, msg, wp, lp);
    if relevant {
        reapply();
    }
    r
}

/// 위젯 창을 붙잡는다: 알림 메시지 등록 + 창 프로시저 가로채기(해상도·작업 영역 변경을 받기 위해).
/// **창을 만든 스레드(메인)에서 불러야 한다** — setup 에서 부른다.
pub fn attach(hwnd_raw: isize) {
    let callback = unsafe { RegisterWindowMessageW(PCWSTR(windows::core::w!("TODOMD_APPBAR").as_ptr())) };
    CALLBACK.store(callback, Ordering::SeqCst);
    if let Ok(mut st) = STATE.lock() {
        st.hwnd = hwnd_raw;
        st.callback_msg = callback;
    }
    unsafe {
        let _ = SetWindowSubclass(hwnd_of(hwnd_raw), Some(subclass_proc), 1, 0);
    }
}

/// 다른 창을 **항상 위**로 물리 px 자리에 놓는다(상세 창). Tauri set_position 은 테두리 없는 창에도 보이지 않는
/// 테두리 보정이 들어가 위젯(SetWindowPos)과 8px 어긋났다 — 같은 기준으로 놓으려고 Win32 로.
pub fn place_topmost(hwnd_raw: isize, x: i32, y: i32, w: i32, h: i32) -> Result<(), String> {
    unsafe { SetWindowPos(hwnd_of(hwnd_raw), Some(HWND_TOPMOST), x, y, w, h, SWP_NOACTIVATE).map_err(|e| e.to_string()) }
}

const WA_INACTIVE: usize = 0;

/// 상세 창이 비활성화될 때 부를 것(숨기기). 호출자가 Tauri 로 숨긴다 — 아래 autohide_proc 주석.
static ON_DEACTIVATE: OnceLock<Box<dyn Fn() + Send + Sync>> = OnceLock::new();

unsafe extern "system" fn autohide_proc(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM, _id: usize, _data: usize) -> LRESULT {
    let r = DefSubclassProc(hwnd, msg, wp, lp);
    // 다른 창이 활성화되면(바깥을 누르면) 숨는다. WM_ACTIVATE 는 최상위 창 단위라, WebView 안에서 포커스가
    // 옮겨 다니는 것(Tauri Focused(false) 가 첫 표시 때 거짓으로 오는 원인)에 흔들리지 않는다.
    // ⚠ 여기서 ShowWindow(SW_HIDE) 로 직접 숨기지 않는다 — Tauri(tao)는 창이 여전히 보인다고 알고 있어
    // 다음 show() 를 '이미 보임'으로 건너뛰어 다시 열리지 않았고, 종료도 멈췄다(v0.3.0). 숨기기는 Tauri 에게.
    if msg == WM_ACTIVATE && (wp.0 & 0xFFFF) == WA_INACTIVE {
        if let Some(f) = ON_DEACTIVATE.get() {
            f();
        }
    }
    r
}

/// 창이 비활성화되면 `on_deactivate` 를 부르게 한다(상세 창 숨기기). **창을 만든 스레드에서 불러야 한다**
/// (SetWindowSubclass 제약). `on_deactivate` 는 창 프로시저 안에서 불리므로 Tauri 창 API 를 바로 부르지 말고
/// 이벤트 루프로 넘겨야 한다(재진입).
pub fn attach_autohide(hwnd_raw: isize, on_deactivate: impl Fn() + Send + Sync + 'static) {
    let _ = ON_DEACTIVATE.set(Box::new(on_deactivate));
    unsafe {
        let _ = SetWindowSubclass(hwnd_of(hwnd_raw), Some(autohide_proc), 2, 0);
    }
}
