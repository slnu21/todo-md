/**
 * 기능 e2e(브라우저 모드). 설계(CLAUDE.md '확정 결정')대로 동작하는지 사용자처럼 눌러 본다.
 * 페이지 오류가 하나라도 나면 실패한다.
 */
import { expect, test, type Page } from "@playwright/test";

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
});
test.afterEach(() => expect(errors, errors.join("\n")).toEqual([]));

async function fresh(page: Page, url = "/") {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(page.getByTestId("widget")).toBeVisible();
}

const titleInput = (page: Page) => page.getByLabel("할 일", { exact: true });
const row = (page: Page, title: string) => page.locator("li.item").filter({ hasText: title });

test("한 줄 입력 — Enter 뒤 입력칸은 비고 포커스와 프로젝트는 남는다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await page.getByLabel("프로젝트").selectOption({ label: "Cairn" });
  await titleInput(page).fill("첫째");
  await titleInput(page).press("Enter");
  await expect(titleInput(page)).toHaveValue("");
  await expect(titleInput(page)).toBeFocused();
  await titleInput(page).fill("둘째");
  await titleInput(page).press("Enter");
  const cairn = page.locator('section[data-project="p2"]');
  await expect(cairn.locator("li.item .t")).toContainText(["첫째", "둘째"]);
  await expect(page.getByLabel("프로젝트")).toHaveValue("p2");
});

test("상태 동그라미: 할 일 → 진행(형광펜) → 완료(접힘) → 할 일", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const r = row(page, "스크린샷 다시 찍기");
  await r.locator(".status").click();
  await expect(r).toHaveClass(/doing/);
  await row(page, "스크린샷 다시 찍기").locator(".status").click();
  await expect(row(page, "스크린샷 다시 찍기")).toHaveCount(0); // 완료는 접힌다
  await page.locator('section[data-project="p1"]').getByRole("button", { name: /완료 2개 보기/ }).click();
  await row(page, "스크린샷 다시 찍기").locator(".status").click();
  await expect(row(page, "스크린샷 다시 찍기")).toHaveClass(/todo/);
});

test("정렬: 진행 → 중요도 높음 → 마감 빠른 순", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const titles = await page.locator('section[data-project="p1"] li.item .t').allTextContents();
  expect(titles).toEqual(["Store 재제출 (시작 메뉴 항목 정리한 패키지)", "업데이트 확인 저장소 이름 slnu21로", "스크린샷 다시 찍기"]);
});

test("메모 기록: Enter 마다 한 줄, 시각이 붙고, 목록에 마지막 메모가 보인다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await row(page, "스크린샷 다시 찍기").getByRole("button", { name: "스크린샷 다시 찍기" }).click();
  const memo = page.getByLabel("메모", { exact: true });
  await expect(memo).toBeFocused();
  await memo.fill("캡처 도구 정했음");
  await memo.press("Enter");
  await memo.fill("다크 테마도 찍기");
  await memo.press("Enter");
  const log = page.getByTestId("memo-log");
  await expect(log.locator("li.m")).toHaveCount(2);
  await expect(log.locator("li.m time").first()).toHaveText(/^\d{2}:\d{2}$/);
  await expect(log.locator(".day-h")).toContainText("(오늘)");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("detail")).toHaveCount(0);
  await expect(row(page, "스크린샷 다시 찍기").locator(".lastmemo")).toContainText("다크 테마도 찍기");
});

