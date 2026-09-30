//! MSIX(Store) 로 설치돼 도는지와, 그때 데이터가 **실제로 놓이는 자리**.
//!
//! 패키지 앱이 `%APPDATA%` 에 쓰면 Windows 가 앱 전용 자리
//! `%LOCALAPPDATA%\Packages\<패밀리 이름>\LocalCache\Roaming\...` 로 몰래 돌린다(파일 시스템 쓰기 가상화).
//! 앱 안에서는 늘 `%APPDATA%` 로 보이므로 읽기·쓰기는 그대로 두고, **밖(탐색기)에 보여 줄 때만** 실제 자리로 바꾼다.
//! 안 그러면 '폴더 열기' 가 비어 있는(또는 포터블판의) 진짜 `%APPDATA%` 폴더를 연다.

use std::path::{Path, PathBuf};

/// 패키지로 돌면 패키지 패밀리 이름(`SlnU.TODO.md_xxxx`), 아니면 None(포터블).
#[cfg(windows)]
pub fn family_name() -> Option<String> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::ERROR_INSUFFICIENT_BUFFER;
    use windows::Win32::Storage::Packaging::Appx::GetCurrentPackageFamilyName;
    let mut len: u32 = 0;
    // 패키지가 아니면 APPMODEL_ERROR_NO_PACKAGE — 길이를 묻는 첫 호출이 버퍼 부족이 아니면 패키지가 아니다.
    if unsafe { GetCurrentPackageFamilyName(&mut len, None) } != ERROR_INSUFFICIENT_BUFFER || len == 0 {
        return None;
    }
    let mut buf = vec![0u16; len as usize];
    if unsafe { GetCurrentPackageFamilyName(&mut len, Some(PWSTR(buf.as_mut_ptr()))) }.is_err() {
        return None;
    }
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    Some(String::from_utf16_lossy(&buf[..end]))
}

#[cfg(not(windows))]
pub fn family_name() -> Option<String> {
    None
}

/// `dir` 이 `roaming`(= %APPDATA%) 아래면 패키지 전용 자리로 옮긴 경로. 아래가 아니면 None(돌려지지 않는 자리).
pub fn redirected(dir: &Path, roaming: &Path, local: &Path, family: &str) -> Option<PathBuf> {
    let rest = dir.strip_prefix(roaming).ok()?;
    Some(local.join("Packages").join(family).join("LocalCache").join("Roaming").join(rest))
}

/// 밖에 보여 줄 데이터 폴더. 패키지면 **늘** 가상화된 실제 자리 — 첫 실행엔 아직 없지만(첫 저장 때 생긴다)
/// 설정 화면은 시작할 때 한 번 묻기 때문에 '있을 때만' 으로 하면 첫 실행 내내 엉뚱한 경로가 보였다(desktop-msix).
pub fn on_disk(dir: PathBuf) -> PathBuf {
    let (Some(family), Ok(roaming), Ok(local)) = (family_name(), std::env::var("APPDATA"), std::env::var("LOCALAPPDATA")) else {
        return dir;
    };
    redirected(&dir, Path::new(&roaming), Path::new(&local), &family).unwrap_or(dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roaming_아래는_패키지_전용_자리로() {
        let r = redirected(
            Path::new(r"C:\Users\u\AppData\Roaming\com.slnu21.todo-md"),
            Path::new(r"C:\Users\u\AppData\Roaming"),
            Path::new(r"C:\Users\u\AppData\Local"),
            "SlnU.TODO.md_abc123",
        );
        assert_eq!(
            r,
            Some(PathBuf::from(r"C:\Users\u\AppData\Local\Packages\SlnU.TODO.md_abc123\LocalCache\Roaming\com.slnu21.todo-md"))
        );
    }

    #[test]
    fn roaming_밖은_그대로_둔다() {
        // TODOMD_DATA_DIR 처럼 다른 자리를 준 경우 — 가상화 대상이 아니다.
        let r = redirected(Path::new(r"D:\data\todo"), Path::new(r"C:\Users\u\AppData\Roaming"), Path::new(r"C:\Users\u\AppData\Local"), "F");
        assert_eq!(r, None);
    }
}
