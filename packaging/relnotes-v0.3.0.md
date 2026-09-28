# TODO.md v0.3.0 — 화면 한쪽에 붙는 위젯

위젯이 작업 표시줄처럼 화면 한쪽을 차지해, 최대화한 다른 창도 위젯을 덮지 않습니다.

## 새로 생긴 것
- **도킹**: 화면 한쪽을 예약합니다. 설정의 모니터 그림에서 **모니터와 왼쪽·오른쪽 가장자리**를 고릅니다. 높이는 늘 작업 영역 전체이고, 해상도·배율·작업 표시줄이 바뀌면 다시 맞춥니다. 도킹한 모니터가 연결 해제되면 주 모니터의 같은 쪽으로 옮깁니다.
- **떠 있기**: 화면을 예약하지 않고 항상 위에 뜹니다(가장자리에서 살짝 띄움).
- **폭 조절**: 300~440px.
- **할 일 상세가 별도 창으로**: 위젯 옆, 누른 할 일 높이에 뜹니다. 바깥을 누르거나 Esc 를 누르면 닫힙니다.
- **트레이 아이콘**: 왼쪽 클릭 = 보이기/숨기기, 메뉴 = 보이기/숨기기 · 종료. 위젯의 × 는 트레이로 숨기기입니다. 작업 표시줄에는 버튼이 없습니다.
- **로그인 시 자동 실행**: 설정에서 켭니다(기본은 꺼짐 — 포터블 exe 를 옮기면 경로가 바뀌므로, 둘 자리에 둔 뒤 켜세요).

## 안전장치
- 숨기거나 끝내면 예약을 반드시 풉니다(창 닫힘 · 앱 종료 · 오류 종료 세 곳). 데스크톱에 빈 띠가 남지 않습니다.

---

# TODO.md v0.3.0 — docks to the edge of your screen

The widget now reserves a strip of the screen like the taskbar, so even maximized windows never cover it.

## New
- **Dock**: reserve one edge of the screen. Pick the **monitor and the left or right edge** in the monitor picture in Settings. The height always matches the work area and re-fits when resolution, scaling or the taskbar changes. If that monitor is disconnected, it moves to the same side of the primary monitor.
- **Float**: always on top without reserving space (set slightly in from the edge).
- **Width**: 300–440 px.
- **To-do details in their own window**: next to the widget, at the height of the to-do you clicked. Click outside or press Esc to close.
- **Tray icon**: left click shows or hides; the menu has Show/hide and Quit. The widget's × hides to the tray. No taskbar button.
- **Launch at sign-in**: turn it on in Settings (off by default — a portable exe changes path when moved, so place it first, then turn this on).

## Safety
- Hiding or quitting always releases the reserved strip (on window close, app exit and crash). No empty band is left on the desktop.
