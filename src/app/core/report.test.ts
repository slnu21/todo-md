import { describe, expect, it } from "vitest";
import { emptyData, type Item } from "./model";
import {
  buildReport, defaultReport, fill, fmtDate, genTemplates, presetFor, rangeOf, relocalize, templatesOf, type ReportRules,
} from "./report";
import { sampleData } from "./sample";

const TODAY = "2026-09-28"; // 월요일
const data = sampleData(TODAY);

describe("템플릿 채우기", () => {
  it("{key} 는 값으로, {? … } 는 값이 비면 통째로 빠진다", () => {
    expect(fill("- {status} {title}{? ({done})}", { status: "[완료]", title: "A", done: "9/27" })).toBe("- [완료] A (9/27)");
    expect(fill("- {status} {title}{? ({done})}", { status: "[예정]", title: "A", done: "" })).toBe("- [예정] A");
    expect(fill("{? ~{due} ({who})}", { due: "9/30", who: "" })).toBe("");
  });
  it("줄 머리 들여쓰기는 지키고 안쪽 겹친 공백·줄 끝 공백은 정리한다", () => {
    expect(fill("  - {a}  {b} {c}", { a: "x", b: "", c: "" })).toBe("  - x");
    expect(fill("      · {title}", { title: "t" })).toBe("      · t");
  });
  it("모르는 값은 빈칸", () => expect(fill("[{nope}]", {})).toBe("[]"));
});

describe("간단 설정 → 템플릿", () => {
  it("마크다운 기본", () => {
    expect(genTemplates(defaultReport("ko"))).toEqual({
      sec: "## {section} ({range})",
      group: "### {group}",
      line: "- {status} {title}{? [{progress}]}{? ({done})}{? (~{due})}",
      sub: "  - [{check}] {title}",
      memo: "  - {date} {time} {text}",
    });
  });
  it("상태 표시 위치 — 제목 뒤 / 넣지 않음, 상태별 묶음이면 프로젝트를 붙인다", () => {
    const r = defaultReport("ko");
    expect(genTemplates({ ...r, pos: "back", subs: "none", date: "none" }).line).toBe("- {title} {status}");
    expect(genTemplates({ ...r, pos: "none", group: "status", subs: "none", date: "due" }).line).toBe("- {project} / {title}{? (~{due})}");
  });
  it("직접 편집이면 저장된 템플릿을 그대로 쓴다", () => {
    const r: ReportRules = { ...defaultReport("ko"), custom: true, tpl: { sec: "S", group: "G", line: "L", sub: "U", memo: "M" } };
    expect(templatesOf(r).line).toBe("L");
  });
});

