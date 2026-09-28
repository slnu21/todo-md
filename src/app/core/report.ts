/**
 * 주간보고 — 할 일과 메모 기록을 마크다운(또는 일반 텍스트)으로.
 *
 * **규칙의 실체는 템플릿 다섯 줄**(섹션·묶음·할 일·하위·메모)이다. 간단 설정은 그 템플릿을 대신 써 주는
 * 도구(`genTemplates`)일 뿐이라, 간단 설정으로 시작했다가 템플릿을 직접 고쳐도 규칙이 두 벌로 갈라지지 않는다.
 *
 * 무엇이 어디에 들어가나(CLAUDE.md 확정 결정):
 * - 실적 = 기간 안 완료 + 진행 중 + 기간 안 메모가 있는 할 일. 메모는 실적에만.
 * - 계획 = 진행 중 + 다음 7일 안 마감 + 이미 지난 마감(미완료). 진행 중은 둘 다.
 * - 보관한 프로젝트: 기간 안 완료는 실적에 남고, 미완료는 실적·계획 모두 제외.
 * - 주 시작 = 월요일. 마크다운 특수문자는 이스케이프하지 않는다.
 */
import { addDays, dateOfStamp, mondayOf, pad2, timeOfStamp, weekdayIndex, type PlainDate } from "./date";
import type { Lang } from "./i18n";
import { INBOX_ID, type Item, type Status, type TodoData } from "./model";
import { compareItems, isArchived } from "./select";

export type RangeKind = "7d" | "week" | "lastweek";
export type PresetKey = "md" | "brief" | "mail";

export interface Templates {
  sec: string;
  group: string;
  line: string;
  sub: string;
  memo: string;
}

export interface ReportRules {
  /** 마지막으로 고른 프리셋. 규칙을 손대면 "" (어느 프리셋도 아님). */
  preset: PresetKey | "";
  range: RangeKind;
  actual: boolean;
  plan: boolean;
  actualTitle: string;
  planTitle: string;
  group: "project" | "status";
  pos: "front" | "back" | "none";
  date: "auto" | "due" | "none";
  /** 날짜 형식 토큰: YYYY MM M DD D ddd MMM */
  fmt: string;
  subs: "none" | "progress" | "open" | "all";
  subStyle: "check" | "plain";
  memos: "none" | "range" | "recent" | "all";
  memoN: number;
  memoTime: "datetime" | "date" | "none";
  /** true 면 `tpl` 을 그대로 쓴다(직접 편집). */
  custom: boolean;
  tpl: Templates | null;
  labels: Record<Status, string>;
}

const WORDS: Record<Lang, { actual: string; plan: string; gDone: string; gDoing: string; gTodo: string; imp: string; inbox: string }> = {
  ko: { actual: "금주 실적", plan: "차주 계획", gDone: "완료", gDoing: "진행 중", gTodo: "예정", imp: "중요", inbox: "미분류" },
  en: { actual: "This week", plan: "Next week", gDone: "Done", gDoing: "In progress", gTodo: "Planned", imp: "Important", inbox: "Unsorted" },
};

/** 날짜 형식 선택지(언어별). 같은 칸끼리 대응 — 언어를 바꾸면 같은 칸으로 옮긴다. */
export const DATE_FORMATS: Record<Lang, { fmt: string; sample: string }[]> = {
  ko: [
    { fmt: "M/D", sample: "9/28" }, { fmt: "MM.DD", sample: "09.28" }, { fmt: "M월 D일", sample: "9월 28일" },
    { fmt: "M/D(ddd)", sample: "9/28(월)" }, { fmt: "YYYY-MM-DD", sample: "2026-09-28" },
  ],
  en: [
    { fmt: "M/D", sample: "9/28" }, { fmt: "MM.DD", sample: "09.28" }, { fmt: "MMM D", sample: "Sep 28" },
    { fmt: "ddd M/D", sample: "Mon 9/28" }, { fmt: "YYYY-MM-DD", sample: "2026-09-28" },
  ],
};

function labelsFor(lang: Lang, preset: PresetKey): Record<Status, string> {
  if (lang === "en") {
    if (preset === "brief") return { done: "(done)", doing: "(doing)", todo: "(to do)" };
    if (preset === "mail") return { done: "Done", doing: "Doing", todo: "To do" };
    return { done: "[Done]", doing: "[Doing]", todo: "[To do]" };
  }
  if (preset === "brief") return { done: "(완료)", doing: "(진행)", todo: "(예정)" };
  if (preset === "mail") return { done: "완료", doing: "진행", todo: "예정" };
  return { done: "[완료]", doing: "[진행]", todo: "[예정]" };
}

