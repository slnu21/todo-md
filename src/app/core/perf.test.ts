/**
 * 파일 하나로 버티는가 — 합성 1만·5만 건으로 크기와 시간을 잰다(설계 때 추정: 1건 ≈ 1KB).
 * 수치는 콘솔에 찍고, 느려지는 회귀만 넉넉한 문턱으로 잡는다(기계마다 다르므로 빡빡하게 걸지 않는다).
 */
import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { reduce } from "./actions";
import { splitOldDone } from "./archive";
import { emptyData, type Item, type TodoData } from "./model";
import { buildReport, defaultReport } from "./report";
import { parseData, serializeData } from "./schema";
import { calendarMarks, listGroups } from "./select";

const TODAY = "2026-09-28";

/** n 건: 프로젝트 20개, 대부분 완료(오래된 것 포함), 미완료 150건, 할 일마다 메모 5줄·하위 2개. */
function synth(n: number): TodoData {
  const d = emptyData();
  for (let p = 0; p < 20; p++) d.projects.unshift({ id: `p${p}`, name: `프로젝트 ${p}` });
  for (let i = 0; i < n; i++) {
    const open = i < 150;
    const day = addDays(TODAY, -Math.floor((i / n) * 5 * 365)); // 5년에 걸쳐
    const item: Item = {
      id: `i${i}`, projectId: `p${i % 20}`, title: `할 일 ${i} — 거래처 회신 확인 후 견적서 수정해서 다시 보내기`,
      status: open ? (i % 3 === 0 ? "doing" : "todo") : "done", importance: ((i % 3) + 1) as 1 | 2 | 3,
      assignee: i % 7 === 0 ? "김 책임" : "", due: open ? addDays(TODAY, (i % 20) - 5) : day,
      createdAt: `${day}T09:00`, startedAt: `${day}T10:00`, doneAt: open ? null : `${day}T17:00`,
      subs: [{ id: `s${i}a`, title: "초안", done: true }, { id: `s${i}b`, title: "검토 요청", done: open }],
      memos: Array.from({ length: 5 }, (_, k) => ({ id: `m${i}_${k}`, at: `${day}T1${k}:00`, text: `진행 메모 ${k} — 담당자와 통화, 다음 주 화요일까지 회신 받기로` })),
    };
    d.items.push(item);
  }
  return d;
}

function time<T>(fn: () => T): [T, number] {
  const t0 = performance.now();
  const r = fn();
  return [r, Math.round((performance.now() - t0) * 10) / 10];
}

describe("성능 — 합성 데이터", () => {
  for (const n of [10_000, 50_000]) {
    it(`${n.toLocaleString()} 건`, () => {
      const data = synth(n);
      const [text, tSer] = time(() => serializeData(data));
      const [parsed, tParse] = time(() => parseData(text));
      const [, tList] = time(() => listGroups(data, TODAY));
      const [, tMarks] = time(() => calendarMarks(data, TODAY));
      const [, tReport] = time(() => buildReport(data, defaultReport("ko"), TODAY, "ko"));
      const [, tReduce] = time(() => reduce(data, { type: "cycleStatus", id: "i0" }, { now: `${TODAY}T09:00`, newId: () => "x" }));
      const [split] = time(() => splitOldDone(data, TODAY));
      const keptText = serializeData(split.keep);
      const mb = (s: string) => Math.round((new TextEncoder().encode(s).length / 1024 / 1024) * 100) / 100;
      console.log(
        `[perf] ${n}건: 파일 ${mb(text)}MB (1건 ${Math.round(new TextEncoder().encode(text).length / n)}B) · 직렬화 ${tSer}ms · 읽기 ${tParse}ms · ` +
          `목록 ${tList}ms · 달력 ${tMarks}ms · 보고 ${tReport}ms · 변경 1회 ${tReduce}ms · ` +
          `보관 분리 후 평소 파일 ${mb(keptText)}MB(${split.keep.items.length}건)`,
      );
      expect(parsed.ok).toBe(true);
      // 넉넉한 회귀 문턱: 5만 건에서도 읽기·쓰기 각 3초, 화면 계산 0.5초 안.
      expect(tSer + tParse).toBeLessThan(6000);
      expect(tList + tMarks + tReport + tReduce).toBeLessThan(2000);
    });
  }
});
