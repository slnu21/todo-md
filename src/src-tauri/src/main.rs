// 릴리스에서 콘솔 창이 함께 뜨는 것을 막는다. 지우지 말 것.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    todo_md_lib::run();
}