type PresetPart = Omit<ReportRules, "preset" | "range" | "actual" | "plan" | "actualTitle" | "planTitle">;

export function presetFor(key: PresetKey, lang: Lang): PresetPart {
  const base = {
    md: { custom: false, pos: "front", date: "auto", fmt: "M/D", subs: "progress", subStyle: "check", memos: "range", memoN: 2, memoTime: "datetime", group: "project", tpl: null },
    brief: { custom: false, pos: "back", date: "auto", fmt: "M/D", subs: "none", subStyle: "plain", memos: "none", memoN: 1, memoTime: "none", group: "project", tpl: null },
    mail: {
      custom: true, pos: "back", date: "auto", fmt: lang === "en" ? "MMM D" : "M월 D일", subs: "open", subStyle: "plain", memos: "recent", memoN: 1, memoTime: "date", group: "project",
      tpl: {
        sec: "■ {section} ({range})",
        group: "▶ {group}",
        line: lang === "en" ? "  - {title}{? [{status}]}{? done {done}}{? due {due}}" : "  - {title}{? [{status}]}{? {done} 완료}{? ~{due}}",
        sub: "      · {title}",
        memo: "      └ {date} {text}",
      },
    },
  }[key] as Omit<PresetPart, "labels">;
  return { ...base, labels: labelsFor(lang, key) };
}

export function defaultReport(lang: Lang): ReportRules {
  return {
    preset: "md", range: "7d", actual: true, plan: true, actualTitle: WORDS[lang].actual, planTitle: WORDS[lang].plan,
    ...presetFor("md", lang),
  };
}

/** 언어를 바꿀 때 **기본값인 것만** 새 언어로 옮긴다. 직접 고친 값은 사용자의 것이다. */
export function relocalize(r: ReportRules, from: Lang, to: Lang): ReportRules {
  if (from === to) return r;
  const next = { ...r };
  if (r.actualTitle === WORDS[from].actual) next.actualTitle = WORDS[to].actual;
  if (r.planTitle === WORDS[from].plan) next.planTitle = WORDS[to].plan;
  for (const k of ["md", "brief", "mail"] as const) {
    if (JSON.stringify(r.labels) === JSON.stringify(labelsFor(from, k))) next.labels = labelsFor(to, k);
  }
  const idx = DATE_FORMATS[from].findIndex((f) => f.fmt === r.fmt);
  if (idx >= 0) next.fmt = DATE_FORMATS[to][idx].fmt;
  if (r.preset === "mail" && r.custom) next.tpl = presetFor("mail", to).tpl;
  return next;
}

/** 간단 설정 → 템플릿. */
export function genTemplates(r: ReportRules): Templates {
  const head = r.group === "status" ? "{project} / {title}" : "{title}";
  let line = "- " + (r.pos === "front" ? "{status} " + head : r.pos === "back" ? head + " {status}" : head);
  if (r.subs === "progress") line += "{? [{progress}]}";
  if (r.date === "auto") line += "{? ({done})}{? (~{due})}";
  else if (r.date === "due") line += "{? (~{due})}";
  return {
    sec: "## {section} ({range})",
    group: "### {group}",
    line,
    sub: r.subStyle === "check" ? "  - [{check}] {title}" : "  - {title}",
    memo: r.memoTime === "datetime" ? "  - {date} {time} {text}" : r.memoTime === "date" ? "  - {date} {text}" : "  - {text}",
  };
}

export const templatesOf = (r: ReportRules): Templates => (r.custom && r.tpl ? r.tpl : genTemplates(r));

/**
 * 템플릿 채우기. `{key}` 는 값으로, `{? … }` 는 안에 든 값이 하나라도 비면 통째로 뺀다.
 * 줄 머리 들여쓰기는 지키고, 안쪽의 겹친 공백만 한 칸으로 접는다. 줄 끝 공백은 지운다.
 */
