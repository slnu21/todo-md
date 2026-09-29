# TODO.md v0.4.0 — 찾기 · 메모 고치기 · 프로젝트 정리

## 새로 생긴 것
- **찾기 · 지난 완료**: 제목 줄의 **찾기**(Ctrl+F). 제목·메모·하위 항목·담당·프로젝트 이름에서 찾고, 낱말을 여럿 넣으면 모두 들어간 것만 보입니다. 메모에서 찾으면 그 메모 줄과 날짜를 함께 보여 줍니다. 검색어를 비우면 **완료한 일**이 최근 순으로 나오고, '30일 지난 완료(보관 파일)까지'를 켜면 옛 기록도 봅니다.
- **메모 고치기**: 상세의 메모 줄에서 ✎ 를 누르거나 글을 두 번 누릅니다. 적은 시각은 그대로 남습니다.
- **프로젝트 이름 바꾸기**: 프로젝트 소제목에 마우스를 올리면 나오는 '이름', 또는 이름을 두 번 누릅니다.
- **프로젝트 순서 바꾸기**: 소제목을 끌어 다른 프로젝트 위에 놓습니다(키보드는 Alt+↑↓). '미분류'는 늘 맨 끝입니다.
- **× 를 누르면 묻습니다**: 처음 한 번 **숨기기**(트레이에 남음)와 **종료** 중에 고르고, 그 선택을 기억합니다. 설정의 '× 버튼'에서 바꿀 수 있습니다.

## 고친 것
- **두 번 실행해도 위젯은 하나**: 이미 떠 있을 때 다시 실행하면 새로 뜨지 않고, 떠 있는(숨겨 둔) 위젯을 보여 줍니다. 전에는 위젯이 둘 뜨고 화면 예약도 두 배가 됐습니다.
- **상세 창이 다시 열리지 않던 문제**: 상세 창을 연 채 다른 곳을 누른 뒤에는 어떤 할 일을 눌러도 상세 창이 뜨지 않았습니다.
- **하위 항목 입력칸 닫기**: '하위 추가'로 연 입력칸을 Esc 로 닫거나, 비운 채 다른 곳을 누르면 닫힙니다.

## 그 밖에
- 포함한 오픈소스 구성요소와 라이선스를 `THIRD-PARTY-NOTICES.md` 로 함께 담았습니다(Pretendard 글꼴의 OFL 전문 포함).

---

# TODO.md v0.4.0 — find, edit memos, tidy up projects

## New
- **Find · past completions**: **Find** in the title bar (Ctrl+F). Searches titles, memos, sub-items, owners and project names; with several words, only items containing all of them show. A match in a memo shows that memo line and its date. With an empty search you see **what you completed**, most recent first; turn on "Include completions older than 30 days (archive)" to see older records too.
- **Edit memos**: click ✎ on a memo line in the details, or double-click the text. The time it was written stays.
- **Rename projects**: hover a project heading and click "Rename", or double-click the name.
- **Reorder projects**: drag a heading onto another project (keyboard: Alt+↑↓). "Unsorted" always stays last.
- **× asks once**: the first time, choose **Hide** (stays in the tray) or **Quit**; your choice is remembered. Change it under "× button" in Settings.

## Fixed
- **Only one widget, even if launched twice**: launching again while it runs now shows the existing (or hidden) widget instead of opening a second one that reserved the screen edge twice.
- **Details window would not reopen**: after opening the details and clicking elsewhere, clicking any to-do no longer opened them.
- **Closing the sub-item input**: the input opened with "Add sub-item" now closes with Esc, or when you click elsewhere while it is empty.

## Other
- Ships `THIRD-PARTY-NOTICES.md` listing the included open-source components and licenses (including the full OFL text for the Pretendard font).