test("다른 프로젝트로 옮기기 — 상세의 프로젝트 칸, 메모·하위는 따라간다, 보관한 프로젝트는 목록에 없다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await row(page, "교육 자료 초안").getByRole("button", { name: "교육 자료 초안" }).click();
  const pick = page.getByTestId("detail").getByLabel("다른 프로젝트로 옮기기");
  await expect(pick).toHaveValue("p3");
  await expect(pick.locator("option")).toHaveText(["Atlas", "Cairn", "사내 교육 준비", "미분류"]);
  await pick.selectOption({ label: "Cairn" });
  await expect(page.getByTestId("detail").getByText("목차")).toBeVisible(); // 상세는 그대로 열려 있다
  await page.keyboard.press("Escape");
  const cairn = page.locator('section.group[data-project="p2"]');
  await expect(cairn.locator("li.item", { hasText: "교육 자료 초안" })).toContainText("1/2");
  await expect(page.locator('section.group[data-project="p3"]').locator("li.item", { hasText: "교육 자료 초안" })).toHaveCount(0);
  // 새로고침해도 옮긴 자리
  await page.reload();
  await expect(cairn.locator("li.item", { hasText: "교육 자료 초안" })).toHaveCount(1);
});

test("하위 항목 한 단계 — 목록에서 펼쳐 추가·체크", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const r = row(page, "회의실 예약");
  await r.getByRole("button", { name: "하위 추가" }).click();
  const input = r.getByPlaceholder("하위 항목 추가 후 Enter");
  await input.fill("오전 10시");
  await input.press("Enter");
  await r.getByLabel("오전 10시").check();
  await expect(r.getByRole("button", { name: "하위 1/1" })).toBeVisible();
});

test("하위 입력칸 닫기 — 비운 채 바깥 클릭·Esc·버튼 다시 누르기", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const r = row(page, "회의실 예약");
  const add = r.getByRole("button", { name: "하위 추가" });
  const input = r.getByPlaceholder("하위 항목 추가 후 Enter");

  // 비운 채 다른 곳을 누르면 접힌다(하위가 없을 때 — 추가하려고 연 칸).
  await add.click();
  await expect(input).toBeFocused();
  await titleInput(page).click();
  await expect(input).toHaveCount(0);
  await expect(add).toHaveAttribute("aria-expanded", "false");

  // Esc 로 접히고 포커스는 펼침 버튼으로. 쓰던 글자가 있어도 Esc 는 접는다.
  await add.click();
  await input.fill("쓰다 만 것");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(add).toBeFocused();

  // 입력칸에 포커스가 있을 때 펼침 버튼을 다시 누르면 접힌다(바깥 클릭 접기와 겹쳐 다시 펼쳐지지 않게).
  await add.click();
  await expect(input).toBeFocused();
  await add.click();
  await expect(input).toHaveCount(0);

  // 글자가 남아 있으면 바깥 클릭으로 접지 않는다(쓰던 걸 잃지 않게).
  await add.click();
  await input.fill("남겨 둘 것");
  await titleInput(page).click();
  await expect(input).toHaveValue("남겨 둘 것");

  // 하위가 이미 있으면 비운 채 떠나도 펼친 채 둔다(체크하러 연 것일 수 있다). Esc 는 접는다.
  await input.fill("오전 10시");
  await input.press("Enter");
  await titleInput(page).click();
  await expect(r.getByLabel("오전 10시")).toBeVisible();
  await input.press("Escape");
  await expect(r.getByLabel("오전 10시")).toHaveCount(0);
});