export function fill(tpl: string, v: Record<string, string>): string {
  let out = "";
  let i = 0;
  while (i < tpl.length) {
    if (tpl.startsWith("{?", i)) {
      let depth = 1;
      let j = i + 2;
      while (j < tpl.length && depth) {
        if (tpl[j] === "{") depth++;
        else if (tpl[j] === "}") depth--;
        j++;
      }
      let empty = false;
      const inner = tpl.slice(i + 2, j - 1).replace(/\{(\w+)\}/g, (_, k: string) => {
        const x = v[k];
        if (!x) empty = true;
        return x ?? "";
      });
      if (!empty) out += inner;
      i = j;
    } else if (tpl[i] === "{" && tpl.indexOf("}", i) > i) {
      const k = tpl.indexOf("}", i);
      out += v[tpl.slice(i + 1, k)] ?? "";
      i = k + 1;
    } else {
      out += tpl[i];
      i++;
    }
  }
  return out.replace(/(\S) {2,}/g, "$1 ").replace(/\s+$/, "");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW: Record<Lang, string[]> = { ko: ["월", "화", "수", "목", "금", "토", "일"], en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] };

/** 날짜 형식. 긴 토큰부터 자리표시로 바꾼 뒤 한 번에 채운다 — 'MMM' 을 'M' 이 먼저 먹거나 채운 월 이름이 다시 토큰으로 읽히지 않게. */
export function fmtDate(s: string, f: string, lang: Lang): string {
  if (!s) return "";
  const mo = +s.slice(5, 7);
  const d = +s.slice(8, 10);
  const dow = DOW[lang][weekdayIndex(s.slice(0, 10))];
  return f
    .replace("YYYY", "\u0001").replace("MMM", "\u0002").replace("MM", "\u0003").replace("DD", "\u0004")
    .replace("ddd", "\u0005").replace("M", "\u0006").replace("D", "\u0007")
    .replace("\u0001", s.slice(0, 4)).replace("\u0002", MONTHS[mo - 1]).replace("\u0003", pad2(mo))
    .replace("\u0004", pad2(d)).replace("\u0005", dow).replace("\u0006", String(mo)).replace("\u0007", String(d));
}

export function rangeOf(kind: RangeKind, today: PlainDate): { start: PlainDate; end: PlainDate } {
  if (kind === "7d") return { start: addDays(today, -6), end: today };
  const mon = addDays(mondayOf(today), kind === "lastweek" ? -7 : 0);
  return { start: mon, end: addDays(mon, 6) };
}

export interface ReportResult {
  text: string;
  actualCount: number;
  planCount: number;
}

export function buildReport(data: TodoData, r: ReportRules, today: PlainDate, lang: Lang): ReportResult {
  const T = templatesOf(r);
  const R = rangeOf(r.range, today);
  const planEnd = addDays(today, 7);
  const out: string[] = [];
  const inR = (stamp: string | null) => {
    if (!stamp) return false;
    const d = dateOfStamp(stamp);
    return d >= R.start && d <= R.end;
  };
  const projectName = (id: string) => (id === INBOX_ID ? WORDS[lang].inbox : data.projects.find((p) => p.id === id)?.name ?? "");
  const active = (i: Item) => !isArchived(data, i.projectId);

  const actual = data.items.filter((i) => {
    if (i.status === "done") return inR(i.doneAt);
    if (!active(i)) return false;
    return i.status === "doing" || i.memos.some((m) => inR(m.at));
  });
  const plan = data.items.filter((i) => active(i) && i.status !== "done" && (i.status === "doing" || (!!i.due && i.due <= planEnd)));

  const vals = (it: Item): Record<string, string> => {
    const done = it.status === "done";
    return {
      status: r.labels[it.status],
      title: it.title,
      done: done && it.doneAt ? fmtDate(it.doneAt, r.fmt, lang) : "",
      due: !done && it.due ? fmtDate(it.due, r.fmt, lang) : "",
      started: it.startedAt ? fmtDate(it.startedAt, r.fmt, lang) : "",
      project: projectName(it.projectId),
      who: it.assignee,
      progress: it.subs.length ? `${it.subs.filter((s) => s.done).length}/${it.subs.length}` : "",
      imp: it.importance === 3 ? WORDS[lang].imp : "",
    };
  };

  const emitItem = (it: Item, withMemos: boolean) => {
    out.push(fill(T.line, vals(it)));
    if (r.subs === "open" || r.subs === "all") {
      for (const s of it.subs) if (r.subs === "all" || !s.done) out.push(fill(T.sub, { check: s.done ? "x" : " ", title: s.title }));
    }
    if (withMemos && r.memos !== "none") {
      let ms = it.memos.filter((m) => r.memos === "all" || inR(m.at));
      if (r.memos === "recent") ms = ms.slice(-Math.max(1, r.memoN || 1));
      for (const m of ms) out.push(fill(T.memo, { date: fmtDate(m.at, r.fmt, lang), time: timeOfStamp(m.at), text: m.text }));
    }
  };

  const emitSection = (title: string, rangeText: string, items: Item[], withMemos: boolean) => {
    if (!items.length) return;
    if (out.length) out.push("");
    out.push(fill(T.sec, { section: title, range: rangeText }));
    const groups: { name: string; items: Item[] }[] = [];
    if (r.group === "status") {
      const names: Record<Status, string> = { done: WORDS[lang].gDone, doing: WORDS[lang].gDoing, todo: WORDS[lang].gTodo };
      for (const s of ["done", "doing", "todo"] as const) {
        const g = items.filter((i) => i.status === s);
        if (g.length) groups.push({ name: names[s], items: g });
      }
    } else {
      // 프로젝트 순서 = 파일 순서(만든 순). 미분류는 끝.
      const order = [...data.projects.filter((p) => p.id !== INBOX_ID), ...data.projects.filter((p) => p.id === INBOX_ID)];
      for (const p of order) {
        const g = items.filter((i) => i.projectId === p.id);
        if (g.length) groups.push({ name: projectName(p.id), items: g });
      }
    }
    for (const g of groups) {
      out.push("");
      out.push(fill(T.group, { group: g.name }));
      for (const it of [...g.items].sort(compareItems)) emitItem(it, withMemos);
    }
  };

  if (r.actual) emitSection(r.actualTitle, `${fmtDate(R.start, r.fmt, lang)} ~ ${fmtDate(R.end, r.fmt, lang)}`, actual, true);
  if (r.plan) emitSection(r.planTitle, `${fmtDate(addDays(today, 1), r.fmt, lang)} ~ ${fmtDate(planEnd, r.fmt, lang)}`, plan, false);
  return { text: out.join("\n"), actualCount: r.actual ? actual.length : 0, planCount: r.plan ? plan.length : 0 };
}

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const shortStr = (v: unknown, fallback: string, max = 300): string =>
  typeof v === "string" && v.length <= max ? v : fallback;

