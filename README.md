<div align="center">

# TODO.md

여러 프로젝트를 동시에 굴리는 사람을 위한, 화면 가장자리에 늘 붙어 있는 할 일 목록과 경과 기록

</div>

## 왜

여러 프로젝트에서 급한 일이 한꺼번에 생기면, 프로젝트마다 따로 여는 관리 도구로는 빨리 적고 챙기기 어렵습니다. TODO.md 는 화면 한쪽에 세로로 붙어 늘 보이는 위젯 하나로, 한 입력줄에 프로젝트를 고르고 적으면 끝납니다. 할 일마다 시각이 찍히는 메모를 남겨 두면 "그거 어떻게 됐어?"에 바로 답할 수 있습니다.

## 시작하기

[릴리스](https://github.com/slnu21/todo-md/releases)에서 zip 을 받아 압축을 풀고 `TODO.md.exe` 를 실행하세요. 설치가 필요 없습니다.

- Windows 10(1803+) / 11 · Microsoft Edge WebView2 런타임(Windows 11 기본 탑재)
- 데이터: `%APPDATA%\com.slnu21.todo-md\todo.json` — 설정에서 폴더를 열 수 있습니다. 시작할 때마다 `todo.json.bak1~3` 으로 백업합니다.
- 인터넷·계정이 필요 없습니다. 전 과정 오프라인입니다.

## 주요 기능

- **세로 위젯** — 화면 오른쪽에 작업 표시줄을 뺀 높이 전체로 붙어 늘 위에 떠 있습니다.
- **한 입력줄** — 프로젝트를 고르고 적고 Enter. 고른 프로젝트는 그대로 남아 연달아 적을 수 있습니다. 외울 문법이 없습니다.
- **프로젝트별 목록** — 프로젝트가 소제목, 그 아래 할 일. 진행 → 중요도 → 마감 순으로 정렬됩니다.
- **상태 3단계** — 동그라미를 누를 때마다 할 일 → 진행 → 완료. 진행 중인 일에는 형광펜이 그어집니다.
- **중요도 3단계 · 마감일 · 담당 · 하위 항목(한 단계)**
- **메모 기록** — Enter 마다 한 줄, 적은 날짜와 시각이 자동으로 붙습니다.
- **작은 달력** — 마감이 있는 날에 점, 한국 공휴일 표시. 날짜를 누르면 그날 마감만 보입니다.
- **프로젝트 보관** — 끝난 프로젝트는 보관해 목록에서 치우고, 언제든 되돌립니다.
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

MIT © 2026 slnu21

---

<div align="center">

## English

# TODO.md

A to-do strip that stays on the edge of your screen, with a timestamped memo log — for people juggling several projects at once

</div>

## Why

When urgent work lands in several projects at once, a project-by-project management tool is too slow for quick capture. TODO.md is one tall widget docked to the side of your screen: pick a project, type, press Enter. Leave timestamped memos on each to-do and you can always answer "where are we with that?".

## Getting started

Download a zip from [Releases](https://github.com/slnu21/todo-md/releases), unpack it, run `TODO.md.exe`. No installation.

- Windows 10 (1803+) / 11 · Microsoft Edge WebView2 runtime (bundled with Windows 11)
- Data: `%APPDATA%\com.slnu21.todo-md\todo.json` — open the folder from Settings. Backed up to `todo.json.bak1–3` on every start.
- No internet, no account. Fully offline.

## Features

- **Tall widget** — sits on the right edge at the full work-area height, always on top.
- **One input line** — pick a project, type, press Enter. The project stays selected so you can keep typing. No syntax to memorize.
- **Grouped by project** — projects are headings with their to-dos underneath, sorted by in-progress → importance → due date.
- **Three states** — each click on the circle moves To do → Doing → Done. Doing items get a highlighter stroke.
- **Importance (3 levels) · due date · owner · one level of sub-items**
- **Memo log** — one line per Enter, stamped with the date and time.
- **Mini calendar** — dots on days with due items, Korean public holidays. Click a day to see only what is due then.
- **Archive projects** — tidy finished projects away and restore them any time.
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

MIT © 2026 slnu21