test("프로젝트 이름 바꾸기 — 버튼·두 번 누르기, Enter/바깥 = 저장, Esc = 취소, 미분류는 안 됨", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const g = page.locator('section[data-project="p3"]');
  const input = g.getByLabel("프로젝트 이름 — Enter 저장, Esc 취소");

  await g.getByRole("button", { name: "사내 교육 준비 이름 바꾸기" }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("사내 교육 준비");
  await page.keyboard.type("신입 교육"); // 전체 선택된 채 열려 통째로 바뀐다
  await page.keyboard.press("Enter");
  await expect(g.getByRole("heading", { name: "신입 교육" })).toBeVisible();
  // 입력줄 프로젝트 목록도 따라 바뀐다.
  await expect(page.getByLabel("프로젝트").locator("option", { hasText: "신입 교육" })).toHaveCount(1);

  // Esc = 취소.
  await g.getByRole("heading", { name: "신입 교육" }).dblclick();
  await input.fill("버릴 이름");
  await input.press("Escape");
  await expect(g.getByRole("heading", { name: "신입 교육" })).toBeVisible();

  // 바깥을 누르면 저장, 빈 이름이면 원래대로.
  await g.getByRole("heading", { name: "신입 교육" }).dblclick();
  await input.fill("교육 2026");
  await titleInput(page).click();
  await expect(g.getByRole("heading", { name: "교육 2026" })).toBeVisible();
  await g.getByRole("heading", { name: "교육 2026" }).dblclick();
  await input.fill("   ");
  await input.press("Enter");
  await expect(g.getByRole("heading", { name: "교육 2026" })).toBeVisible();

  // 새로 읽어도 남아 있다(저장됨).
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.locator('section[data-project="p3"]').getByRole("heading", { name: "교육 2026" })).toBeVisible();

  // 미분류: 버튼 없음, 두 번 눌러도 입력칸이 안 열린다.
  const inbox = page.locator('section[data-project="inbox"]');
  await expect(inbox.getByRole("button", { name: /이름 바꾸기/ })).toHaveCount(0);
  await inbox.getByRole("heading").dblclick();
  await expect(inbox.getByLabel("프로젝트 이름 — Enter 저장, Esc 취소")).toHaveCount(0);
});

test("메모 고치기 — ✎·두 번 누르기, Enter/바깥 = 저장, Esc = 취소(상세는 안 닫힘), 시각은 그대로", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await page.getByRole("button", { name: /Store 재제출/ }).click();
  const detail = page.getByTestId("detail");
  const memo = detail.locator("li.m", { hasText: "매니페스트 머지" });
  const time = await memo.locator("time").textContent();
  const input = detail.getByLabel("메모 고치기 — Enter 저장, Esc 취소");

  await memo.hover();
  await memo.getByRole("button", { name: "이 메모 고치기" }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("시작 메뉴 항목 3개를 1개로 줄인 매니페스트 머지");
  await input.fill("시작 메뉴 항목 3개 → 1개 매니페스트 머지");
  await input.press("Enter");
  const edited = detail.locator("li.m", { hasText: "3개 → 1개" });
  await expect(edited).toBeVisible();
  await expect(edited.locator("time")).toHaveText(time!); // 적은 시각은 기록이라 그대로

  // Esc = 취소, 상세 창은 그대로.
  await edited.locator("span").first().dblclick();
  await input.fill("버릴 글");
  await input.press("Escape");
  await expect(detail).toBeVisible();
  await expect(detail.locator("li.m", { hasText: "3개 → 1개" })).toBeVisible();

  // 빈 글로 저장하면 원래대로(지우기는 × 로만).
  await edited.locator("span").first().dblclick();
  await input.fill("  ");
  await input.press("Enter");
  await expect(detail.locator("li.m", { hasText: "3개 → 1개" })).toBeVisible();

  // 바깥 클릭 = 저장. 마지막 메모면 목록의 '마지막 메모' 줄도 바뀐다.
  const last = detail.locator("li.m", { hasText: "2단계 인증" });
  await last.locator("span").first().dblclick();
  await input.fill("2단계 인증 기기 교체 완료");
  await detail.locator(".pp-foot").click();
  await expect(detail.locator("li.m", { hasText: "기기 교체 완료" })).toBeVisible();
  await expect(row(page, "Store 재제출").locator(".lastmemo")).toContainText("기기 교체 완료");
});