/**
 * 파일에 저장된 규칙 읽기(fail-soft). 객체가 아니면 null(= 기본값을 쓴다). 필드 하나가 틀리면 그 필드만 기본값으로.
 * 템플릿 문자열은 길이만 제한한다 — 출력은 텍스트로만 쓰이고 HTML 로 해석되지 않는다.
 */
export function parseReportRules(raw: unknown): ReportRules | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const d = defaultReport("ko");
  const labels = (typeof r.labels === "object" && r.labels !== null ? r.labels : {}) as Record<string, unknown>;
  const tplRaw = (typeof r.tpl === "object" && r.tpl !== null ? r.tpl : null) as Record<string, unknown> | null;
  const tpl: Templates | null = tplRaw
    ? { sec: shortStr(tplRaw.sec, ""), group: shortStr(tplRaw.group, ""), line: shortStr(tplRaw.line, ""), sub: shortStr(tplRaw.sub, ""), memo: shortStr(tplRaw.memo, "") }
    : null;
  const memoN = typeof r.memoN === "number" && Number.isFinite(r.memoN) ? Math.min(20, Math.max(1, Math.round(r.memoN))) : d.memoN;
  return {
    preset: oneOf(r.preset, ["md", "brief", "mail", ""], ""),
    range: oneOf(r.range, ["7d", "week", "lastweek"], d.range),
    actual: typeof r.actual === "boolean" ? r.actual : d.actual,
    plan: typeof r.plan === "boolean" ? r.plan : d.plan,
    actualTitle: shortStr(r.actualTitle, d.actualTitle, 80),
    planTitle: shortStr(r.planTitle, d.planTitle, 80),
    group: oneOf(r.group, ["project", "status"], d.group),
    pos: oneOf(r.pos, ["front", "back", "none"], d.pos),
    date: oneOf(r.date, ["auto", "due", "none"], d.date),
    fmt: shortStr(r.fmt, d.fmt, 40) || d.fmt,
    subs: oneOf(r.subs, ["none", "progress", "open", "all"], d.subs),
    subStyle: oneOf(r.subStyle, ["check", "plain"], d.subStyle),
    memos: oneOf(r.memos, ["none", "range", "recent", "all"], d.memos),
    memoN,
    memoTime: oneOf(r.memoTime, ["datetime", "date", "none"], d.memoTime),
    custom: r.custom === true && tpl !== null,
    tpl,
    labels: {
      done: shortStr(labels.done, d.labels.done, 40),
      doing: shortStr(labels.doing, d.labels.doing, 40),
      todo: shortStr(labels.todo, d.labels.todo, 40),
    },
  };
}
