/**
 * 예시 데이터 — 스크린샷·e2e·데모용(`?seed=sample`, `TODOMD_SEED=sample`). 제품 화면에서 자동으로 넣지 않는다.
 * 날짜는 `today` 기준 상대값이라 언제 열어도 지남·오늘·내일이 고르게 보인다(목업 예시와 같은 구성).
 */
import { addDays, type PlainDate } from "./date";
import { DATA_VERSION, INBOX_ID, type Item, type Memo, type TodoData } from "./model";

export function sampleData(today: PlainDate): TodoData {
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
      { id: "p1", name: "Atlas" },
      { id: "p2", name: "Cairn" },
      { id: "p3", name: "사내 교육 준비" },
      { id: "p4", name: "홈페이지 개편", archived: true, archivedAt: at(-2, "18:00") },
      { id: INBOX_ID, name: "" },
    ],
    items: [
      item({ projectId: "p1", title: "Store 재제출 (시작 메뉴 항목 정리한 패키지)", status: "doing", importance: 3, due: day(0), startedAt: at(-2, "10:00"),
        subs: [{ id: id(), title: "버전 1.37.0 올리기", done: true }, { id: id(), title: "MSIX 다시 만들기", done: false }, { id: id(), title: "Partner Center 업로드", done: false }],
        memos: [memo(-2, "10:05", "시작 메뉴 항목 3개를 1개로 줄인 매니페스트 머지"), memo(-1, "16:40", "MSIX 빌드에 서명 경고. 인증서 만료가 11월이라 이번엔 괜찮음"), memo(0, "09:12", "Partner Center 로그인 2단계 인증 기기 바꿔야 함")] }),
      item({ projectId: "p1", title: "업데이트 확인 저장소 이름 slnu21로", due: day(-2), memos: [memo(-4, "11:20", "301 리다이렉트로 지금도 동작은 함. 급하진 않음")] }),
      item({ projectId: "p1", title: "스크린샷 다시 찍기", importance: 1, due: day(6) }),
      item({ projectId: "p1", title: "사용자 문의 메일 답장", status: "done", startedAt: at(-2, "09:30"), doneAt: at(-1, "13:30"),
        memos: [memo(-2, "09:40", "위젯 도킹 해제 후 빈 띠가 남는다는 문의"), memo(-1, "13:02", "재현 안 됨. 로그 요청해 둠")] }),
      item({ projectId: "p2", title: "현황판 정렬 버그 수정", status: "done", importance: 3, due: day(-1), startedAt: at(-3, "14:00"), doneAt: at(-2, "17:20"),
        subs: [{ id: id(), title: "재현 테스트 추가", done: true }, { id: id(), title: "종료 예정 열 정렬 고치기", done: true }],
        memos: [memo(-3, "14:05", "날짜 없는 행이 맨 위로 올라오는 문제"), memo(-2, "17:18", "빈 날짜를 맨 뒤로 보내게 수정, 테스트 통과")] }),
      item({ projectId: "p2", title: "현황판 피드백 정리", importance: 3, due: day(1) }),
      item({ projectId: "p2", title: "템플릿 검토 요청", assignee: "김 책임", due: day(4),
        memos: [memo(-1, "10:03", "설비 도입 템플릿 v2 메일로 보냄"), memo(0, "11:45", "다음 주 화요일까지 본다고 회신")] }),
      item({ projectId: "p3", title: "교육 자료 초안", due: day(3), subs: [{ id: id(), title: "목차", done: true }, { id: id(), title: "실습 예제", done: false }] }),
      item({ projectId: "p3", title: "회의실 예약", importance: 1, assignee: "총무팀", due: day(3) }),
      item({ projectId: "p4", title: "운영 서버로 이전", status: "done", importance: 3, due: day(-3), startedAt: at(-6, "09:00"), doneAt: at(-3, "16:10"),
        memos: [memo(-3, "16:05", "DNS 전환 완료, 구 서버는 다음 달 반납")] }),
      item({ projectId: INBOX_ID, title: "건강검진 예약", due: day(9) }),
    ],
  };
}
