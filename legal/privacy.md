# 개인정보 처리방침 / Privacy Policy

- **제품 / Product:** TODO.md (Windows 데스크톱 앱)
- **시행일 / Effective date:** 2026-09-30 (Store 설치판 저장 위치 추가 / added Store edition storage location)
- **게시자 / Publisher:** `SlnU`
- **문의 / Contact:** `raltlsdn@naver.com`

---

## 한국어

**TODO.md**(이하 "본 앱")는 **오프라인**으로 동작하는 할 일 목록·메모 기록 앱입니다. 본 앱은 사용자의 개인정보를 **수집하거나 외부로 전송하지 않습니다.**

### 1. 수집하는 정보
본 앱은 어떠한 개인정보도 수집하지 않습니다. 계정 생성이나 로그인이 없으며, 이름·이메일·전화번호·위치 등 개인 식별 정보를 요구하지 않습니다.

### 2. 데이터 저장 (사용자 기기에만)
- 사용자가 적은 할 일·메모·주간보고 설정은 **사용자 기기의 데이터 폴더**(`%APPDATA%\com.slnu21.todo-md\`)에만 저장됩니다: `todo.json`, 30일 지난 완료 항목을 옮긴 `archive\YYYY.json`, 자동 백업 `todo.json.bak1~3`.
- 창 위치·테마·언어 등 화면 설정은 같은 폴더의 `settings.json`에 저장됩니다.
- **Microsoft Store 설치판**은 Windows가 위 폴더를 앱 전용 자리(`%LOCALAPPDATA%\Packages\<앱 패키지>\LocalCache\Roaming\com.slnu21.todo-md\`)로 옮겨 저장하며, 앱을 제거하면 함께 삭제됩니다. 설정 화면의 데이터 폴더는 이 실제 자리를 보여 줍니다.
- (포터블판) 사용자가 '로그인 시 자동 실행'을 켜면 Windows 현재 사용자 레지스트리(`HKCU\...\Run`)에 실행 경로를 기록하고, 끄면 지웁니다.
- 주간보고를 복사하거나 `.md`로 저장할 때는 사용자가 누른 동작에 따라 클립보드나 사용자가 고른 파일에만 씁니다.
- 위 데이터는 사용자 기기를 벗어나지 않습니다. 데이터 폴더는 설정 화면에서 열 수 있으며, 사용자가 직접 지울 수 있습니다.

### 3. 네트워크 통신
본 앱은 외부 서버와 통신하지 않습니다. 업데이트 확인·오류 보고·사용 통계 기능이 없으며, 콘텐츠 보안 정책(CSP)으로 원격 리소스의 로드·전송을 차단합니다. (Microsoft Store로 설치·업데이트하는 경우 그 과정은 Microsoft가 처리하며, 본 방침의 적용 범위 밖입니다.)

### 4. 제3자 구성요소
- 본 앱은 화면 표시를 위해 Windows의 **Microsoft Edge WebView2 런타임**을 사용합니다. WebView2 자체의 데이터 처리는 Microsoft의 정책을 따릅니다. 본 앱은 WebView2를 통해 사용자 데이터를 외부로 전송하지 않습니다.
- **분석(analytics)·광고·추적 SDK를 일절 포함하지 않습니다.**
- 포함된 오픈소스 구성요소의 라이선스 고지는 [THIRD-PARTY-NOTICES](../THIRD-PARTY-NOTICES.md)를 따릅니다.

### 5. 아동의 개인정보
본 앱은 개인정보를 수집하지 않으므로, 아동을 포함한 어떤 사용자로부터도 개인정보를 수집하지 않습니다.

### 6. 방침의 변경
외부와 통신하는 기능을 도입할 경우, 본 방침을 사전에 갱신하고 릴리스 노트 또는 스토어 페이지에서 고지합니다.

### 7. 문의
개인정보 관련 문의는 `raltlsdn@naver.com` 로 연락 주시기 바랍니다.

---

## English

**TODO.md** (the "App") is an **offline** to-do list and memo log. The App does **not collect or transmit** any personal information.

### 1. Information We Collect
The App collects no personal information. There is no account or sign-in, and the App does not ask for identifying data such as name, email, phone number, or location.

### 2. Data Storage (On Your Device Only)
- Your to-dos, memos and weekly report settings are stored **only in the data folder on your device** (`%APPDATA%\com.slnu21.todo-md\`): `todo.json`, `archive\YYYY.json` (completed items older than 30 days), and automatic backups `todo.json.bak1–3`.
- Window position, theme and language are stored in `settings.json` in the same folder.
- In the **Microsoft Store edition**, Windows keeps that folder in an app-private location (`%LOCALAPPDATA%\Packages\<app package>\LocalCache\Roaming\com.slnu21.todo-md\`), and it is removed when you uninstall the App. The data folder shown in Settings is this actual location.
- (Portable edition) If you turn on "Launch at sign-in", the App writes its path to the current user's Windows registry (`HKCU\...\Run`) and removes it when you turn it off.
- When you copy a weekly report or save it as `.md`, the App writes only to the clipboard or to the file you choose, as you requested.
- This data never leaves your device. You can open the data folder from Settings and delete it yourself.

### 3. Network Communication
The App does not communicate with external servers. It has no update check, error reporting or usage statistics, and a Content Security Policy (CSP) blocks loading or sending remote resources. (If you install or update through the Microsoft Store, that process is handled by Microsoft and falls outside this policy.)

### 4. Third-Party Components
- The App uses the **Microsoft Edge WebView2 runtime** on Windows to render its UI. WebView2's own data handling is governed by Microsoft's policies. The App does not send user data through WebView2 to any external party.
- The App contains **no analytics, advertising, or tracking SDKs.**
- License notices for bundled open-source components are provided in [THIRD-PARTY-NOTICES](../THIRD-PARTY-NOTICES.md).

### 5. Children's Privacy
Because the App collects no personal information, it collects none from children or any other users.

### 6. Changes to This Policy
If features that communicate externally are introduced, this policy will be updated in advance and disclosed in the release notes or on the store page.

### 7. Contact
For privacy inquiries, please contact `raltlsdn@naver.com`.
