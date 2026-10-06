<div align="center">

# TODO.md

여러 프로젝트를 동시에 굴리는 사람을 위한, 화면 가장자리에 늘 붙어 있는 할 일 목록과 경과 기록

</div>

## 왜

여러 프로젝트에서 급한 일이 한꺼번에 생기면, 프로젝트마다 따로 여는 관리 도구로는 빨리 적고 챙기기 어렵습니다. TODO.md 는 화면 한쪽에 세로로 붙어 늘 보이는 위젯 하나로, 한 입력줄에 프로젝트를 고르고 적으면 끝납니다. 할 일마다 시각이 찍히는 메모를 남겨 두면 "그거 어떻게 됐어?"에 바로 답할 수 있습니다.

## 시작하기

[릴리스](https://github.com/slnu21/todo-md/releases)에서 zip 을 받아 압축을 풀고 `TODO.md.exe` 를 실행하세요. 설치가 필요 없습니다. 위젯의 × 를 처음 누르면 **숨기기(트레이에 남음)** 와 **종료** 중에 고르고, 그 선택을 기억합니다(설정에서 바꿈). 이미 떠 있을 때 다시 실행하면 새로 뜨지 않고 떠 있는 위젯을 보여 줍니다.

- Windows 10(1803+) / 11 · Microsoft Edge WebView2 런타임(Windows 11 기본 탑재)
- 데이터: `%APPDATA%\com.slnu21.todo-md\todo.json` — 설정에서 폴더를 열 수 있습니다. 시작할 때와 날이 바뀔 때 `todo.json.bak1~3` 으로 백업합니다.
- 인터넷·계정이 필요 없습니다. 전 과정 오프라인입니다.

## 주요 기능

- **세로 위젯 · 도킹** — 작업 표시줄처럼 화면 한쪽을 차지해 다른 창이 덮지 않습니다. 모니터와 왼쪽·오른쪽을 고르고, 높이는 늘 작업 영역 전체. 떠 있기 모드와 폭 조절(300~440px)도 있습니다.
- **트레이 · 자동 실행** — 트레이 아이콘으로 보이기/숨기기, 로그인 시 자동 실행(설정에서 켬).
- **한 입력줄** — 프로젝트를 고르고 적고 Enter. 고른 프로젝트는 그대로 남아 연달아 적을 수 있습니다. 외울 문법이 없습니다.
- **프로젝트별 목록** — 프로젝트가 소제목, 그 아래 할 일. 진행 → 중요도 → 마감 순으로 정렬됩니다. 소제목을 끌어 프로젝트 순서를 바꾸고(Alt+↑↓), 두 번 눌러 이름을 바꿉니다.
- **상태 3단계** — 동그라미를 누를 때마다 할 일 → 진행 → 완료. 진행 중인 일에는 형광펜이 그어집니다.
- **중요도 3단계 · 마감일 · 담당 · 하위 항목(한 단계)**
- **메모 기록** — 할 일을 누르면 위젯 옆에 상세 창이 뜹니다. Enter 마다 한 줄, 적은 날짜와 시각이 자동으로 붙습니다. 적은 메모는 고칠 수 있습니다(시각은 그대로). 상세 창 위쪽의 프로젝트 이름을 눌러 다른 프로젝트로 옮깁니다(메모·하위 항목도 함께).
- **찾기 · 지난 완료** — 제목·메모·하위 항목·담당에서 찾습니다(Ctrl+F). 검색어를 비우면 완료한 일 기록, 30일 지난 완료(보관 파일)까지 볼 수 있습니다.
- **작은 달력** — 마감이 있는 날에 점, 한국 공휴일 표시. 날짜를 누르면 그날 마감만 보입니다.
- **프로젝트 보관** — 끝난 프로젝트는 보관해 목록에서 치우고, 언제든 되돌립니다.
- **주간보고** — 할 일과 메모 기록을 금주 실적·차주 계획 마크다운으로. 복사하거나 .md 로 저장. 프리셋 셋, 간단 설정, 템플릿 직접 편집.
- **오래된 완료 항목 보관** — 완료한 지 30일 지나면 `archive\YYYY.json` 으로 옮겨 평소 파일을 작게.
- **내보내기** — 할 일·메모 전부(보관 파일 포함)를 JSON 파일 하나로(설정 ▸ 데이터 폴더).
- **테마·언어** — 시스템 / 라이트 / 다크, 시스템 / 한국어 / English.

## 개발

```powershell
cd src
npm install
npm run dev          # 브라우저에서 실행 (http://localhost:1440)
npm test             # 단위 테스트 (vitest)
npx playwright test  # e2e + 화면 캡처 (test-results/shots)
npm run tauri build  # TODO.md 실행 파일
powershell -File ..\packaging\pack-zip.ps1   # 포터블 zip
```

## 라이선스

© 2026 SlnU(slnu21). 무료로 쓸 수 있으며, 개인·업무 사용 모두 허용합니다. 사용 조건은 [EULA](./legal/EULA.md), 개인정보는 [개인정보 처리방침](./legal/privacy.md)(수집하지 않음), 포함한 오픈소스 구성요소는 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

---

<div align="center">

## English

# TODO.md

A to-do strip that stays on the edge of your screen, with a timestamped memo log — for people juggling several projects at once

</div>

## Why

When urgent work lands in several projects at once, a project-by-project management tool is too slow for quick capture. TODO.md is one tall widget docked to the side of your screen: pick a project, type, press Enter. Leave timestamped memos on each to-do and you can always answer "where are we with that?".

## Getting started

Download a zip from [Releases](https://github.com/slnu21/todo-md/releases), unpack it, run `TODO.md.exe`. No installation. The first time you click the widget's ×, choose **Hide (stays in the tray)** or **Quit**; your choice is remembered (change it in Settings). Launching it again while it runs just shows the widget that is already there.

- Windows 10 (1803+) / 11 · Microsoft Edge WebView2 runtime (bundled with Windows 11)
- Data: `%APPDATA%\com.slnu21.todo-md\todo.json` — open the folder from Settings. Backed up to `todo.json.bak1–3` on start and when the day changes.
- No internet, no account. Fully offline.

## Features

- **Tall widget · docking** — reserves one edge of the screen like the taskbar, so other windows never cover it. Pick the monitor and left or right edge; the height always fills the work area. Float mode and width (300–440 px) too.
- **Tray · launch at sign-in** — show or hide from the tray icon; launch at sign-in (turn on in Settings).
- **One input line** — pick a project, type, press Enter. The project stays selected so you can keep typing. No syntax to memorize.
- **Grouped by project** — projects are headings with their to-dos underneath, sorted by in-progress → importance → due date. Drag a heading to reorder projects (Alt+↑↓), double-click it to rename.
- **Three states** — each click on the circle moves To do → Doing → Done. Doing items get a highlighter stroke.
- **Importance (3 levels) · due date · owner · one level of sub-items**
- **Memo log** — click a to-do and its details open beside the widget. One line per Enter, stamped with the date and time. Memos can be edited later (the time stays). Click the project name at the top of the details to move the to-do to another project (memos and sub-items go with it).
- **Find · past completions** — search titles, memos, sub-items and owners (Ctrl+F). With an empty search you see what you completed, including completions older than 30 days (archive files).
- **Mini calendar** — dots on days with due items, Korean public holidays. Click a day to see only what is due then.
- **Archive projects** — tidy finished projects away and restore them any time.
- **Weekly report** — turns to-dos and memos into a This week / Next week Markdown report. Copy it or save as .md. Three presets, quick settings, or edit the templates directly.
- **Archive for old completed items** — to-dos completed over 30 days ago move to `archive\YYYY.json`, keeping the everyday file small.
- **Export** — all to-dos and memos (archive files included) as one JSON file (Settings ▸ Data folder).
- **Theme and language** — System / Light / Dark, System / 한국어 / English.

## Development

```powershell
cd src
npm install
npm run dev          # run in a browser (http://localhost:1440)
npm test             # unit tests (vitest)
npx playwright test  # e2e + screenshots (test-results/shots)
npm run tauri build  # TODO.md executable
powershell -File ..\packaging\pack-zip.ps1   # portable zip
```

## License

© 2026 SlnU (slnu21). Free to use, for personal and business use alike. Terms: [EULA](./legal/EULA.md) · Privacy: [Privacy Policy](./legal/privacy.md) (nothing is collected) · Open-source components: [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
