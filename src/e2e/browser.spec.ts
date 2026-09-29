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
