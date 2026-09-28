import { describe, expect, it } from "vitest";
import {
  addDays, dayDiff, isLocalStamp, isPlainDate, isoWeek, mondayOf, monthGrid, plainOf, stampOf, sundayIndex, weekdayIndex,
} from "./date";

describe("날짜 모양", () => {
  it("실제로 있는 날짜만 받는다", () => {
    expect(isPlainDate("2026-09-28")).toBe(true);
    expect(isPlainDate("2026-02-30")).toBe(false);
    expect(isPlainDate("2026-9-28")).toBe(false);
    expect(isPlainDate(20260928)).toBe(false);
  });
  it("시각은 분 단위 로컬 표기", () => {
    expect(isLocalStamp("2026-09-28T09:12")).toBe(true);
    expect(isLocalStamp("2026-09-28T24:00")).toBe(false);
    expect(isLocalStamp("2026-09-28T09:12:00")).toBe(false);
  });
  it("Date 에서 로컬 날짜·시각을 뽑는다", () => {
    const d = new Date(2026, 8, 28, 7, 5);
    expect(plainOf(d)).toBe("2026-09-28");
    expect(stampOf(d)).toBe("2026-09-28T07:05");
  });
});

describe("날짜 계산", () => {
  it("월·해를 넘어 더하고 뺀다", () => {
    expect(addDays("2026-09-28", 5)).toBe("2026-10-03");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(dayDiff("2026-09-28", "2026-09-26")).toBe(-2);
  });
  it("요일 — 2026-09-28 은 월요일", () => {
    expect(weekdayIndex("2026-09-28")).toBe(0);
    expect(sundayIndex("2026-09-27")).toBe(0);
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
  });
});

describe("달력 격자", () => {
  it("2026년 9월: 8/30(일)부터, 10/3 에서 끝나는 5줄", () => {
    const g = monthGrid(2026, 9);
    expect(g).toHaveLength(5);
    expect(g[0][0]).toBe("2026-08-30");
    expect(g[4][6]).toBe("2026-10-03");
    for (const row of g) expect(row).toHaveLength(7);
  });
  it("1일이 일요일이고 28일로 끝나는 2026년 2월은 4줄", () => {
    expect(monthGrid(2026, 2)).toHaveLength(4);
  });
});

describe("ISO 주", () => {
  it("평범한 주", () => expect(isoWeek("2026-09-28")).toEqual({ year: 2026, week: 40 }));
  it("연초가 전년 마지막 주에 속하는 경우", () => expect(isoWeek("2027-01-01")).toEqual({ year: 2026, week: 53 }));
  it("연말이 다음 해 1주에 속하는 경우", () => expect(isoWeek("2025-12-29")).toEqual({ year: 2026, week: 1 }));
});