test("프로젝트 순서 — 머리줄 끌어 놓기(위로=앞, 아래로=뒤)·Alt+↑↓·새로고침 유지, 미분류는 늘 끝", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const order = () => page.locator("section.group").evaluateAll((els) => els.map((e) => e.getAttribute("data-project")).join(" "));
  const head = (id: string) => page.locator(`section[data-project="${id}"] .group-head`);
  // locator.dragTo 는 한 번에 옮겨 Chromium 이 끌기를 시작하지 않는다 — 마우스를 조금씩 움직여 실제처럼.
  // 창을 세로로 키워 모든 머리줄이 스크롤 없이 보이게(화면 밖 좌표로는 끌 수 없다).
  await page.setViewportSize({ width: 360, height: 1600 });
  const drag = async (from: string, to: string) => {
    const a = (await head(from).boundingBox())!;
    await page.mouse.move(a.x + 20, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 30, a.y + a.height / 2 + 6, { steps: 3 });
    const b = (await head(to).boundingBox())!;
    await page.mouse.move(b.x + 30, b.y + b.height / 2, { steps: 10 });
    for (const dx of [4, 8]) await page.mouse.move(b.x + 30 + dx, b.y + b.height / 2); // 끌기 중 이동은 한 박자 늦게 반영된다
    await page.mouse.up();
  };
  expect(await order()).toBe("p1 p2 p3 inbox");

  await drag("p3", "p1"); // 위로 → 대상 앞
  expect(await order()).toBe("p3 p1 p2 inbox");
  await drag("p3", "p1"); // 아래로 → 대상 뒤
  expect(await order()).toBe("p1 p3 p2 inbox");
  await drag("p1", "inbox"); // 미분류에 놓으면 끝(미분류 바로 앞)
  expect(await order()).toBe("p3 p2 p1 inbox");
  // 입력줄 프로젝트 목록도 같은 순서.
  expect(await page.getByLabel("프로젝트").locator("option").evaluateAll((os) => os.map((o) => o.textContent).join(","))).toMatch(/^사내 교육 준비,Cairn,Atlas,미분류/);

  // 키보드: 머리줄 안 버튼에서 Alt+↑↓. 맨 끝(미분류 앞)에서 ↓ 는 그대로.
  await page.getByRole("button", { name: "Atlas 이름 바꾸기" }).focus();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await order()).toBe("p3 p1 p2 inbox");
  await expect(page.getByRole("button", { name: "Atlas 이름 바꾸기" })).toBeFocused(); // 포커스가 따라간다
  await page.keyboard.press("Alt+ArrowDown");
  await page.keyboard.press("Alt+ArrowDown");
  expect(await order()).toBe("p3 p2 p1 inbox");

  await page.waitForTimeout(700);
  await page.reload();
  expect(await order()).toBe("p3 p2 p1 inbox");

  await expect(head("inbox")).not.toHaveAttribute("draggable", "true");
});

