# TODO.md v0.6.0 — 다른 프로젝트로 옮기기 · 고배율 화면

## 새로 생긴 것
- **할 일을 다른 프로젝트로 옮기기**: 할 일을 눌러 연 상세 창에서 위쪽의 프로젝트 이름을 누르고 고르면 됩니다. 미분류로 급히 적은 일을 나중에 제자리로 보낼 수 있고, 상태·메모 기록·하위 항목은 그대로 따라갑니다.

## 고친 것
- 배율이 100% 가 아닌 화면(125%·150% 등)과 **모니터마다 배율이 다른** 환경에서:
  - 앱이 켜진 채 배율이나 해상도를 바꾸면 위젯이 화면 끝에서 떨어져 붙고 빈 띠가 남던 문제.
  - 상세 창이 위젯보다 크게(1.5배) 뜨던 문제.
  - 주간보고 창이 늘 주 모니터에 뜨고, 작은 화면에서는 창이 화면 밖으로 넘치던 문제 — 이제 위젯이 있는 모니터 가운데에, 화면에 맞는 크기로 뜹니다.

---

# TODO.md v0.6.0 — move to another project · high-DPI screens

## New
- **Move a to-do to another project**: open a to-do, click the project name at the top of the details and pick one. Things jotted into Unsorted in a hurry can go where they belong later; status, memo log and sub-items come along.

## Fixed
- On scaled displays (125%, 150%, …) and with **monitors at different scales**:
  - Changing the scale or resolution while the app was running left the widget detached from the screen edge with an empty strip.
  - The details window opened larger than intended (1.5×).
  - The weekly report window always opened on the primary monitor and could overflow small screens — it now opens centered on the widget's monitor, sized to fit.
