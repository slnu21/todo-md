import { describe, expect, it } from "vitest";
import { isPlainDate, weekdayIndex } from "../date";
import { KR_HOLIDAY_YEARS, KR_PUBLIC_HOLIDAYS, krHolidayDates } from "./kr";

describe("한국 공휴일 표", () => {
  it("2026·2027 이 있고 날짜가 전부 올바르며 그 해에 속한다", () => {
    expect(KR_HOLIDAY_YEARS).toEqual([2026, 2027]);
    for (const y of KR_HOLIDAY_YEARS) {
      for (const h of KR_PUBLIC_HOLIDAYS[y]) {
        expect(isPlainDate(h.date), h.date).toBe(true);
        expect(h.date.startsWith(`${y}-`), h.date).toBe(true);
        expect(h.name).toMatch(/\S/);
      }
    }
  });

  it("같은 날이 두 번 들어 있지 않고 날짜순이다", () => {
    for (const y of KR_HOLIDAY_YEARS) {
      const dates = KR_PUBLIC_HOLIDAYS[y].map((h) => h.date);
      expect(new Set(dates).size).toBe(dates.length);
      expect([...dates].sort()).toEqual(dates);
    }
  });

  it("대체공휴일은 평일이다 — 주말에 놓인 대체공휴일은 표가 틀린 것이다", () => {
    for (const y of KR_HOLIDAY_YEARS) {
      for (const h of KR_PUBLIC_HOLIDAYS[y]) {
        if (h.name.includes("대체공휴일")) {
          expect(weekdayIndex(h.date), `${h.name} ${h.date}`).toBeLessThan(5);
        }
      }
    }
  });

  it("고정 공휴일은 해마다 같은 날이거나 대체공휴일로 옮겨 있다", () => {
    // 규정상 토·일과 겹치면 대체하는 날들. 본래 날짜가 평일이면 그 날, 아니면 대체공휴일이 있어야 한다.
    const fixed: Array<[string, string]> = [
      ["03-01", "삼일절"],
      ["05-05", "어린이날"],
      ["08-15", "광복절"],
      ["10-03", "개천절"],
      ["10-09", "한글날"],
      ["12-25", "성탄절"],
    ];
    for (const y of KR_HOLIDAY_YEARS) {
      const names = new Map(KR_PUBLIC_HOLIDAYS[y].map((h) => [h.date, h.name]));
      for (const [md, name] of fixed) {
        const date = `${y}-${md}`;
        const weekend = weekdayIndex(date) >= 5;
        if (weekend) {
          expect([...names.values()].some((n) => n === `${name} 대체공휴일`), `${y} ${name}`).toBe(true);
        } else {
          expect(names.get(date), `${y} ${name}`).toBe(name);
        }
      }
    }
  });

  it("설·추석은 사흘 연휴다", () => {
    for (const y of KR_HOLIDAY_YEARS) {
      const list = KR_PUBLIC_HOLIDAYS[y];
      expect(list.filter((h) => h.name.startsWith("설날")).length).toBeGreaterThanOrEqual(3);
      expect(list.filter((h) => h.name.startsWith("추석")).length).toBe(3);
    }
  });

  it("krHolidayDates 는 주말과 겹치는 날을 뺀다 — 주5일에서 토요일 추석 연휴는 넣을 뜻이 없다", () => {
    const all = krHolidayDates([2026]);
    expect(all).not.toContain("2026-09-26"); // 토요일
    expect(all).toContain("2026-09-25");
    for (const d of all) expect(weekdayIndex(d)).toBeLessThan(5);
    // 주7일 캘린더면 전부 들어간다
    expect(krHolidayDates([2026], "1111111")).toHaveLength(KR_PUBLIC_HOLIDAYS[2026].length);
  });
});