test("찾기 — 빈 검색 = 완료 기록, 제목·메모·담당에서 찾기, 결과 → 상세, Esc·Ctrl+F, 보관 파일은 체크할 때만", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const panel = page.getByTestId("search");
  const box = page.getByLabel("제목·메모·하위 항목·담당에서 찾기");

  await page.getByRole("button", { name: "찾기" }).click();
  await expect(panel).toBeVisible();
  await expect(box).toBeFocused();
  await expect(page.getByTestId("list")).toHaveCount(0); // 목록 자리를 쓴다

  // 빈 검색 = 완료한 일(최근 완료 순).
  await expect(panel.locator(".s-count")).toContainText("완료한 일");
  await expect(panel.locator(".s-hit").first()).toContainText("사용자 문의 메일 답장");
  await expect(panel.locator(".s-hit.done")).toHaveCount(await panel.locator(".s-hit").count());

  // 메모에서 맞으면 그 메모와 날짜를 함께, 맞은 글자는 칠한다.
  await box.fill("인증");
  await expect(panel.locator(".s-count")).toHaveText("1건");
  const hit = panel.locator(".s-hit").first();
  await expect(hit.locator(".s-title")).toContainText("Store 재제출");
  await expect(hit.locator(".s-memo")).toContainText("2단계 인증");
  await expect(hit.locator("mark")).toHaveText("인증");

  // 낱말 여럿 = 모두 있어야. 담당에서도 찾는다.
  await box.fill("템플릿 책임");
  await expect(panel.locator(".s-hit")).toHaveCount(1);
  await box.fill("템플릿 없는낱말");
  await expect(panel.getByText("맞는 할 일이 없습니다.")).toBeVisible();

  // 결과를 누르면 상세. Esc 는 상세 먼저, 그다음 찾기.
  await box.fill("스크린샷");
  await panel.locator(".s-hit").first().getByRole("button").click();
  await expect(page.getByTestId("detail")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("detail")).toHaveCount(0);
  await expect(panel).toBeVisible();
  await box.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("list")).toBeVisible();

  // Ctrl+F 로 연다.
  await page.keyboard.press("Control+f");
  await expect(box).toBeFocused();

  // 보관 파일(30일 지난 완료)은 체크할 때만 읽는다. 읽기 전용(상세 없음), 옮길 때의 프로젝트 이름.
  await page.evaluate((y) => localStorage.setItem(`todomd:archive/${y}.json`, JSON.stringify({
    version: 1, projects: { old: "옛 프로젝트" },
    items: [{ id: "arch1", projectId: "old", title: "지난봄 이전 작업", status: "done", importance: 2, assignee: "", due: "", createdAt: `${y}-03-01T09:00`, startedAt: null, doneAt: `${y}-03-05T10:00`, subs: [], memos: [{ id: "am", at: `${y}-03-04T10:00`, text: "이전 완료 메모" }] }],
  })), new Date().getFullYear());
  await box.fill("지난봄");
  await expect(panel.getByText("맞는 할 일이 없습니다.")).toBeVisible();
  await panel.getByLabel("30일 지난 완료(보관 파일)까지").check();
  const old = panel.locator(".s-hit", { hasText: "지난봄 이전 작업" });
  await expect(old).toBeVisible();
  await expect(old.locator(".s-meta")).toContainText("옛 프로젝트");
  await expect(old.locator(".s-meta")).toContainText("보관 파일");
  await expect(old.getByRole("button")).toHaveCount(0);
});

test("내보내기 — 설정에서 JSON 한 파일로, 보관 파일 포함, 개수 안내", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const y = new Date().getFullYear();
  await page.evaluate((year) => localStorage.setItem(`todomd:archive/${year}.json`, JSON.stringify({
    version: 1, projects: { old: "옛 프로젝트" },
    items: [{ id: "arch1", projectId: "old", title: "보관된 일", status: "done", importance: 2, assignee: "", due: "", createdAt: `${year}-03-01T09:00`, startedAt: null, doneAt: `${year}-03-05T10:00`, subs: [], memos: [] }],
  })), y);
  await page.waitForFunction(() => localStorage.getItem("todomd:todo.json") !== null); // 예시 데이터는 0.5초 모아 저장된다
  const liveCount = await page.evaluate(() => JSON.parse(localStorage.getItem("todomd:todo.json")!).items.length as number);

  await page.getByRole("button", { name: /설정/ }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "내보내기" }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^TODO\.md-export-\d{4}-\d{2}-\d{2}\.json$/);
  const json = JSON.parse(await (await import("node:fs/promises")).readFile((await file.path())!, "utf8"));
  expect(json).toMatchObject({ format: "todo-md-export", version: 1, app: { name: "TODO.md" } });
  expect(json.items).toHaveLength(liveCount + 1);
  expect(json.items.at(-1)).toMatchObject({ id: "arch1", project: "옛 프로젝트", fromArchive: true });
  expect(json.projects.find((p: { inbox: boolean }) => p.inbox)).toMatchObject({ name: "미분류" });
  await expect(page.getByRole("status").filter({ hasText: "내보냈습니다" })).toHaveText(`할 일 ${liveCount + 1}개를 내보냈습니다`);
});

