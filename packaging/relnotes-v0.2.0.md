# TODO.md v0.2.0 — 주간보고

할 일과 메모 기록을 그대로 주간보고로 바꿉니다.

## 새로 생긴 것
- **주간보고**: 위젯 제목 줄의 **보고** 버튼 → 보고 창. 결과는 마크다운 원문으로 보이고 **복사**하거나 **.md 로 저장**합니다.
  - 금주 실적 = 기간 안에 완료한 것 + 진행 중 + 기간 안에 메모를 남긴 할 일. 차주 계획 = 진행 중 + 7일 안 마감 + 지난 마감.
  - 프리셋 셋: 마크다운 기본 · 간단 요약 · 메일 붙여넣기용(마크다운 기호 없이).
  - 간단 설정: 기간(최근 7일·이번 주·지난주), 상태 표시 위치와 글자, 날짜와 형식, 하위 항목·메모를 얼마나 넣을지.
  - 템플릿 직접 편집: 섹션·묶음·할 일·하위·메모 다섯 줄. `{? … }` 안은 값이 비면 통째로 빠집니다.
  - 규칙은 데이터 파일에 저장되어 다른 PC 로 옮겨도 따라갑니다. 언어를 바꾸면 기본값인 것만 따라 바뀝니다.
- **오래된 완료 항목 보관**: 완료한 지 30일 지난 할 일은 시작할 때 `archive\YYYY.json` 으로 옮겨 평소 파일을 작게 유지합니다.
- **백업**: 시작할 때에 더해 날이 바뀔 때도 한 번(`todo.json.bak1~3`).

## 바뀐 것
- 데이터 파일 버전 2(주간보고 규칙 추가). v0.1.0 파일은 그대로 열립니다. **v0.1.0 은 v0.2.0 이 저장한 파일을 열지 않습니다**(모르는 필드를 지우지 않도록).

## 측정
- 합성 5만 건(5년치): 전체를 한 파일에 두면 75MB · 읽기 0.8초. 30일 보관 분리 뒤 평소 파일 1.3MB(850건).

---

# TODO.md v0.2.0 — weekly report

Turn your to-dos and memo log straight into a weekly report.

## New
- **Weekly report**: the **Report** button in the widget title bar opens a report window. The result is shown as Markdown source — **Copy** it or **Save .md**.
  - This week = done in the period + in progress + to-dos with memos in the period. Next week = in progress + due within 7 days + overdue.
  - Three presets: Markdown · Brief · Plain text for email (no Markdown symbols).
  - Quick settings: period (last 7 days, this week, last week), status marker position and text, date and format, how many sub-items and memos to include.
  - Edit the five templates directly (section, group, to-do, sub-item, memo). Anything inside `{? … }` is dropped when a value in it is empty.
  - Rules are saved in the data file, so they follow your data to another PC. Changing the language only updates values you have not edited.
- **Archive for old completed items**: to-dos completed more than 30 days ago move to `archive\YYYY.json` on start, keeping the everyday file small.
- **Backups**: on start and again when the day changes (`todo.json.bak1–3`).

## Changed
- Data file version 2 (weekly report rules). v0.1.0 files open as before. **v0.1.0 will not open a file saved by v0.2.0** (so it cannot drop fields it does not know).

## Measured
- 50,000 synthetic to-dos (five years): 75 MB in one file, read in 0.8 s. After the 30-day split the everyday file is 1.3 MB (850 to-dos).
