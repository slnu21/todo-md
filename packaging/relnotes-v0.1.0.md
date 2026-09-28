# TODO.md v0.1.0 — 첫 위젯

여러 프로젝트의 할 일을 한 화면, 한 입력줄로 적고 챙기는 세로 위젯의 첫 버전입니다.

## 들어 있는 것
- 화면 오른쪽에 작업 표시줄을 뺀 높이 전체로 붙는 위젯(늘 위)
- 한 입력줄: 프로젝트 선택(Enter 뒤에도 유지) + 제목 + 중요도·마감·담당
- 프로젝트별 목록: 진행 → 중요도 → 마감 순, 제목 아래 마지막 메모 한 줄, 완료 접기
- 상태 3단계(할 일 → 진행 → 완료), 중요도 3단계, 하위 항목 한 단계
- 할 일 상세: 메모 기록(Enter 마다 한 줄, 시각 자동, 날짜별 묶음)
- 작은 달력: 마감 점, 한국 공휴일, 날짜로 좁히기, 월/주 보기
- 프로젝트 보관·되돌리기('미분류'는 보관 불가)
- 테마(시스템·라이트·다크), 언어(시스템·한국어·English)
- 저장: 0.5초 모아 원자적 저장, 시작할 때 백업 3세대. 읽지 못한 파일은 덮어쓰지 않음

## 다음 버전
- v0.2.0: 마크다운 주간보고, 오래된 완료 항목 보관 파일
- v0.3.0: 화면 예약 도킹(왼쪽·오른쪽, 모니터 선택), 떠 있기, 상세 별도 창, 트레이, 자동 실행

---

# TODO.md v0.1.0 — first widget

The first version of a tall widget for capturing and tracking to-dos across several projects from one screen and one input line.

## What's in it
- Docks to the right edge at the full work-area height, always on top
- One input line: project (stays selected after Enter) + title + importance, due date, owner
- Grouped by project: in progress → importance → due date; last memo under each title; done items fold away
- Three states (To do → Doing → Done), three importance levels, one level of sub-items
- To-do details with a memo log (one line per Enter, time stamped automatically, grouped by day)
- Mini calendar: due dots, Korean public holidays, filter by day, month/week view
- Archive and restore projects ("Unsorted" cannot be archived)
- Theme (System / Light / Dark) and language (System / 한국어 / English)
- Saving: batched atomic writes, three backups on start; a file that cannot be read is never overwritten

## Coming next
- v0.2.0: Markdown weekly report, archive file for old completed items
- v0.3.0: screen-reserving dock (left/right, monitor choice), floating mode, separate detail window, tray, launch at login
