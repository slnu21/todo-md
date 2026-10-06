# Microsoft Store 등록 문안 (KO / EN)

제품: **TODO.md** · 가격: **무료** · 카테고리: 생산성(Productivity) · 연령 등급: 전체 이용가(온라인 상호작용·사용자 간 공유 없음).
Partner Center 각 칸에 아래 문구를 복사한다. 과장·미구현 금지 — 기능이 바뀌면 여기부터 고친다.

- **개인정보 처리방침 URL:** https://github.com/slnu21/todo-md/blob/main/legal/privacy.md
- **추가 라이선스 조건(EULA) URL:** https://github.com/slnu21/todo-md/blob/main/legal/EULA.md
- **지원 연락처:** raltlsdn@naver.com
- **패키지:** `packaging\pack-msix.ps1 -IdentityName <예약한 이름>` → `release\TODO.md_<버전>_x64.msix` (서명 없이 올린다 — Store 가 서명)

---

## 한국어 (ko-KR)

**앱 이름:** TODO.md

**짧은 소개:**
화면 가장자리에 늘 붙어 있는 할 일 목록과 메모 기록. 계정도 인터넷도 필요 없습니다.

**설명:**
여러 프로젝트에서 급한 일이 한꺼번에 생기면, 프로젝트마다 따로 여는 관리 도구로는 빨리 적고 챙기기 어렵습니다. TODO.md 는 화면 한쪽에 세로로 붙어 늘 보이는 위젯 하나입니다. 프로젝트를 고르고 적고 Enter — 외울 문법이 없습니다.

할 일마다 **시각이 찍히는 메모**를 남겨 두면 "그거 어떻게 됐어?"에 바로 답할 수 있고, 쌓인 기록은 버튼 하나로 **마크다운 주간보고**(금주 실적·차주 계획)가 됩니다.

위젯은 작업 표시줄처럼 화면 한쪽을 차지해 최대화한 창도 덮지 않습니다. 모든 데이터는 내 PC 에만 저장되고, 계정·동기화·추적이 없어 보안이 까다로운 업무 환경에서도 쓸 수 있습니다.

**주요 기능:**
- 화면 한쪽에 도킹(모니터·왼쪽/오른쪽 선택) 또는 항상 위에 떠 있기, 폭 조절
- 한 입력줄 — 프로젝트를 고르고 적고 Enter, 중요도·마감·담당은 선택
- 프로젝트별 목록 — 진행 → 중요도 → 마감 순 정렬, 끌어서 프로젝트 순서 바꾸기, 할 일을 다른 프로젝트로 옮기기
- 상태 3단계(할 일·진행·완료), 중요도 3단계, 하위 항목 한 단계
- 시각이 찍히는 메모 기록, 나중에 고치기
- 마크다운 주간보고 — 복사하거나 .md 로 저장, 템플릿 직접 편집
- 찾기 — 제목·메모·하위 항목·담당에서, 지난 완료 기록까지
- 작은 달력 — 마감 표시, 한국 공휴일
- 프로젝트 보관·되돌리기, 30일 지난 완료는 자동으로 보관 파일로
- 할 일·메모 전부를 JSON 한 파일로 내보내기
- 라이트·다크 테마, 한국어·English
- 오프라인 — 계정·인터넷·추적 없음

**검색어(최대 7):** 할 일, todo, 작업 목록, 메모, 주간보고, 위젯, 생산성

---

## English (en-US)

**App name:** TODO.md

**Short description:**
A to-do list and memo log that stays on the edge of your screen. No account, no internet.

**Description:**
When urgent work lands in several projects at once, a project-by-project management tool is too slow for quick capture. TODO.md is one tall widget that stays on the side of your screen: pick a project, type, press Enter — no syntax to memorize.

Leave **timestamped memos** on each to-do and you can always answer "where are we with that?". One click turns the log into a **Markdown weekly report** (this week's results, next week's plan).

The widget reserves one edge of the screen like the taskbar, so even maximized windows never cover it. Everything stays on your PC — no account, no sync, no tracking — so it fits locked-down work environments too.

**Features:**
- Dock to a screen edge (choose monitor and left/right) or float on top; adjustable width
- One input line — pick a project, type, press Enter; importance, due date and owner are optional
- Grouped by project — sorted by in-progress → importance → due date; drag to reorder projects; move a to-do to another project
- Three states (To do · Doing · Done), three importance levels, one level of sub-items
- Timestamped memo log, editable later
- Markdown weekly report — copy or save as .md, edit the templates directly
- Find — across titles, memos, sub-items and owners, including past completions
- Mini calendar — due dates, Korean public holidays
- Archive and restore projects; completions older than 30 days move to archive files automatically
- Export all to-dos and memos as one JSON file
- Light and dark themes, Korean and English
- Offline — no account, no internet, no tracking

**Search terms (up to 7):** todo, to-do list, task list, memo, weekly report, widget, productivity

---

## 스크린샷 (`store/screenshots/`, 1920×1080 — 언어별 4장)

`cd src; node scripts/store-shots.mjs ../store/screenshots --lang ko|en` 으로 다시 만든다(빌드한 exe + 예시 데이터, 실데이터 안 건드림). 화면이 바뀌면 다시 찍는다.

| 순서 | ko-KR | en-US | 장면 |
|---|---|---|---|
| 1 | `store-ko-1-dock.png` | `store-en-1-dock.png` | 오른쪽 도킹 위젯 — "늘 보인다"(가장 중요한 한 장) |
| 2 | `store-ko-2-detail.png` | `store-en-2-detail.png` | 할 일 상세 창 + 메모 기록 |
| 3 | `store-ko-3-report.png` | `store-en-3-report.png` | 주간보고 창(마크다운 결과) |
| 4 | `store-ko-4-dark.png` | `store-en-4-dark.png` | 다크 테마 · 달력 |

## 제출 체크리스트 (Partner Center — 사용자 직접)

- [ ] 앱 이름 **TODO.md** 예약 → Identity Name 확인(예상: `SlnU.TODO.md`, Publisher 는 md-reader 와 같은 `CN=1398342C-…`)
- [ ] `pack-msix.ps1 -IdentityName <예약값>` 으로 MSIX 생성 → 업로드
- [ ] 가격 무료 · 시장 · 연령 등급 설문 · 카테고리 생산성
- [ ] 위 문안(ko/en) · 스크린샷(`store/screenshots/`, ✅ 2026-10-06) · 개인정보 URL · EULA URL · 지원 연락처
- [ ] runFullTrust 사유: "데스크톱 앱 — 화면 가장자리 도킹(AppBar)·트레이·로컬 파일 저장"
