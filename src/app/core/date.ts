/**
 * 날짜·시각. **문자열만 다룬다** — 상태에 `Date` 객체를 넣지 않아 시간대 버그를 원천 차단한다(Cairn 과 같은 규칙).
 *
 * - `PlainDate` = `YYYY-MM-DD` (마감일·달력)
 * - `LocalStamp` = `YYYY-MM-DDTHH:mm` 로컬 시각 (메모·착수·완료·만든 시각). 초와 시간대를 두지 않는다 —
 *   "몇 시 몇 분에 적었나"가 필요한 전부이고, 시간대를 넣으면 PC 를 옮길 때 기록이 밀린다.
 *
 * 날짜 계산은 UTC 에포크 일수로 한다 — 로컬 자정·서머타임에 흔들리지 않게.
 */

export type PlainDate = string;
export type LocalStamp = string;

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STAMP_SHAPE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export const pad2 = (n: number): string => String(n).padStart(2, "0");

export function isPlainDate(s: unknown): s is PlainDate {
  if (typeof s !== "string") return false;
  const m = DATE_SHAPE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function isLocalStamp(s: unknown): s is LocalStamp {
  if (typeof s !== "string") return false;
  const m = STAMP_SHAPE.exec(s);
  return !!m && isPlainDate(s.slice(0, 10)) && +m[4] < 24 && +m[5] < 60;
}

/** 로컬 시계로 본 날짜. */
export function plainOf(d: Date): PlainDate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 로컬 시계로 본 시각(분 단위). */
export function stampOf(d: Date): LocalStamp {
  return `${plainOf(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export const dateOfStamp = (s: LocalStamp): PlainDate => s.slice(0, 10);
export const timeOfStamp = (s: LocalStamp): string => s.slice(11, 16);

function toEpochDay(d: PlainDate): number {
  const m = DATE_SHAPE.exec(d);
  if (!m) throw new RangeError(`YYYY-MM-DD 형식이 아니다: ${JSON.stringify(d)}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / MS_PER_DAY;
}

function fromEpochDay(n: number): PlainDate {
  const t = new Date(n * MS_PER_DAY);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

export const addDays = (d: PlainDate, n: number): PlainDate => fromEpochDay(toEpochDay(d) + n);

/** `to - from` 일수. 마감까지 남은 날(음수 = 지남). */
export const dayDiff = (from: PlainDate, to: PlainDate): number => toEpochDay(to) - toEpochDay(from);

/** 월=0 … 일=6. Cairn 과 같은 기준(공휴일 모듈이 쓴다). */
export const weekdayIndex = (d: PlainDate): number => (new Date(toEpochDay(d) * MS_PER_DAY).getUTCDay() + 6) % 7;

/** 일=0 … 토=6. 달력 칸 순서(일요일 시작). */
export const sundayIndex = (d: PlainDate): number => new Date(toEpochDay(d) * MS_PER_DAY).getUTCDay();

/** 그 주의 월요일. 주간보고의 '이번 주'는 월~일. */
export const mondayOf = (d: PlainDate): PlainDate => addDays(d, -weekdayIndex(d));

/**
 * 달력 격자 — 일요일 시작, 7칸씩. 첫 줄은 그 달 1일이 든 주, 다음 달 날짜만 있는 마지막 줄은 뺀다.
 * `month` 는 1~12.
 */
export function monthGrid(year: number, month: number): PlainDate[][] {
  const first = `${year}-${pad2(month)}-01`;
  let cur = addDays(first, -sundayIndex(first));
  const rows: PlainDate[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: PlainDate[] = [];
    for (let c = 0; c < 7; c++) { row.push(cur); cur = addDays(cur, 1); }
    if (r > 0 && +row[0].slice(5, 7) !== month) break;
    rows.push(row);
  }
  return rows;
}

/** ISO 8601 주 번호(월요일 시작, 그 해 첫 목요일이 든 주가 1주). 연말·연초에 해가 달라진다. */
export function isoWeek(d: PlainDate): { year: number; week: number } {
  const thursday = addDays(d, 3 - weekdayIndex(d));
  const year = +thursday.slice(0, 4);
  const week = Math.floor(dayDiff(`${year}-01-01`, thursday) / 7) + 1;
  return { year, week };
}
