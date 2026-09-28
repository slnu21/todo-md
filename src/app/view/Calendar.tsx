/**
 * 작은 달력. 오늘 = 형광펜, 고른 날 = 파란 동그라미, 점 = 그날 마감(빨강 지남 · 파랑 중요 높음),
 * 일요일·공휴일 = 빨간 글자. 날짜를 누르면 목록이 그날 마감으로 좁혀진다(다시 누르면 해제).
 */
import { useMemo } from "react";
import { monthGrid, plainOf, type PlainDate } from "../core/date";
import { KR_PUBLIC_HOLIDAYS } from "../core/holidays/kr";
import { DOW_SHORT, mdLabel, monthTitle } from "../core/i18n";
import type { TodoData } from "../core/model";
import { calendarMarks, weekRowIndex } from "../core/select";
import { Seg, useT } from "./ui";

export interface CalView {
  year: number;
  month: number;
  week: boolean;
}

export function Calendar({
  data, today, selDate, view, onView, onPick,
}: {
  data: TodoData;
  today: PlainDate;
  selDate: PlainDate | "";
  view: CalView;
  onView: (v: CalView) => void;
  onPick: (d: PlainDate) => void;
}) {
  const { lang, t } = useT();
  const marks = useMemo(() => calendarMarks(data, today), [data, today]);
  const holidays = useMemo(() => {
    const m = new Map<string, string>();
    for (const y of [view.year - 1, view.year, view.year + 1]) for (const h of KR_PUBLIC_HOLIDAYS[y] ?? []) m.set(h.date, h.name);
    return m;
  }, [view.year]);

  const grid = monthGrid(view.year, view.month);
  const rows = view.week ? [grid[weekRowIndex(grid, selDate || today)]] : grid;
  const shift = (delta: number) => {
    const idx = view.year * 12 + (view.month - 1) + delta;
    onView({ ...view, year: Math.floor(idx / 12), month: (idx % 12) + 1 });
  };
  const goToday = () => {
    const d = new Date();
    onView({ ...view, year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  return (
    <div className="cal" data-testid="calendar">
      <div className="cal-head">
        <span className="m">{monthTitle(lang, view.year, view.month)}</span>
        <button type="button" className="cal-nav" aria-label={t("cal.prev")} onClick={() => shift(-1)}>‹</button>
        <button type="button" className="cal-nav" onClick={goToday}>{t("cal.today")}</button>
        <button type="button" className="cal-nav" aria-label={t("cal.next")} onClick={() => shift(1)}>›</button>
        <Seg
          items={[{ v: "m", label: t("cal.m") }, { v: "w", label: t("cal.w") }]}
          value={view.week ? "w" : "m"}
          onPick={(v) => {
            if (v === "w") {
              // 주 보기는 고른 날(없으면 오늘)이 든 주 — 그 달로 옮겨 간다.
              const f = selDate || plainOf(new Date());
              onView({ year: +f.slice(0, 4), month: +f.slice(5, 7), week: true });
            } else onView({ ...view, week: false });
          }}
        />
      </div>
      <div className="grid">
        {DOW_SHORT[lang].map((d, i) => (
          <span key={i} className={"dow" + (i === 0 ? " sun" : "")}>{d}</span>
        ))}
        {rows.flat().map((d, i) => {
          const mk = marks.get(d);
          const holiday = holidays.get(d);
          const cls = ["day"];
          if (i % 7 === 0) cls.push("sun");
          if (holiday) cls.push("holiday");
          if (+d.slice(5, 7) !== view.month) cls.push("other");
          if (d === today) cls.push("today");
          if (d === selDate) cls.push("sel");
          const aria = mdLabel(lang, d) + (holiday ? t("cal.holiday", { name: holiday }) : "") + (mk ? t("cal.hasDue") : "");
          return (
            <button key={d} type="button" className={cls.join(" ")} aria-pressed={d === selDate} aria-label={aria} title={holiday} onClick={() => onPick(d)}>
              <span className="n">{+d.slice(8, 10)}</span>
              {mk && <span className={"dot" + (mk.late ? " late" : mk.high ? " hi" : "")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