test("보관: 남은 일이 있으면 묻고, 되돌릴 수 있다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  const g = page.locator('section[data-project="p3"]');
  await g.getByRole("button", { name: "사내 교육 준비 보관" }).click();
  await expect(g.getByText("남은 할 일이 2건 있습니다")).toBeVisible();
  await g.getByRole("button", { name: "그대로 보관" }).click();
  await expect(page.locator('section[data-project="p3"]')).toHaveCount(0);
  await expect(page.getByLabel("프로젝트").locator("option", { hasText: "사내 교육 준비" })).toHaveCount(0);
  await page.getByRole("button", { name: "보기", exact: true }).click();
  await page.locator(".archive-box li", { hasText: "사내 교육 준비" }).getByRole("button", { name: "되돌리기" }).click();
  await expect(page.locator('section[data-project="p3"]')).toBeVisible();
});

test("미분류는 보관 버튼이 없다", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await expect(page.locator('section[data-project="inbox"]').getByRole("button", { name: /보관/ })).toHaveCount(0);
});

test("달력: 날짜를 누르면 그날 마감만 + 새 입력 마감일이 그날", async ({ page }) => {
  await fresh(page, "/?seed=sample");
  await page.locator(".day.today").click();
  await expect(page.locator("li.item")).toHaveCount(1);
  const due = await page.getByLabel("마감일").inputValue();
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await titleInput(page).fill("오늘 마감 새 일");
  await titleInput(page).press("Enter");
  await expect(page.locator("li.item")).toHaveCount(2);
  await page.getByRole("button", { name: "전체 보기" }).click();
  await expect(page.locator("li.item").first()).toBeVisible();
});

test("새 프로젝트를 입력줄에서 만들면 바로 선택된다", async ({ page }) => {
  await fresh(page);
  await page.getByLabel("프로젝트").selectOption({ label: "＋ 새 프로젝트" });
  await page.getByLabel("새 프로젝트 이름").fill("분기 보고");
  await page.getByLabel("새 프로젝트 이름").press("Enter");
  await expect(page.getByLabel("프로젝트").locator("option:checked")).toHaveText("분기 보고");
  await titleInput(page).fill("초안");
  await titleInput(page).press("Enter");
  await expect(page.locator("section.group").first()).toContainText("분기 보고");
});

test("저장하고 다시 열어도 그대로 — 테마·언어 설정 포함", async ({ page }) => {
  await fresh(page);
  await titleInput(page).fill("남아 있어야 할 일");
  await titleInput(page).press("Enter");
  await page.getByRole("button", { name: /설정/ }).click();
  await page.getByRole("button", { name: "다크" }).click();
  await page.getByRole("button", { name: "English" }).click();
  await page.waitForTimeout(700); // 0.5초 모아 저장
  await page.reload();
  await expect(row(page, "남아 있어야 할 일")).toBeVisible();
  await expect(page.getByRole("button", { name: /Settings/ })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("깨진 파일은 덮어쓰지 않는다", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("todomd:todo.json", "{ broken"));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("저장을 멈췄습니다");
  await titleInput(page).fill("이건 저장되면 안 됨");
  await titleInput(page).press("Enter");
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => localStorage.getItem("todomd:todo.json"))).toBe("{ broken");
});

