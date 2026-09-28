//! TODO.md 데스크톱 셸.
//!
//! **할 일 로직은 한 줄도 두지 않는다.** 파일 읽기·쓰기와 창(위치·도킹·트레이)만 담당한다.
//! 로직이 Rust 에 들어가면 브라우저 모드가 반쪽이 되고 테스트가 두 벌 필요해진다.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