describe("날짜 형식·기간", () => {
  it("형식 토큰", () => {
    expect(fmtDate("2026-09-28", "M/D", "ko")).toBe("9/28");
    expect(fmtDate("2026-09-28T09:12", "MM.DD", "ko")).toBe("09.28");
    expect(fmtDate("2026-09-28", "M월 D일", "ko")).toBe("9월 28일");
    expect(fmtDate("2026-09-28", "M/D(ddd)", "ko")).toBe("9/28(월)");
    expect(fmtDate("2026-10-04", "MMM D", "en")).toBe("Oct 4");
    expect(fmtDate("2026-09-28", "ddd M/D", "en")).toBe("Mon 9/28");
    expect(fmtDate("2026-09-28", "YYYY-MM-DD", "en")).toBe("2026-09-28");
  });
  it("최근 7일 · 이번 주(월~일) · 지난주", () => {
    expect(rangeOf("7d", TODAY)).toEqual({ start: "2026-09-22", end: "2026-09-28" });
    expect(rangeOf("week", "2026-10-01")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
    expect(rangeOf("lastweek", "2026-10-01")).toEqual({ start: "2026-09-21", end: "2026-09-27" });
  });
});

describe("보고서 — 목업 5판과 같은 출력", () => {
  it("마크다운 기본", () => {
    expect(buildReport(data, defaultReport("ko"), TODAY, "ko").text).toBe(
      [
        "## 금주 실적 (9/22 ~ 9/28)",
        "",
        "### Atlas",
        "- [진행] Store 재제출 (시작 메뉴 항목 정리한 패키지) [1/3] (~9/28)",
        "  - 9/26 10:05 시작 메뉴 항목 3개를 1개로 줄인 매니페스트 머지",
        "  - 9/27 16:40 MSIX 빌드에 서명 경고. 인증서 만료가 11월이라 이번엔 괜찮음",
        "  - 9/28 09:12 Partner Center 로그인 2단계 인증 기기 바꿔야 함",
        "- [예정] 업데이트 확인 저장소 이름 slnu21로 (~9/26)",
        "  - 9/24 11:20 301 리다이렉트로 지금도 동작은 함. 급하진 않음",
        "- [완료] 사용자 문의 메일 답장 (9/27)",
        "  - 9/26 09:40 위젯 도킹 해제 후 빈 띠가 남는다는 문의",
        "  - 9/27 13:02 재현 안 됨. 로그 요청해 둠",
        "",
        "### Cairn",
        "- [예정] 템플릿 검토 요청 (~10/2)",
        "  - 9/27 10:03 설비 도입 템플릿 v2 메일로 보냄",
        "  - 9/28 11:45 다음 주 화요일까지 본다고 회신",
        "- [완료] 현황판 정렬 버그 수정 [2/2] (9/26)",
        "  - 9/25 14:05 날짜 없는 행이 맨 위로 올라오는 문제",
        "  - 9/26 17:18 빈 날짜를 맨 뒤로 보내게 수정, 테스트 통과",
        "",
        "### 홈페이지 개편",
        "- [완료] 운영 서버로 이전 (9/25)",
        "  - 9/25 16:05 DNS 전환 완료, 구 서버는 다음 달 반납",
        "",
        "## 차주 계획 (9/29 ~ 10/5)",
        "",
        "### Atlas",
        "- [진행] Store 재제출 (시작 메뉴 항목 정리한 패키지) [1/3] (~9/28)",
        "- [예정] 업데이트 확인 저장소 이름 slnu21로 (~9/26)",
        "- [예정] 스크린샷 다시 찍기 (~10/4)",
        "",
        "### Cairn",
        "- [예정] 현황판 피드백 정리 (~9/29)",
        "- [예정] 템플릿 검토 요청 (~10/2)",
        "",
        "### 사내 교육 준비",
        "- [예정] 교육 자료 초안 [1/2] (~10/1)",
        "- [예정] 회의실 예약 (~10/1)",
      ].join("\n"),
    );
  });

  it("메일 붙여넣기용 — 마크다운 기호 없이, 남은 하위 항목·최근 메모 한 줄", () => {
    const r = { ...defaultReport("ko"), ...presetFor("mail", "ko"), preset: "mail" as const };
    const text = buildReport(data, r, TODAY, "ko").text;
    expect(text.split("\n").slice(0, 7)).toEqual([
      "■ 금주 실적 (9월 22일 ~ 9월 28일)",
      "",
      "▶ Atlas",
      "  - Store 재제출 (시작 메뉴 항목 정리한 패키지) [진행] ~9월 28일",
      "      · MSIX 다시 만들기",
      "      · Partner Center 업로드",
      "      └ 9월 28일 Partner Center 로그인 2단계 인증 기기 바꿔야 함",
    ]);
    expect(text).not.toMatch(/^#/m);
  });

  it("보관한 프로젝트 — 기간 안 완료는 실적에 남고 계획에는 없다", () => {
    const { text } = buildReport(data, defaultReport("ko"), TODAY, "ko");
    const [actual, plan] = text.split("## 차주 계획");
    expect(actual).toContain("### 홈페이지 개편");
    expect(plan).not.toContain("홈페이지 개편");
  });

  it("계획은 진행 중 + 7일 안 마감 + 지난 마감 — 9일 뒤 마감·마감 없음은 빠진다", () => {
    const { text } = buildReport(data, defaultReport("ko"), TODAY, "ko");
    expect(text).not.toContain("건강검진 예약");
  });

  it("상태별 묶음", () => {
    const r = { ...defaultReport("ko"), group: "status" as const, plan: false };
    const heads = buildReport(data, r, TODAY, "ko").text.split("\n").filter((l) => l.startsWith("### "));
    expect(heads).toEqual(["### 완료", "### 진행 중", "### 예정"]);
  });

  it("메모: 넣지 않음 / 기간 안 최근 1줄", () => {
    const base = { ...defaultReport("ko"), plan: false };
    expect(buildReport(data, { ...base, memos: "none" }, TODAY, "ko").text).not.toContain("매니페스트");
    const recent = buildReport(data, { ...base, memos: "recent", memoN: 1 }, TODAY, "ko").text;
    expect(recent).toContain("2단계 인증");
    expect(recent).not.toContain("매니페스트");
  });

  it("넣을 게 없으면 빈 문자열, 개수 0", () => {
    const r = buildReport(emptyData(), defaultReport("ko"), TODAY, "ko");
    expect(r).toEqual({ text: "", actualCount: 0, planCount: 0 });
  });

  it("기간 밖 완료·메모는 실적에 안 들어간다", () => {
    const d = emptyData();
    const old: Item = {
      id: "x", projectId: "inbox", title: "지난달 일", status: "done", importance: 2, assignee: "", due: "",
      createdAt: "2026-08-01T09:00", startedAt: "2026-08-01T09:00", doneAt: "2026-08-02T09:00", subs: [], memos: [],
    };
    d.items.push(old);
    expect(buildReport(d, defaultReport("ko"), TODAY, "ko").actualCount).toBe(0);
  });
});

describe("언어를 바꾸면 기본값만 따라간다", () => {
  it("기본 제목·상태 글자·날짜 형식은 영어로", () => {
    const r = relocalize({ ...defaultReport("ko"), fmt: "M월 D일" }, "ko", "en");
    expect(r).toMatchObject({ actualTitle: "This week", planTitle: "Next week", fmt: "MMM D", labels: { done: "[Done]" } });
    expect(buildReport(data, r, TODAY, "en").text.split("\n")[0]).toBe("## This week (Sep 22 ~ Sep 28)");
  });
  it("직접 고친 제목·글자는 그대로", () => {
    const mine = { ...defaultReport("ko"), actualTitle: "이번 주 한 일", labels: { done: "✔", doing: "▶", todo: "·" } };
    const r = relocalize(mine, "ko", "en");
    expect(r.actualTitle).toBe("이번 주 한 일");
    expect(r.labels.done).toBe("✔");
  });
});

describe("저장된 규칙 읽기", () => {
  it("쓴 것을 그대로 읽는다", async () => {
    const { parseReportRules } = await import("./report");
    const r = { ...defaultReport("ko"), ...presetFor("mail", "ko"), preset: "mail" as const };
    expect(parseReportRules(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
  it("틀린 필드만 기본값, 객체가 아니면 null", async () => {
    const { parseReportRules } = await import("./report");
    expect(parseReportRules("x")).toBeNull();
    const r = parseReportRules({ range: "month", memoN: 999, custom: true, labels: { done: 3 } })!;
    expect(r).toMatchObject({ range: "7d", memoN: 20, custom: false, labels: { done: "[완료]" } });
  });
});