test.describe("주간보고", () => {
  test.use({ viewport: { width: 940, height: 760 }, permissions: ["clipboard-read", "clipboard-write"] });

  test("보고를 열면 마크다운이 나오고, 프리셋·기간·템플릿을 바꾸면 바로 바뀐다", async ({ page }) => {
    await fresh(page, "/?seed=sample");
    await page.getByRole("button", { name: "보고", exact: true }).click();
    const out = page.getByTestId("report-out");
    await expect(out).toContainText("## 금주 실적");
    await expect(out).toContainText("### 홈페이지 개편"); // 보관했어도 기간 안 완료는 실적에
    await page.getByRole("button", { name: "메일 붙여넣기용" }).click();
    await expect(out).toContainText("■ 금주 실적");
    await expect(page.locator("details.adv")).toHaveAttribute("open", "");
    await page.getByRole("button", { name: "마크다운 기본" }).click();
    await page.getByLabel("상태 표시").selectOption("back");
    await expect(out).toContainText("- Store 재제출 (시작 메뉴 항목 정리한 패키지) [진행]");
    await page.locator("#r-actual-title").fill("이번 주 한 일");
    await expect(out).toContainText("## 이번 주 한 일");
  });

  test("복사하면 결과가 클립보드에 들어간다", async ({ page }) => {
    await fresh(page, "/?seed=sample");
    await page.getByRole("button", { name: "보고", exact: true }).click();
    await page.getByRole("button", { name: "복사" }).click();
    await expect(page.getByRole("status")).toContainText("복사했습니다");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip.split("\n")[0]).toMatch(/^## 금주 실적 \(/);
  });

  test("규칙은 데이터 파일에 저장된다(다시 열어도 그대로)", async ({ page }) => {
    await fresh(page, "/?seed=sample");
    await page.getByRole("button", { name: "보고", exact: true }).click();
    await page.getByRole("button", { name: "간단 요약" }).click();
    await page.waitForTimeout(700);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("todomd:todo.json")!));
    expect(saved.version).toBe(2);
    expect(saved.report.preset).toBe("brief");
    await page.reload();
    await page.getByRole("button", { name: "보고", exact: true }).click();
    await expect(page.getByRole("button", { name: "간단 요약" })).toHaveAttribute("aria-pressed", "true");
  });

  test("언어를 바꾸면 기본 제목은 따라가고 고친 제목은 남는다", async ({ page }) => {
    await fresh(page, "/?seed=sample");
    await page.getByRole("button", { name: "보고", exact: true }).click();
    await page.locator("#r-plan-title").fill("다음 주에 할 일");
    await page.getByRole("dialog", { name: "주간보고" }).getByRole("button", { name: "닫기" }).click();
    await page.getByRole("button", { name: /설정/ }).click();
    await page.getByRole("button", { name: "English" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Report", exact: true }).click();
    const out = page.getByTestId("report-out");
    await expect(out).toContainText(/## This week \(\d+\/\d+ ~/); // 기본 형식 M/D 는 영어도 M/D
    await expect(out).toContainText("## 다음 주에 할 일");
  });
});

test("완료한 지 30일 지난 할 일은 보관 파일로 옮겨진다", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("todomd:todo.json", JSON.stringify({
      version: 2, report: null,
      projects: [{ id: "p1", name: "Atlas" }, { id: "inbox", name: "" }],
      items: [
        { id: "old", projectId: "p1", title: "오래전에 끝낸 일", status: "done", importance: 2, assignee: "", due: "",
          createdAt: "2025-11-01T09:00", startedAt: null, doneAt: "2025-11-02T09:00", subs: [], memos: [] },
        { id: "new", projectId: "p1", title: "지금 할 일", status: "todo", importance: 2, assignee: "", due: "",
          createdAt: "2026-09-01T09:00", startedAt: null, doneAt: null, subs: [], memos: [] },
      ],
    }));
  });
  await page.reload();
  await expect(page.locator("li.item")).toHaveCount(1);
  await page.waitForTimeout(700);
  const todo = await page.evaluate(() => JSON.parse(localStorage.getItem("todomd:todo.json")!));
  const arch = await page.evaluate(() => JSON.parse(localStorage.getItem("todomd:archive/2025.json")!));
  expect(todo.items.map((i: { id: string }) => i.id)).toEqual(["new"]);
  expect(arch.items.map((i: { id: string }) => i.id)).toEqual(["old"]);
  expect(arch.projects).toEqual({ p1: "Atlas" });
});
