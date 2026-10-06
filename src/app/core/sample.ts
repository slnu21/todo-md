/**
 * 예시 데이터 — 스크린샷·e2e·데모용(`?seed=sample`, `TODOMD_SEED=sample`). 제품 화면에서 자동으로 넣지 않는다.
 * 날짜는 `today` 기준 상대값이라 언제 열어도 지남·오늘·내일이 고르게 보인다(목업 예시와 같은 구성).
 * 글은 언어별(영어 UI 스크린샷에 한글 할 일이 섞이지 않게) — 구성(상태·날짜·하위·메모 수)은 두 언어가 같다.
 */
import { addDays, type PlainDate } from "./date";
import type { Lang } from "./i18n";
import { DATA_VERSION, INBOX_ID, type Item, type Memo, type TodoData } from "./model";

const TEXT = {
  ko: {
    p: ["Atlas", "Cairn", "사내 교육 준비", "홈페이지 개편"],
    store: "Store 재제출 (시작 메뉴 항목 정리한 패키지)", storeSubs: ["버전 1.37.0 올리기", "MSIX 다시 만들기", "Partner Center 업로드"],
    storeMemos: ["시작 메뉴 항목 3개를 1개로 줄인 매니페스트 머지", "MSIX 빌드에 서명 경고. 인증서 만료가 11월이라 이번엔 괜찮음", "Partner Center 로그인 2단계 인증 기기 바꿔야 함"],
    repo: "업데이트 확인 저장소 이름 slnu21로", repoMemo: "301 리다이렉트로 지금도 동작은 함. 급하진 않음",
    shots: "스크린샷 다시 찍기",
    mail: "사용자 문의 메일 답장", mailMemos: ["위젯 도킹 해제 후 빈 띠가 남는다는 문의", "재현 안 됨. 로그 요청해 둠"],
    sort: "현황판 정렬 버그 수정", sortSubs: ["재현 테스트 추가", "종료 예정 열 정렬 고치기"],
    sortMemos: ["날짜 없는 행이 맨 위로 올라오는 문제", "빈 날짜를 맨 뒤로 보내게 수정, 테스트 통과"],
    feedback: "현황판 피드백 정리",
    review: "템플릿 검토 요청", reviewer: "김 책임", reviewMemos: ["설비 도입 템플릿 v2 메일로 보냄", "다음 주 화요일까지 본다고 회신"],
    deck: "교육 자료 초안", deckSubs: ["목차", "실습 예제"],
    room: "회의실 예약", roomOwner: "총무팀",
    migrate: "운영 서버로 이전", migrateMemo: "DNS 전환 완료, 구 서버는 다음 달 반납",
    checkup: "건강검진 예약",
  },
  en: {
    p: ["Atlas", "Cairn", "Team training", "Website redesign"],
    store: "Resubmit to Store (cleaned-up Start menu)", storeSubs: ["Bump version to 1.37.0", "Rebuild the MSIX", "Upload to Partner Center"],
    storeMemos: ["Merged the manifest that cuts 3 Start menu entries to 1", "Signing warning in the MSIX build. Cert expires in Nov, fine for now", "Need to switch the 2FA device for Partner Center"],
    repo: "Rename the update-check repo to slnu21", repoMemo: "Still works through the 301 redirect. Not urgent",
    shots: "Retake screenshots",
    mail: "Reply to user support mail", mailMemos: ["User reports an empty strip after undocking", "Can't reproduce. Asked for logs"],
    sort: "Fix dashboard sort bug", sortSubs: ["Add a repro test", "Fix sorting of the due column"],
    sortMemos: ["Rows without a date float to the top", "Empty dates now sort last, tests pass"],
    feedback: "Sort out dashboard feedback",
    review: "Ask for template review", reviewer: "Kim", reviewMemos: ["Mailed template v2 for equipment purchase", "Replied they'll review by next Tuesday"],
    deck: "Draft training slides", deckSubs: ["Outline", "Hands-on examples"],
    room: "Book a meeting room", roomOwner: "Facilities",
    migrate: "Move to production server", migrateMemo: "DNS switched; old server goes back next month",
    checkup: "Book a health checkup",
  },
} satisfies Record<Lang, unknown>;

export function sampleData(today: PlainDate, lang: Lang = "ko"): TodoData {
  const x = TEXT[lang];
  let n = 0;
  const id = () => `s${++n}`;
  const day = (o: number) => addDays(today, o);
  const at = (o: number, hm: string) => `${day(o)}T${hm}`;
  const memo = (o: number, hm: string, text: string): Memo => ({ id: id(), at: at(o, hm), text });
  const item = (p: Partial<Item> & Pick<Item, "projectId" | "title">): Item => ({
    id: id(), status: "todo", importance: 2, assignee: "", due: "", createdAt: at(-3, "09:00"),
    startedAt: null, doneAt: null, subs: [], memos: [], ...p,
  });
  return {
    version: DATA_VERSION,
    projects: [
      { id: "p1", name: x.p[0] },
      { id: "p2", name: x.p[1] },
      { id: "p3", name: x.p[2] },
      { id: "p4", name: x.p[3], archived: true, archivedAt: at(-2, "18:00") },
      { id: INBOX_ID, name: "" },
    ],
    items: [
      item({ projectId: "p1", title: x.store, status: "doing", importance: 3, due: day(0), startedAt: at(-2, "10:00"),
        subs: [{ id: id(), title: x.storeSubs[0], done: true }, { id: id(), title: x.storeSubs[1], done: false }, { id: id(), title: x.storeSubs[2], done: false }],
        memos: [memo(-2, "10:05", x.storeMemos[0]), memo(-1, "16:40", x.storeMemos[1]), memo(0, "09:12", x.storeMemos[2])] }),
      item({ projectId: "p1", title: x.repo, due: day(-2), memos: [memo(-4, "11:20", x.repoMemo)] }),
      item({ projectId: "p1", title: x.shots, importance: 1, due: day(6) }),
      item({ projectId: "p1", title: x.mail, status: "done", startedAt: at(-2, "09:30"), doneAt: at(-1, "13:30"),
        memos: [memo(-2, "09:40", x.mailMemos[0]), memo(-1, "13:02", x.mailMemos[1])] }),
      item({ projectId: "p2", title: x.sort, status: "done", importance: 3, due: day(-1), startedAt: at(-3, "14:00"), doneAt: at(-2, "17:20"),
        subs: [{ id: id(), title: x.sortSubs[0], done: true }, { id: id(), title: x.sortSubs[1], done: true }],
        memos: [memo(-3, "14:05", x.sortMemos[0]), memo(-2, "17:18", x.sortMemos[1])] }),
      item({ projectId: "p2", title: x.feedback, importance: 3, due: day(1) }),
      item({ projectId: "p2", title: x.review, assignee: x.reviewer, due: day(4),
        memos: [memo(-1, "10:03", x.reviewMemos[0]), memo(0, "11:45", x.reviewMemos[1])] }),
      item({ projectId: "p3", title: x.deck, due: day(3), subs: [{ id: id(), title: x.deckSubs[0], done: true }, { id: id(), title: x.deckSubs[1], done: false }] }),
      item({ projectId: "p3", title: x.room, importance: 1, assignee: x.roomOwner, due: day(3) }),
      item({ projectId: "p4", title: x.migrate, status: "done", importance: 3, due: day(-3), startedAt: at(-6, "09:00"), doneAt: at(-3, "16:10"),
        memos: [memo(-3, "16:05", x.migrateMemo)] }),
      item({ projectId: INBOX_ID, title: x.checkup, due: day(9) }),
    ],
    report: null,
  };
}
