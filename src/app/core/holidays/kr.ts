// 출처: Cairn(slnu21/Cairn) app/core/holidays/kr.ts 를 복사 — 공용 패키지로 묶기엔 과해서(2026-09-28).
// 정부 고시가 바뀌면 두 곳을 같이 고친다.
/**
 * 한국 공휴일 — 「관공서의 공휴일에 관한 규정」 기준, 대체공휴일 포함.
 *
 * **왜 내장하나.** 캘린더의 `holidays` 는 v0.1 부터 있었지만 채우는 UI 가 없어 늘 비어 있었고,
 * 그래서 설·추석 연휴를 근무일로 세어 연휴를 낀 일정이 낙관적으로 나왔다. 프로젝트마다 손으로
 * 넣게 하면 아무도 안 넣는다.
 *
 * **대체공휴일 규칙**(2023 개정): 3·1절·광복절·개천절·한글날·어린이날·부처님오신날·성탄절은
 * 토·일과 겹치면 다음 비공휴일. **설·추석 연휴는 일요일이나 다른 공휴일과 겹칠 때만** — 토요일과
 * 겹쳐도 대체하지 않는다. 신정·현충일은 대체하지 않는다.
 *
 * 음력 명절은 해마다 달라 표로 든다. **정부 고시가 바뀌면(임시공휴일·선거일) 여기를 고친다** —
 * 화면에서도 "정부 고시로 확인하라"고 말한다.
 */

import { weekdayIndex, type PlainDate } from "../date";

export interface PublicHoliday {
  date: PlainDate;
  name: string;
}

export const KR_PUBLIC_HOLIDAYS: Readonly<Record<number, readonly PublicHoliday[]>> = {
  2026: [
    { date: "2026-01-01", name: "신정" },
    { date: "2026-02-16", name: "설날 연휴" },
    { date: "2026-02-17", name: "설날" },
    { date: "2026-02-18", name: "설날 연휴" },
    { date: "2026-03-02", name: "삼일절 대체공휴일" }, // 3/1 일요일
    { date: "2026-05-05", name: "어린이날" },
    { date: "2026-05-25", name: "부처님오신날 대체공휴일" }, // 5/24 일요일
    { date: "2026-06-03", name: "전국동시지방선거" },
    { date: "2026-08-17", name: "광복절 대체공휴일" }, // 8/15 토요일
    { date: "2026-09-24", name: "추석 연휴" },
    { date: "2026-09-25", name: "추석" },
    { date: "2026-09-26", name: "추석 연휴" }, // 토요일 — 설·추석은 토요일 겹침에 대체 없음
    { date: "2026-10-05", name: "개천절 대체공휴일" }, // 10/3 토요일
    { date: "2026-10-09", name: "한글날" },
    { date: "2026-12-25", name: "성탄절" },
  ],
  2027: [
    { date: "2027-01-01", name: "신정" },
    { date: "2027-02-05", name: "설날 연휴" },
    { date: "2027-02-06", name: "설날" },
    { date: "2027-02-07", name: "설날 연휴" },
    { date: "2027-02-08", name: "설날 대체공휴일" }, // 2/7 일요일
    { date: "2027-03-01", name: "삼일절" },
    { date: "2027-05-05", name: "어린이날" },
    { date: "2027-05-13", name: "부처님오신날" },
    { date: "2027-08-16", name: "광복절 대체공휴일" }, // 8/15 일요일
    { date: "2027-09-14", name: "추석 연휴" },
    { date: "2027-09-15", name: "추석" },
    { date: "2027-09-16", name: "추석 연휴" },
    { date: "2027-10-04", name: "개천절 대체공휴일" }, // 10/3 일요일
    { date: "2027-10-11", name: "한글날 대체공휴일" }, // 10/9 토요일
    { date: "2027-12-27", name: "성탄절 대체공휴일" }, // 12/25 토요일
  ],
};

export const KR_HOLIDAY_YEARS: readonly number[] = Object.keys(KR_PUBLIC_HOLIDAYS)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * 주어진 해들의 공휴일 날짜. **주말과 겹치는 날은 뺀다** — 근무일 캘린더에서 토·일은 이미
 * 쉬는 날이라 넣어도 뜻이 없고, 목록만 길어진다.
 */
export function krHolidayDates(years: readonly number[], weekMask = "1111100"): PlainDate[] {
  const out: PlainDate[] = [];
  for (const y of years) {
    for (const h of KR_PUBLIC_HOLIDAYS[y] ?? []) {
      if (weekMask[weekdayIndex(h.date)] === "1") out.push(h.date);
    }
  }
  return out;
}
